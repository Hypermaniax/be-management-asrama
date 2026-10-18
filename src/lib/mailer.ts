import nodemailer from "nodemailer";
import { config } from "./config.ts";
import { AppError } from "./errors.ts";

const transporter = config.smtp
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

export const sendOtpEmail = async (email: string, code: string) => {
  if (transporter && config.smtp) {
    await transporter.sendMail({
      from: config.smtp.from,
      to: email,
      subject: "Your verification code",
      text: `Your OTP code is ${code}. It expires in 5 minutes.`,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[mailer:dev] OTP for ${email}: ${code}`);
    return;
  }

  throw new AppError("Email service is not configured", 500);
};

export type Mailer = typeof sendOtpEmail;
