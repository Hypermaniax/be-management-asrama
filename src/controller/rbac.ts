import type { Request, Response } from "express";
import { rbacService } from "../container.ts";
import { AppError } from "../lib/errors.ts";
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
    res.status(201).json({ status: "role created", data: role });
  },

  async listRoles(_req: Request, res: Response) {
    const data = await rbacService.listRoles();
    res.json({ status: "ok", data });
  },

  async updateRole(req: Request, res: Response) {
    const data = updateRoleSchema.parse(req.body);
    const role = await rbacService.updateRole(paramId(req.params.id), data);
    res.json({ status: "role updated", data: role });
  },

  async deleteRole(req: Request, res: Response) {
    await rbacService.softDeleteRole(paramId(req.params.id));
    res.json({ status: "role deleted" });
  },

  async setPermissions(req: Request, res: Response) {
    const { permissionIds } = setPermissionsSchema.parse(req.body);
    const data = await rbacService.setRolePermissions(paramId(req.params.id), permissionIds);
    res.json({ status: "permissions set", data });
  },

  async setMenus(req: Request, res: Response) {
    const { menuIds } = setMenusSchema.parse(req.body);
    const data = await rbacService.setRoleMenus(paramId(req.params.id), menuIds);
    res.json({ status: "menus set", data });
  },

  async assignRole(req: Request, res: Response) {
    const data = assignRoleSchema.parse(req.body);
    const assignment = await rbacService.assignRoleToUser(data);
    res.status(201).json({ status: "role assigned", data: assignment });
  },

  async revokeRole(req: Request, res: Response) {
    await rbacService.revokeRole(paramId(req.params.id));
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
