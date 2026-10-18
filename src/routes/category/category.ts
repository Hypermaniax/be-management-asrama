import express from "express";
import { categoryController } from "../../controller/category.ts";
import { asyncHandler } from "../../lib/asyncHandler.ts";
import { resolveBuildingScope } from "../../middleware/buildingScope.ts";
import { crud } from "../../middleware/permission.ts";

export const router = express.Router();

router.use(resolveBuildingScope);

router.post("/", crud("category"), asyncHandler(categoryController.create));
router.get("/", crud("category"), asyncHandler(categoryController.list));
router.patch("/:id", crud("category"), asyncHandler(categoryController.update));
router.delete("/:id", crud("category"), asyncHandler(categoryController.remove));
