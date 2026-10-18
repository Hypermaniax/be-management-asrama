import { createHmac, timingSafeEqual } from "node:crypto";

// Time-based, stateless OTP: the code is derived from secret + email + time step,
// so nothing has to be stored between issuing and verifying.
export const generateOtp = (secret: string, email: string, step: number, digits = 6): string => {
  const hmac = createHmac("sha256", secret).update(`${email}:${step}`).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, "0");
};

export const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
};
