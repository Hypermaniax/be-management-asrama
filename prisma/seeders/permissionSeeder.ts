import type { PermissionAction } from "../../src/generated/prisma/client.ts";
import { permissionCode } from "../../src/lib/permission.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { logSeeded } from "./utils.ts";

export const RESOURCES = [
  "user",
  "role",
  "permission",
  "menu",
  "building",
  "room",
  "feeRule",
  "facility",
  "occupancy",
  "document",
  "invoice",
  "payment",
  "cash",
  "category",
  "report",
  "audit",
  "position",
  "period",
  "event",
  "election",
] as const;

export const ACTIONS: PermissionAction[] = [
  "CREATE",
  "READ",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "VERIFY",
  "EXPORT",
];

export async function seedPermissions() {
  const idByCode = new Map<string, string>();

  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      const code = permissionCode(resource, action);
      const permission = await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        create: { code, resource, action },
        update: { code },
      });
      idByCode.set(code, permission.id);
    }
  }

  logSeeded("permissions", idByCode.size);
  return idByCode;
}
