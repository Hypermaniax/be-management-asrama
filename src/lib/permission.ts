import type { PermissionAction } from "../generated/prisma/client.ts";

// Single owner of the permission-code format (`resource.action`).
// Enforcement (middleware) and seeding both depend on this decision, so it lives here
// rather than being re-implemented per module.
export const permissionCode = (resource: string, action: PermissionAction) => {
  return `${resource}.${action.toLowerCase()}`;
};
