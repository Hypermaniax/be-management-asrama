import { z } from "zod";

export const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const otpSchema = z.object({
  email: z.email(),
  otp: z.string().length(6),
});

export const requestOtpSchema = z.object({
  email: z.email(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(16),
});
