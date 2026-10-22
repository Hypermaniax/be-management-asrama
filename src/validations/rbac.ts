import { z } from "zod";

export const createRoleSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(255).optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const setPermissionsSchema = z.object({
  permissionIds: z.array(z.string().min(1)),
});

export const setMenusSchema = z.object({
  menuIds: z.array(z.string().min(1)),
});

export const assignRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  buildingId: z.string().min(1).nullable().optional(),
});

export const setPermissionOverridesSchema = z.object({
  overrides: z
    .array(
      z.object({
        permissionId: z.string().min(1),
        effect: z.enum(["GRANT", "DENY"]),
      }),
    )
    .max(200),
});
