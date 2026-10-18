import jwt from "jsonwebtoken";
import { config } from "./config.ts";
import { AppError } from "./errors.ts";

const expiresIn = 60 * 60 * 24;

export type TokenPayload = {
  sub: string;
  email: string;
};

export const signToken = (payload: TokenPayload) => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
};

export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
};
