import express from "express";
import { rateLimit } from "express-rate-limit";
import { authController } from "../../controller/auth.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { requireAuth } from "../../middleware/auth.ts";

export const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, asyncHandler(authController.signUp));
router.post("/login", authLimiter, asyncHandler(authController.signIn));
router.get("/me", requireAuth, asyncHandler(authController.me));
router.post(
  "/request-otp",
  authLimiter,
  asyncHandler(authController.requestOTP),
);
router.post("/verify-otp", authLimiter, asyncHandler(authController.verifyOTP));
router.post("/refresh", asyncHandler(authController.refresh));
router.post("/logout", asyncHandler(authController.logout));
