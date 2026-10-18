import type { AuditLog } from "../generated/prisma/client.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type { AuditInput } from "../lib/audit.ts";
import { prisma } from "../lib/prisma.ts";

export type { AuditLog };

export type ListAuditFilters = {
  entity?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  take?: number;
};

const jsonOrUndefined = (value: unknown): Prisma.InputJsonValue | undefined =>
  value === undefined ? undefined : (value as Prisma.InputJsonValue);

export const auditRepository = {
  record(data: AuditInput) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        path: data.path ?? null,
        before: jsonOrUndefined(data.before),
        after: jsonOrUndefined(data.after),
        ip: data.ip ?? null,
      },
    });
  },

  list(filters: ListAuditFilters = {}) {
    return prisma.auditLog.findMany({
      where: {
        ...(filters.entity ? { entity: filters.entity } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        ...(filters.action ? { action: filters.action } : {}),
      },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: filters.take ?? 100,
    });
  },

  findById(id: string) {
    return prisma.auditLog.findFirst({ where: { id }, include: { actor: true } });
  },
};

export type AuditRepository = typeof auditRepository;
