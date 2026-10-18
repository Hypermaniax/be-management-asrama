import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.ts";
import { verifyToken } from "../lib/jwt.ts";

export type AuthedUser = {
  id: string;
  email: string;
};

export type AuthedRequest = Request & { user?: AuthedUser };

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError("Missing bearer token", 401);
  }

  const payload = verifyToken(header.slice("Bearer ".length));
  (req as AuthedRequest).user = { id: payload.sub, email: payload.email };
  next();
};
