import type { NextFunction, Request, Response } from "express";
import type { PermissionAction } from "../generated/prisma/client.ts";
import { auditService } from "../container.ts";
import type { AccessRequest, MarkedHandler } from "./permission.ts";

type AuditMeta = {
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

const AUDITED_FLAG = "__audited";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const METHOD_ACTION: Record<string, PermissionAction> = {
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};
const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN_GEDUNG"]);

type RouteLike = { stack?: { handle: MarkedHandler }[] };

type MetaRequest = {
  method: string;
  path: string;
  route?: unknown;
};

// Derives the audit action/entity from the route's permission marker (set by
// `requirePermission`/`crud`), falling back to the HTTP method + first path segment.
export const resolveAuditMeta = (req: MetaRequest): { action: string; entity: string } => {
  const stack = (req.route as RouteLike | undefined)?.stack ?? [];
  const marker = stack
    .map((layer) => layer.handle)
    .find((handler) => handler?.permission)?.permission;
  const action =
    marker && marker.action !== "DYNAMIC" ? marker.action : (METHOD_ACTION[req.method] ?? req.method);
  const entity = marker?.resource ?? req.path.split("/").filter(Boolean)[0] ?? "unknown";
  return { action, entity };
};

const firstParamValue = (params: Record<string, unknown> = {}): string | undefined =>
  Object.values(params).find((entry): entry is string => typeof entry === "string");

const markAudited = (req: Request) => {
  (req as unknown as Record<string, unknown>)[AUDITED_FLAG] = true;
};

const wasAudited = (req: Request) =>
  Boolean((req as unknown as Record<string, unknown>)[AUDITED_FLAG]);

// Rich manual audit (with before/after). Marks the request so the generic
// middleware below does not double-log it.
export const auditRequest = async (req: Request, meta: AuditMeta) => {
  const { user } = req as AccessRequest;
  if (!user) return null;
  markAudited(req);
  try {
    return await auditService.record({
      actorId: user.id,
      action: meta.action,
      entity: meta.entity,
      entityId: meta.entityId,
      path: req.originalUrl,
      before: meta.before,
      after: meta.after,
      ip: req.ip ?? null,
    });
  } catch (error) {
    console.error("[audit]", error);
    return null;
  }
};

// Generic safety net: records every successful mutation performed by an admin
// (SUPER_ADMIN / ADMIN_GEDUNG). Never throws.
export const auditMutations = (req: Request, res: Response, next: NextFunction) => {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const originalJson = res.json.bind(res);
  let payload: { data?: { id?: unknown } } | undefined;
  res.json = ((body?: unknown) => {
    payload = body as { data?: { id?: unknown } };
    return originalJson(body);
  }) as typeof res.json;

  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    if (wasAudited(req)) return;
    const { user, access } = req as AccessRequest;
    if (!user || !access) return;
    if (!access.isSuperAdmin && !access.roles.some((role) => ADMIN_ROLES.has(role))) return;

    const { action, entity } = resolveAuditMeta(req);
    const paramId = typeof req.params.id === "string" ? req.params.id : undefined;
    const entityId = (payload?.data?.id as string | undefined) ?? paramId ?? firstParamValue(req.params) ?? "";

    void auditService
      .record({
        actorId: user.id,
        action,
        entity,
        entityId,
        path: req.originalUrl,
        after: payload?.data ?? null,
        ip: req.ip ?? null,
      })
      .catch((error) => console.error("[audit]", error));
  });

  next();
};
