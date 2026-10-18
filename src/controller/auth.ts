import type { Request, Response } from "express";
import { AppError } from "../lib/errors.ts";
import { authService } from "../container.ts";
import type { AuthedRequest } from "../middleware/auth.ts";
import {
  otpSchema,
  requestOtpSchema,
  signInSchema,
  signUpSchema,
} from "../validations/auth.ts";

export const authController = {
  async signUp(req: Request, res: Response) {
    const { email, password } = signUpSchema.parse(req.body);
    const data = await authService.signUp(email, password);
    res.status(201).json({ status: "register okay, check your email for otp", data });
  },

  async signIn(req: Request, res: Response) {
    const { email, password } = signInSchema.parse(req.body);
    const data = await authService.signIn(email, password);
    res.json({ status: "login okay", data });
  },

  async me(req: Request, res: Response) {
    const { user } = req as AuthedRequest;
    if (!user) {
      throw new AppError("Unauthorized", 401);
    }
    const data = await authService.me(user.id);
    res.json({ status: "me okay", data });
  },

  async requestOTP(req: Request, res: Response) {
    const { email } = requestOtpSchema.parse(req.body);
    const data = await authService.requestOTP(email);
    res.json({ status: "otp sent", data });
  },

  async verifyOTP(req: Request, res: Response) {
    const { email, otp } = otpSchema.parse(req.body);
    const data = await authService.verifyOTP(email, otp);
    res.json({ status: "otp verified", data });
  },
};
