import { config } from "./lib/config.ts";
import { createEmailQueue } from "./lib/emailQueue.ts";
import { sendOtpEmail } from "./lib/mailer.ts";
import { runTransaction } from "./lib/prisma.ts";
import { createLocalStorage } from "./lib/storage.ts";
import { cashAccountRepository } from "./repositories/cashAccounts.ts";
import { categoryRepository } from "./repositories/categories.ts";
import { documentRepository } from "./repositories/documents.ts";
import { eventAttachmentRepository } from "./repositories/eventAttachments.ts";
import { eventAttendanceRepository } from "./repositories/eventAttendances.ts";
import { eventCommitteeRepository } from "./repositories/eventCommittees.ts";
import { eventRepository } from "./repositories/events.ts";
import { eventSessionRepository } from "./repositories/eventSessions.ts";
import { expenseRepository } from "./repositories/expenses.ts";
import { ledgerRepository } from "./repositories/ledger.ts";
import { documentTypeRepository } from "./repositories/documentTypes.ts";
import { fileRepository } from "./repositories/files.ts";
import { buildingRepository } from "./repositories/buildings.ts";
import { facilityRepository } from "./repositories/facilities.ts";
import { feeRuleRepository } from "./repositories/feeRules.ts";
import { invoiceRepository } from "./repositories/invoices.ts";
import { menuRepository } from "./repositories/menus.ts";
import { occupancyRepository } from "./repositories/occupancies.ts";
import { paymentRepository } from "./repositories/payments.ts";
import { periodRepository } from "./repositories/periods.ts";
import { permissionRepository } from "./repositories/permissions.ts";
import { positionAssignmentRepository } from "./repositories/positionAssignments.ts";
import { positionRepository } from "./repositories/positions.ts";
import { publicFacilityRepository } from "./repositories/publicFacilities.ts";
import { publicFacilityAssignmentRepository } from "./repositories/publicFacilityAssignments.ts";
import { roleMenuRepository } from "./repositories/roleMenus.ts";
import { rolePermissionRepository } from "./repositories/rolePermissions.ts";
import { roleRepository } from "./repositories/roles.ts";
import { roomFacilityRepository } from "./repositories/roomFacilities.ts";
import { roomRepository } from "./repositories/rooms.ts";
import { userRepository } from "./repositories/users.ts";
import { userRoleRepository } from "./repositories/userRoles.ts";
import { createAuthService } from "./services/auth/service.ts";
import { createBillingService } from "./services/billing/service.ts";
import { createBuildingService } from "./services/building/service.ts";
import { createCashService } from "./services/cash/service.ts";
import { createDocumentService } from "./services/document/service.ts";
import { createEventService } from "./services/event/service.ts";
import { createFacilityService } from "./services/facility/service.ts";
import { createFeeRuleService } from "./services/feeRule/service.ts";
import { createOccupancyService } from "./services/occupancy/service.ts";
import { createOrganizationService } from "./services/organization/service.ts";
import { createOtpService } from "./services/otp/service.ts";
import { createPublicFacilityService } from "./services/publicFacility/service.ts";
import { createRbacService } from "./services/rbac/service.ts";
import { createResidentService } from "./services/resident/service.ts";
import { createRoomService } from "./services/room/service.ts";

export const storage = createLocalStorage(config.storageDir);

const emailQueue = createEmailQueue({
  onError: (error) => console.error("[emailQueue]", error),
});

const otp = createOtpService({
  secret: config.otpSecret,
  ttlSeconds: config.otpTtlSeconds,
  send: (email, code) => emailQueue.enqueue(() => sendOtpEmail(email, code)),
});

export const authService = createAuthService({
  users: userRepository,
  otp,
  assignResidentRole: async (userId) => {
    const role = await roleRepository.findByCode("CALON_PENGHUNI");
    if (!role) return;
    await userRoleRepository.assign({ userId, roleId: role.id });
  },
});

export const rbacService = createRbacService({
  roles: roleRepository,
  permissions: permissionRepository,
  menus: menuRepository,
  userRoles: userRoleRepository,
  rolePermissions: rolePermissionRepository,
  roleMenus: roleMenuRepository,
});

export const buildingService = createBuildingService({
  buildings: buildingRepository,
});

export const roomService = createRoomService({
  rooms: roomRepository,
  buildings: buildingRepository,
});

export const feeRuleService = createFeeRuleService({
  feeRules: feeRuleRepository,
  buildings: buildingRepository,
});

export const facilityService = createFacilityService({
  facilities: facilityRepository,
  roomFacilities: roomFacilityRepository,
  rooms: roomRepository,
});

export const publicFacilityService = createPublicFacilityService({
  publicFacilities: publicFacilityRepository,
  assignments: publicFacilityAssignmentRepository,
  buildings: buildingRepository,
  facilities: facilityRepository,
});

export const residentService = createResidentService({
  users: userRepository,
});

export const occupancyService = createOccupancyService({
  occupancies: occupancyRepository,
  rooms: roomRepository,
  buildings: buildingRepository,
  users: userRepository,
  feeRules: feeRuleRepository,
  assignments: publicFacilityAssignmentRepository,
});

export const billingService = createBillingService({
  invoices: invoiceRepository,
  payments: paymentRepository,
  occupancies: occupancyRepository,
  feeRules: feeRuleRepository,
  buildings: buildingRepository,
  users: userRepository,
  cashAccounts: cashAccountRepository,
  categories: categoryRepository,
  ledger: ledgerRepository,
  transaction: runTransaction,
});

export const cashService = createCashService({
  cashAccounts: cashAccountRepository,
  categories: categoryRepository,
  expenses: expenseRepository,
  ledger: ledgerRepository,
  buildings: buildingRepository,
  transaction: runTransaction,
});

export const eventService = createEventService({
  events: eventRepository,
  sessions: eventSessionRepository,
  committees: eventCommitteeRepository,
  attendances: eventAttendanceRepository,
  attachments: eventAttachmentRepository,
  buildings: buildingRepository,
  users: userRepository,
  positions: positionRepository,
  files: fileRepository,
  cash: cashService,
});

export const organizationService = createOrganizationService({
  periods: periodRepository,
  positions: positionRepository,
  positionAssignments: positionAssignmentRepository,
  roles: roleRepository,
  buildings: buildingRepository,
  users: userRepository,
  transaction: runTransaction,
});

export const documentService = createDocumentService({
  files: fileRepository,
  documentTypes: documentTypeRepository,
  submissions: documentRepository,
  storage,
  users: userRepository,
});

export { fileRepository };
