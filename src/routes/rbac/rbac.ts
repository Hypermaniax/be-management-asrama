import express from "express";
import { rbacController } from "../../controller/rbac.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { requirePermission } from "../../middleware/permission.ts";

export const router = express.Router();

router.get(
  "/roles",
  requirePermission("role", "READ"),
  asyncHandler(rbacController.listRoles),
);
router.get(
  "/permissions",
  requirePermission("role", "READ"),
  asyncHandler(rbacController.listPermissions),
);
router.get(
  "/menus",
  requirePermission("role", "READ"),
  asyncHandler(rbacController.listMenus),
);
router.get(
  "/roles/:id/permissions",
  requirePermission("role", "READ"),
  asyncHandler(rbacController.getRolePermissions),
);
router.get(
  "/roles/:id/menus",
  requirePermission("role", "READ"),
  asyncHandler(rbacController.getRoleMenus),
);
router.post(
  "/roles",
  requirePermission("role", "CREATE"),
  asyncHandler(rbacController.createRole),
);
router.patch(
  "/roles/:id",
  requirePermission("role", "UPDATE"),
  asyncHandler(rbacController.updateRole),
);
router.delete(
  "/roles/:id",
  requirePermission("role", "DELETE"),
  asyncHandler(rbacController.deleteRole),
);
router.put(
  "/roles/:id/permissions",
  requirePermission("role", "UPDATE"),
  asyncHandler(rbacController.setPermissions),
);
router.put(
  "/roles/:id/menus",
  requirePermission("role", "UPDATE"),
  asyncHandler(rbacController.setMenus),
);
router.post(
  "/assign",
  requirePermission("role", "UPDATE"),
  asyncHandler(rbacController.assignRole),
);
router.delete(
  "/user-roles/:id",
  requirePermission("role", "UPDATE"),
  asyncHandler(rbacController.revokeRole),
);
router.get(
  "/users/:id/permission-overrides",
  requirePermission("role", "READ"),
  asyncHandler(rbacController.getUserOverrides),
);
router.put(
  "/users/:id/permission-overrides",
  requirePermission("role", "UPDATE"),
  asyncHandler(rbacController.setUserOverrides),
);
router.get("/me", asyncHandler(rbacController.myAccess));
