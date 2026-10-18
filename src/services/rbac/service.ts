import { AppError } from "../../lib/errors.ts";
import type { MenuRepository } from "../../repositories/menus.ts";
import type { PermissionRepository } from "../../repositories/permissions.ts";
import type { RoleMenuRepository } from "../../repositories/roleMenus.ts";
import type { RolePermissionRepository } from "../../repositories/rolePermissions.ts";
import type { RoleRepository } from "../../repositories/roles.ts";
import type { UserRoleRepository } from "../../repositories/userRoles.ts";

export const SUPER_ADMIN = "SUPER_ADMIN";

export type MenuNode = {
  id: string;
  code: string;
  name: string;
  path: string;
  icon: string | null;
  sortOrder: number;
  children: MenuNode[];
};

// The caller's effective access, merged across every active role assignment.
export type Access = {
  roles: string[];
  permissions: Set<string>;
  buildings: Set<string>;
  isSuperAdmin: boolean;
  menus: MenuNode[];
};

type MenuRow = {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  path: string;
  icon: string | null;
  sortOrder: number;
};

type RbacDeps = {
  roles: RoleRepository;
  permissions: PermissionRepository;
  menus: MenuRepository;
  userRoles: UserRoleRepository;
  rolePermissions: RolePermissionRepository;
  roleMenus: RoleMenuRepository;
};

const buildMenuTree = (rows: MenuRow[]): MenuNode[] => {
  const nodes = new Map<string, MenuNode>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      code: row.code,
      name: row.name,
      path: row.path,
      icon: row.icon,
      sortOrder: row.sortOrder,
      children: [],
    });
  }

  const roots: MenuNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (list: MenuNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const node of list) sort(node.children);
  };
  sort(roots);

  return roots;
};

export const createRbacService = ({
  roles,
  permissions,
  menus,
  userRoles,
  rolePermissions,
  roleMenus,
}: RbacDeps) => ({
  async createRole(data: { code: string; name: string; description?: string | null }) {
    if (await roles.findByCode(data.code)) {
      throw new AppError("Role code already exists", 409);
    }
    return roles.create(data);
  },

  listRoles() {
    return roles.list();
  },

  async updateRole(
    id: string,
    data: { name?: string; description?: string | null; isActive?: boolean },
  ) {
    const role = await roles.findById(id);
    if (!role) {
      throw new AppError("Role not found", 404);
    }
    return roles.update(id, data);
  },

  async softDeleteRole(id: string) {
    const role = await roles.findById(id);
    if (!role) {
      throw new AppError("Role not found", 404);
    }
    if (role.isSystem) {
      throw new AppError("System role cannot be deleted", 400);
    }
    return roles.softDelete(id);
  },

  async setRolePermissions(roleId: string, permissionIds: string[]) {
    const role = await roles.findById(roleId);
    if (!role) {
      throw new AppError("Role not found", 404);
    }
    await rolePermissions.replaceForRole(roleId, permissionIds);
    return { roleId, count: permissionIds.length };
  },

  async setRoleMenus(roleId: string, menuIds: string[]) {
    const role = await roles.findById(roleId);
    if (!role) {
      throw new AppError("Role not found", 404);
    }
    await roleMenus.replaceForRole(roleId, menuIds);
    return { roleId, count: menuIds.length };
  },

  async assignRoleToUser(data: {
    userId: string;
    roleId: string;
    buildingId?: string | null;
  }) {
    const role = await roles.findById(data.roleId);
    if (!role) {
      throw new AppError("Role not found", 404);
    }
    return userRoles.assign(data);
  },

  revokeRole(userRoleId: string) {
    return userRoles.remove(userRoleId);
  },

  // Deep interface: collapses role/permission/menu joins into one per-request snapshot.
  // Callers never touch role tables directly; they read this flat result.
  async resolveAccess(userId: string): Promise<Access> {
    const assignments = await userRoles.listByUserWithPermissions(userId);

    const roleCodes = new Set<string>();
    const permissionCodes = new Set<string>();
    const buildings = new Set<string>();
    const menuRows = new Map<string, MenuRow>();
    let isSuperAdmin = false;

    for (const assignment of assignments) {
      roleCodes.add(assignment.role.code);
      if (assignment.role.code === SUPER_ADMIN) {
        isSuperAdmin = true;
      }
      if (assignment.buildingId) {
        buildings.add(assignment.buildingId);
      }
      for (const rolePermission of assignment.role.permissions) {
        permissionCodes.add(rolePermission.permission.code);
      }
      for (const roleMenu of assignment.role.menus) {
        const menu = roleMenu.menu;
        if (menu.isActive && !menu.deletedAt) {
          menuRows.set(menu.id, menu);
        }
      }
    }

    return {
      roles: [...roleCodes],
      permissions: permissionCodes,
      buildings,
      isSuperAdmin,
      menus: buildMenuTree([...menuRows.values()]),
    };
  },
});

export type RbacService = ReturnType<typeof createRbacService>;
