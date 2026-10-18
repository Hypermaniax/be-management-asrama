import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { PermissionAction } from "../generated/prisma/client.ts";
import { rbacService } from "../container.ts";
import { asyncHandler } from "../lib/asyncHandler.ts";
import { AppError } from "../lib/errors.ts";
import { permissionCode } from "../lib/permission.ts";
import type { Access } from "../services/rbac/service.ts";
import { requireAuth, type AuthedRequest, type AuthedUser } from "./auth.ts";

export type AccessRequest = Request & { user?: AuthedUser; access?: Access };

export type MarkedHandler = RequestHandler & {
  permission?: { resource: string; action: PermissionAction | "DYNAMIC" };
};

const METHOD_ACTION: Record<string, PermissionAction> = {
  POST: "CREATE",
  GET: "READ",
  PATCH: "UPDATE",
  PUT: "UPDATE",
  DELETE: "DELETE",
};

// Resolves the caller's roles/permissions/menus once per request so guards read from memory.
export const loadAccess = async (req: Request, _res: Response, next: NextFunction) => {
  const { user } = req as AuthedRequest;
  if (!user) {
    throw new AppError("Unauthorized", 401);
  }
  (req as AccessRequest).access = await rbacService.resolveAccess(user.id);
  next();
};

// Default-deny entry point: authenticate, then load access. Mounted on every non-public route.
export const requireAccess = asyncHandler(async (req, _res, next) => {
  requireAuth(req, _res, () => undefined);
  await loadAccess(req, _res, next);
});

// Guards one resource+action. SUPER_ADMIN bypasses; the `permission` marker lets the
// route-coverage test assert that no protected route ships without a check.
export const requirePermission = (resource: string, action: PermissionAction): MarkedHandler => {
  const handler: MarkedHandler = (req, _res, next) => {
    const { access } = req as AccessRequest;
    if (!access) {
      throw new AppError("Forbidden", 403);
    }
    if (access.isSuperAdmin) {
      return next();
    }
    if (!access.permissions.has(permissionCode(resource, action))) {
      throw new AppError("Forbidden", 403);
    }
    next();
  };
  handler.permission = { resource, action };
  return handler;
};

export const requireRole =
  (code: string) => (req: Request, _res: Response, next: NextFunction) => {
    const { access } = req as AccessRequest;
    if (!access) {
      throw new AppError("Forbidden", 403);
    }
    if (!access.isSuperAdmin && !access.roles.includes(code)) {
      throw new AppError("Forbidden", 403);
    }
    next();
  };

export const crud = (resource: string): MarkedHandler => {
  const handler: MarkedHandler = (req, _res, next) => {
    const action = METHOD_ACTION[req.method];
    if (!action) {
      throw new AppError("Forbidden", 403);
    }
    return requirePermission(resource, action)(req, _res, next);
  };
  handler.permission = { resource, action: "DYNAMIC" };
  return handler;
};
