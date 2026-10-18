import { AppError } from "../../lib/errors.ts";
import type { BuildingRepository, Gender } from "../../repositories/buildings.ts";

type BuildingDeps = {
  buildings: BuildingRepository;
};

export const createBuildingService = ({ buildings }: BuildingDeps) => ({
  async createBuilding(data: {
    code: string;
    name: string;
    gender: Gender;
    address: string;
  }) {
    if (await buildings.findByCode(data.code)) {
      throw new AppError("Building code already exists", 409);
    }
    return buildings.create(data);
  },

  list() {
    return buildings.list();
  },

  async updateBuilding(
    id: string,
    data: {
      name?: string;
      gender?: Gender;
      address?: string;
      isActive?: boolean;
    },
  ) {
    const building = await buildings.findById(id);
    if (!building) {
      throw new AppError("Building not found", 404);
    }
    return buildings.update(id, data);
  },

  async softDeleteBuilding(id: string) {
    const building = await buildings.findById(id);
    if (!building) {
      throw new AppError("Building not found", 404);
    }
    return buildings.softDelete(id);
  },
});

export type BuildingService = ReturnType<typeof createBuildingService>;
