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
router.get("/me", asyncHandler(rbacController.myAccess));
