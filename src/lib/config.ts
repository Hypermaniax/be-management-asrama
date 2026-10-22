import "dotenv/config";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

const smtp = process.env.SMTP_HOST
  ? {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.MAIL_FROM ?? "no-reply@freaking-out.local",
    }
  : null;

export const config = {
  port: Number(process.env.PORT ?? 8080),
  jwtSecret: required("JWT_SECRET"),
  databaseUrl: required("DATABASE_URL"),
  smtp,
  otpSecret: process.env.OTP_SECRET ?? process.env.JWT_SECRET!,
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
  storageDriver: (process.env.STORAGE_DRIVER ?? "local") as "local" | "s3",
  storageDir: process.env.STORAGE_DIR ?? "storage/uploads",
  authAccessTtlSeconds: Number(process.env.AUTH_ACCESS_TTL_SECONDS ?? 3600),
  authRefreshTtlSeconds: Number(process.env.AUTH_REFRESH_TTL_SECONDS ?? 60 * 60 * 24 * 30),
  loginMaxFailures: Number(process.env.LOGIN_MAX_FAILURES ?? 5),
  loginWindowSeconds: Number(process.env.LOGIN_WINDOW_SECONDS ?? 900),
};
