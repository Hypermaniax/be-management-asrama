import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.ts";
import type { AccessRequest } from "./permission.ts";

export type BuildingScope = { all: true } | { buildingIds: string[] };

export type ScopedRequest = AccessRequest & { scope?: BuildingScope };

export const resolveBuildingScope = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const { access } = req as AccessRequest;
  if (!access) {
    throw new AppError("Unauthorized", 401);
  }
  (req as ScopedRequest).scope = access.isSuperAdmin
    ? { all: true }
    : { buildingIds: [...access.buildings] };
  next();
};

export const assertBuildingAccess = (
  req: Request,
  buildingId: string | null | undefined,
) => {
  const { access, scope } = req as ScopedRequest;
  if (!access) {
    throw new AppError("Unauthorized", 401);
  }
  if (access.isSuperAdmin) {
    return;
  }
  if (!buildingId) {
    throw new AppError("Forbidden", 403);
  }
  if (
    scope &&
    "buildingIds" in scope &&
    !scope.buildingIds.includes(buildingId)
  ) {
    throw new AppError("Forbidden", 403);
  }
};
