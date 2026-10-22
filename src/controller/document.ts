import type { Request, Response } from "express";
import { documentService, fileRepository, storage } from "../container.ts";
import { AppError } from "../lib/errors.ts";
import { permissionCode } from "../lib/permission.ts";
import { assertBuildingAccess } from "../middleware/buildingScope.ts";
import type { AccessRequest } from "../middleware/permission.ts";
import {
  createDocumentTypeSchema,
  listDocumentQuerySchema,
  listDocumentTypeQuerySchema,
  rejectDocumentSchema,
  requestDocumentSchema,
  uploadDocumentSchema,
} from "../validations/document.ts";

const paramId = (value: string | string[] | undefined): string => {
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid id", 400);
  }
  return value;
};

const userId = (req: Request): string => {
  const { user } = req as AccessRequest;
  if (!user) {
    throw new AppError("Unauthorized", 401);
  }
  return user.id;
};

export const documentController = {
  async createType(req: Request, res: Response) {
    const data = createDocumentTypeSchema.parse(req.body);
    assertBuildingAccess(req, data.buildingId);
    const type = await documentService.createDocumentType(data);
    res.status(201).json({ status: "document type created", data: type });
  },

  async listTypes(req: Request, res: Response) {
    const { buildingId } = listDocumentTypeQuerySchema.parse(req.query);
    assertBuildingAccess(req, buildingId);
    const data = await documentService.listDocumentTypes(buildingId);
    res.json({ status: "ok", data });
  },

  async request(req: Request, res: Response) {
    const { userId: targetUserId, documentTypeId } = requestDocumentSchema.parse(req.body);
    const data = await documentService.requestDocument(
      targetUserId,
      documentTypeId,
      userId(req),
    );
    res.status(201).json({ status: "document requested", data });
  },

  async upload(req: Request, res: Response) {
    const { documentTypeId } = uploadDocumentSchema.parse(req.body);
    if (!req.file) {
      throw new AppError("File is required", 400);
    }
    const data = await documentService.upload(userId(req), documentTypeId, {
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });
    res.status(201).json({ status: "document uploaded", data });
  },

  async verify(req: Request, res: Response) {
    const data = await documentService.verify(paramId(req.params.id), userId(req));
    res.json({ status: "document verified", data });
  },

  async reject(req: Request, res: Response) {
    const { reason } = rejectDocumentSchema.parse(req.body);
    const data = await documentService.reject(paramId(req.params.id), userId(req), reason);
    res.json({ status: "document rejected", data });
  },

  async list(req: Request, res: Response) {
    const { userId: targetUserId } = listDocumentQuerySchema.parse(req.query);
    const data = await documentService.listByUser(targetUserId);
    res.json({ status: "ok", data });
  },

  async listRequired(req: Request, res: Response) {
    const data = await documentService.listRequired(userId(req));
    res.json({ status: "ok", data });
  },

  async download(req: Request, res: Response) {
    const file = await fileRepository.findById(paramId(req.params.id));
    if (!file) {
      throw new AppError("File not found", 404);
    }
    const { access, user } = req as AccessRequest;
    const isStaff =
      access?.isSuperAdmin ||
      Boolean(access?.permissions.has(permissionCode("document", "VERIFY")));
    if (!isStaff && file.uploadedById !== user?.id) {
      throw new AppError("Forbidden", 403);
    }
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );
    storage.getStream(file.storageKey).pipe(res);
  },
};
