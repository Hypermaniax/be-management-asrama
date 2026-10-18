import { normalizeEmail } from "../../lib/email.ts";
import { AppError } from "../../lib/errors.ts";
import { generateOtp, safeEqual } from "../../lib/otp.ts";

const OTP_DIGITS = 6;
const GRACE_STEPS = 1;

type OtpDeps = {
  secret: string;
  ttlSeconds: number;
  send: (email: string, code: string) => void | Promise<void>;
  now?: () => number;
};

export const createOtpService = ({ secret, ttlSeconds, send, now = Date.now }: OtpDeps) => {
  const stepMs = ttlSeconds * 1000;
  const used = new Map<string, number>();

  const currentStep = (at: number) => Math.floor(at / stepMs);

  const pruneUsed = (at: number) => {
    for (const [key, expiresAt] of used) {
      if (expiresAt <= at) {
        used.delete(key);
      }
    }
  };

  return {
    // Derives the code for the current step and hands it to the delivery queue.
    // No state is written — the same code is recomputed at verify time.
    async issue(email: string) {
      const normalized = normalizeEmail(email);
      const code = generateOtp(secret, normalized, currentStep(now()), OTP_DIGITS);
      await send(normalized, code);
    },

    // Accepts the current or previous step (clock-drift grace) and rejects replays
    // within the window via an in-memory used-set.
    async verify(email: string, code: string) {
      const normalized = normalizeEmail(email);
      const at = now();
      const step = currentStep(at);

      const candidates = Array.from({ length: GRACE_STEPS + 1 }, (_, i) => step - i);
      const matchedStep = candidates.find((candidate) =>
        safeEqual(generateOtp(secret, normalized, candidate, OTP_DIGITS), code),
      );

      if (matchedStep === undefined) {
        throw new AppError("Invalid or expired OTP", 400);
      }

      pruneUsed(at);
      const key = `${normalized}:${matchedStep}`;
      if (used.has(key)) {
        throw new AppError("Invalid or expired OTP", 400);
      }
      used.set(key, at + stepMs * (GRACE_STEPS + 1));
    },
  };
};

export type OtpService = ReturnType<typeof createOtpService>;
