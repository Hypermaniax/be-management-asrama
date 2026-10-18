import { AppError } from "../../lib/errors.ts";
import type { TransactionRunner } from "../../lib/prisma.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type { PeriodRepository } from "../../repositories/periods.ts";
import type { PositionAssignmentRepository } from "../../repositories/positionAssignments.ts";
import type { PositionRepository } from "../../repositories/positions.ts";
import type { RoleRepository } from "../../repositories/roles.ts";
import type { UserRepository } from "../../repositories/users.ts";

type OrganizationDeps = {
  periods: PeriodRepository;
  positions: PositionRepository;
  positionAssignments: PositionAssignmentRepository;
  roles: RoleRepository;
  buildings: BuildingRepository;
  users: UserRepository;
  transaction: TransactionRunner;
};

type CreatePeriodInput = {
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
  decreeNumber?: string | null;
};

type UpdatePeriodInput = {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  decreeNumber?: string | null;
};

type CreatePositionInput = {
  code: string;
  name: string;
  level?: number;
  buildingId?: string | null;
  roleId?: string | null;
  description?: string | null;
};

type UpdatePositionInput = {
  name?: string;
  level?: number;
  buildingId?: string | null;
  roleId?: string | null;
  description?: string | null;
  isActive?: boolean;
};

type AssignPositionInput = {
  periodId: string;
  positionId: string;
  userId: string;
  buildingId?: string | null;
  startDate: Date;
  decreeNumber?: string | null;
};

const assertRange = (startDate: Date, endDate: Date) => {
  if (endDate < startDate) {
    throw new AppError("endDate must be on or after startDate", 400);
  }
};

export const createOrganizationService = ({
  periods,
  positions,
  positionAssignments,
  roles,
  buildings,
  users,
  transaction,
}: OrganizationDeps) => {
  const getPeriod = async (id: string) => {
    const period = await periods.findById(id);
    if (!period) {
      throw new AppError("Period not found", 404);
    }
    return period;
  };

  const getPosition = async (id: string) => {
    const position = await positions.findById(id);
    if (!position) {
      throw new AppError("Position not found", 404);
    }
    return position;
  };

  const assertBuilding = async (buildingId?: string | null) => {
    if (buildingId && !(await buildings.findById(buildingId))) {
      throw new AppError("Building not found", 404);
    }
  };

  const assertRole = async (roleId?: string | null) => {
    if (roleId && !(await roles.findById(roleId))) {
      throw new AppError("Role not found", 404);
    }
  };

  const assertCodeFree = async (code: string, buildingId?: string | null) => {
    if (await positions.findByCode(code, buildingId)) {
      throw new AppError("Position code already exists in this scope", 409);
    }
  };

  return {
    async createPeriod({ code, name, startDate, endDate, decreeNumber }: CreatePeriodInput) {
      assertRange(startDate, endDate);
      if (await periods.findByCode(code)) {
        throw new AppError("Period code already exists", 409);
      }
      return periods.create({ code, name, startDate, endDate, decreeNumber: decreeNumber ?? null });
    },

    listPeriods() {
      return periods.list();
    },

    getPeriod,

    async updatePeriod(id: string, data: UpdatePeriodInput) {
      const period = await getPeriod(id);
      assertRange(data.startDate ?? period.startDate, data.endDate ?? period.endDate);
      return periods.update(id, data);
    },

    async activatePeriod(id: string) {
      await getPeriod(id);
      return transaction((tx) => periods.activate(id, tx));
    },

    async createPosition({ code, name, level, buildingId, roleId, description }: CreatePositionInput) {
      await assertBuilding(buildingId);
      await assertRole(roleId);
      await assertCodeFree(code, buildingId ?? null);
      return positions.create({
        code,
        name,
        level,
        buildingId: buildingId ?? null,
        roleId: roleId ?? null,
        description: description ?? null,
      });
    },

    listPositions(buildingIds?: string[]) {
      return positions.list(buildingIds);
    },

    getPosition,

    async updatePosition(id: string, data: UpdatePositionInput) {
      const position = await getPosition(id);
      if (data.roleId !== undefined) {
        await assertRole(data.roleId);
      }
      if (data.buildingId !== undefined && data.buildingId !== position.buildingId) {
        await assertBuilding(data.buildingId);
        await assertCodeFree(position.code, data.buildingId ?? null);
      }
      return positions.update(id, data);
    },

    async softDeletePosition(id: string) {
      await getPosition(id);
      return positions.softDelete(id);
    },

    async assignPosition({
      periodId,
      positionId,
      userId,
      buildingId,
      startDate,
      decreeNumber,
    }: AssignPositionInput) {
      await getPeriod(periodId);
      const position = await getPosition(positionId);
      if (!(await users.findById(userId))) {
        throw new AppError("User not found", 404);
      }
      const scopedBuildingId = position.buildingId ?? buildingId ?? null;
      await assertBuilding(scopedBuildingId);
      const existing = await positionAssignments.listByPosition(positionId);
      if (
        existing.some((a) => a.periodId === periodId && a.userId === userId && a.isActive)
      ) {
        throw new AppError("User is already assigned to this position for the period", 409);
      }
      return positionAssignments.create({
        periodId,
        positionId,
        userId,
        buildingId: scopedBuildingId,
        startDate,
        decreeNumber: decreeNumber ?? null,
      });
    },

    async getAssignment(id: string) {
      const assignment = await positionAssignments.findById(id);
      if (!assignment) {
        throw new AppError("Position assignment not found", 404);
      }
      return assignment;
    },

    async endAssignment(id: string, endDate?: Date) {
      const assignment = await positionAssignments.findById(id);
      if (!assignment) {
        throw new AppError("Position assignment not found", 404);
      }
      return positionAssignments.end(id, endDate ?? new Date());
    },

    listAssignmentsByUser(userId: string) {
      return positionAssignments.listByUser(userId);
    },

    async getStructure(periodId: string, buildingIds?: string[]) {
      const period = await getPeriod(periodId);
      const [positionList, assignments] = await Promise.all([
        positions.list(buildingIds),
        positionAssignments.listByPeriod(periodId),
      ]);
      return {
        period,
        positions: positionList.map((position) => ({
          ...position,
          holders: assignments
            .filter((a) => a.positionId === position.id && a.isActive)
            .map((a) => ({
              assignmentId: a.id,
              userId: a.userId,
              user: a.user,
              buildingId: a.buildingId,
              startDate: a.startDate,
              endDate: a.endDate,
              decreeNumber: a.decreeNumber,
            })),
        })),
      };
    },
  };
};

export type OrganizationService = ReturnType<typeof createOrganizationService>;
