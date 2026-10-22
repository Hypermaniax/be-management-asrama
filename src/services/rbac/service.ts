import { AppError } from "../../lib/errors.ts";
import type { MenuRepository } from "../../repositories/menus.ts";
import type { PermissionRepository } from "../../repositories/permissions.ts";
import type { RoleMenuRepository } from "../../repositories/roleMenus.ts";
import type { RolePermissionRepository } from "../../repositories/rolePermissions.ts";
import type { RoleRepository } from "../../repositories/roles.ts";
import type { UserRoleRepository } from "../../repositories/userRoles.ts";
import type { UserRepository } from "../../repositories/users.ts";
import type { UserPermissionOverrideRepository } from "../../repositories/userPermissionOverrides.ts";

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
  users: UserRepository;
  roles: RoleRepository;
  permissions: PermissionRepository;
  menus: MenuRepository;
  userRoles: UserRoleRepository;
  rolePermissions: RolePermissionRepository;
  roleMenus: RoleMenuRepository;
  permissionOverrides: UserPermissionOverrideRepository;
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
  users,
  roles,
  permissions,
  menus,
  userRoles,
  rolePermissions,
  roleMenus,
  permissionOverrides,
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

  listPermissions() {
    return permissions.list();
  },

  listMenus() {
    return menus.list();
  },

  async getRolePermissions(roleId: string) {
    const role = await roles.findById(roleId);
    if (!role) {
      throw new AppError("Role not found", 404);
    }
    const rows = await rolePermissions.listForRole(roleId);
    return { roleId, permissionIds: rows.map((row) => row.permissionId) };
  },

  async getRoleMenus(roleId: string) {
    const role = await roles.findById(roleId);
    if (!role) {
      throw new AppError("Role not found", 404);
    }
    const rows = await roleMenus.listForRole(roleId);
    return { roleId, menuIds: rows.map((row) => row.menuId) };
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

  // Per-user permission overrides (GRANT/DENY) layered on top of role grants.
  async getPermissionOverrides(userId: string) {
    const user = await users.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const roles = await userRoles.listByUser(userId);
    const superAdmin = roles.some((row) => row.role.code === SUPER_ADMIN);

    const overrides = await permissionOverrides.listForUser(userId);
    return {
      userId,
      isSuperAdmin: superAdmin,
      grants: overrides
        .filter((row) => row.effect === "GRANT")
        .map((row) => ({ permissionId: row.permissionId, code: row.permission.code })),
      denies: overrides
        .filter((row) => row.effect === "DENY")
        .map((row) => ({ permissionId: row.permissionId, code: row.permission.code })),
    };
  },

  async setPermissionOverrides(
    userId: string,
    overrides: { permissionId: string; effect: "GRANT" | "DENY" }[],
  ) {
    const user = await users.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const roles = await userRoles.listByUser(userId);
    if (roles.some((row) => row.role.code === SUPER_ADMIN)) {
      throw new AppError("Super admin access cannot be overridden", 409);
    }

    const seen = new Set<string>();
    for (const override of overrides) {
      if (seen.has(override.permissionId)) {
        throw new AppError("Duplicate permission in overrides", 400);
      }
      seen.add(override.permissionId);
    }

    const directive = await permissions.list();
    const knownIds = new Set(directive.map((row) => row.id));
    for (const permissionId of seen) {
      if (!knownIds.has(permissionId)) {
        throw new AppError("Unknown permission id", 400);
      }
    }

    await permissionOverrides.replaceForUser(userId, overrides);
    return this.getPermissionOverrides(userId);
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

    // Per-user overrides sit on top of role grants: DENY removes, GRANT adds.
    const overrides = await permissionOverrides.listForUser(userId);
    for (const override of overrides) {
      if (override.effect === "DENY") {
        permissionCodes.delete(override.permission.code);
      } else {
        permissionCodes.add(override.permission.code);
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
