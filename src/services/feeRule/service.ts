import { AppError } from "../../lib/errors.ts";
import type { BuildingRepository } from "../../repositories/buildings.ts";
import type { FeeRuleRepository } from "../../repositories/feeRules.ts";

type FeeRuleDeps = {
  feeRules: FeeRuleRepository;
  buildings: BuildingRepository;
};

type CreateFeeRuleInput = {
  buildingId: string;
  dueDayOfMonth: number;
  defaultMonthlyRate: number;
  effectiveFrom: Date;
};

export const createFeeRuleService = ({ feeRules, buildings }: FeeRuleDeps) => ({
  async createFeeRule(data: CreateFeeRuleInput) {
    if (data.dueDayOfMonth < 1 || data.dueDayOfMonth > 28) {
      throw new AppError("dueDayOfMonth must be between 1 and 28", 400);
    }
    if (data.defaultMonthlyRate < 0) {
      throw new AppError("defaultMonthlyRate must not be negative", 400);
    }
    if (!(await buildings.findById(data.buildingId))) {
      throw new AppError("Building not found", 404);
    }
    return feeRules.create(data);
  },

  list(buildingIds?: string[]) {
    return feeRules.list(buildingIds);
  },

  findByBuilding(buildingId: string) {
    return feeRules.findByBuilding(buildingId);
  },

  findActive(buildingId: string, at: Date) {
    return feeRules.findActiveForBuilding(buildingId, at);
  },

  async getFeeRule(id: string) {
    const rule = await feeRules.findById(id);
    if (!rule) {
      throw new AppError("Fee rule not found", 404);
    }
    return rule;
  },

  softDeleteFeeRule(id: string) {
    return feeRules.softDelete(id);
  },
});

export type FeeRuleService = ReturnType<typeof createFeeRuleService>;
