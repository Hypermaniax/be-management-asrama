import type { Request, Response } from "express";
import { rbacService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { auditRequest } from "../middleware/audit.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import {
  assignRoleSchema,
  createRoleSchema,
  setMenusSchema,
  setPermissionsSchema,
  updateRoleSchema,
} from "../validations/rbac.ts";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid id", 400);
  }
  return value;
};

export const rbacController = {
  async createRole(req: Request, res: Response) {
    const data = createRoleSchema.parse(req.body);
    const role = await rbacService.createRole(data);
    await auditRequest(req, { action: "CREATE", entity: "role", entityId: role.id, after: role });
    res.status(201).json({ status: "role created", data: role });
  },

  async listRoles(_req: Request, res: Response) {
    const data = await rbacService.listRoles();
    res.json({ status: "ok", data });
  },

  async updateRole(req: Request, res: Response) {
    const data = updateRoleSchema.parse(req.body);
    const role = await rbacService.updateRole(paramId(req.params.id), data);
    await auditRequest(req, { action: "UPDATE", entity: "role", entityId: role.id, after: role });
    res.json({ status: "role updated", data: role });
  },

  async deleteRole(req: Request, res: Response) {
    const id = paramId(req.params.id);
    await rbacService.softDeleteRole(id);
    await auditRequest(req, { action: "DELETE", entity: "role", entityId: id });
    res.json({ status: "role deleted" });
  },

  async setPermissions(req: Request, res: Response) {
    const { permissionIds } = setPermissionsSchema.parse(req.body);
    const roleId = paramId(req.params.id);
    const data = await rbacService.setRolePermissions(roleId, permissionIds);
    await auditRequest(req, {
      action: "UPDATE",
      entity: "role",
      entityId: roleId,
      after: { permissionIds },
    });
    res.json({ status: "permissions set", data });
  },

  async setMenus(req: Request, res: Response) {
    const { menuIds } = setMenusSchema.parse(req.body);
    const roleId = paramId(req.params.id);
    const data = await rbacService.setRoleMenus(roleId, menuIds);
    await auditRequest(req, {
      action: "UPDATE",
      entity: "role",
      entityId: roleId,
      after: { menuIds },
    });
    res.json({ status: "menus set", data });
  },

  async assignRole(req: Request, res: Response) {
    const data = assignRoleSchema.parse(req.body);
    const assignment = await rbacService.assignRoleToUser(data);
    await auditRequest(req, {
      action: "CREATE",
      entity: "userRole",
      entityId: assignment.id,
      after: data,
    });
    res.status(201).json({ status: "role assigned", data: assignment });
  },

  async revokeRole(req: Request, res: Response) {
    const id = paramId(req.params.id);
    await rbacService.revokeRole(id);
    await auditRequest(req, { action: "DELETE", entity: "userRole", entityId: id });
    res.json({ status: "role revoked" });
  },

  async myAccess(req: Request, res: Response) {
    const { user } = req as AccessRequest;
    if (!user) {
      throw new AppError("Unauthorized", 401);
    }
    const access = await rbacService.resolveAccess(user.id);
    res.json({
      status: "ok",
      data: {
        roles: access.roles,
        permissions: [...access.permissions],
        buildings: [...access.buildings],
        isSuperAdmin: access.isSuperAdmin,
        menus: access.menus,
      },
    });
  },
};
