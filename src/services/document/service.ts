import { AppError } from "../../lib/errors.ts";
import { detectMime } from "../../lib/fileType.ts";
import type { Storage } from "../../lib/storage.ts";
import type { DocumentRepository } from "../../repositories/documents.ts";
import type { DocumentTypeRepository } from "../../repositories/documentTypes.ts";
import type { FileRepository } from "../../repositories/files.ts";
import type { UserRepository } from "../../repositories/users.ts";

type DocumentDeps = {
  files: FileRepository;
  documentTypes: DocumentTypeRepository;
  submissions: DocumentRepository;
  storage: Storage;
  users: UserRepository;
};

type CreateDocumentTypeInput = {
  buildingId: string;
  code: string;
  name: string;
  isRequiredByDefault?: boolean;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  sortOrder?: number;
};

type UploadInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export const createDocumentService = ({
  files,
  documentTypes,
  submissions,
  storage,
  users,
}: DocumentDeps) => {
  const getType = async (id: string) => {
    const type = await documentTypes.findById(id);
    if (!type) {
      throw new AppError("Document type not found", 404);
    }
    return type;
  };

  return {
    async createDocumentType(data: CreateDocumentTypeInput) {
      if (data.allowedMimeTypes.length === 0) {
        throw new AppError("allowedMimeTypes must not be empty", 400);
      }
      if (await documentTypes.findByBuildingCode(data.buildingId, data.code)) {
        throw new AppError("Document type code already exists in this building", 409);
      }
      return documentTypes.create(data);
    },

    listDocumentTypes(buildingId: string) {
      return documentTypes.listByBuilding(buildingId);
    },

    async requestDocument(
      userId: string,
      documentTypeId: string,
      requestedById?: string | null,
    ) {
      await getType(documentTypeId);
      const latest = await submissions.findLatest(userId, documentTypeId);
      if (latest && latest.status !== "VERIFIED") {
        return latest;
      }
      return submissions.create({
        userId,
        documentTypeId,
        status: "REQUESTED",
        requestedById: requestedById ?? null,
        version: (latest?.version ?? 0) + 1,
      });
    },

    async upload(userId: string, documentTypeId: string, file: UploadInput) {
      const type = await getType(documentTypeId);

      if (!type.allowedMimeTypes.includes(file.mimeType)) {
        throw new AppError("MIME type is not allowed", 400);
      }
      if (file.sizeBytes > type.maxSizeBytes) {
        throw new AppError("File exceeds the maximum size", 400);
      }
      const detected = detectMime(file.buffer);
      if (!detected || !type.allowedMimeTypes.includes(detected)) {
        throw new AppError("File content does not match an allowed type", 400);
      }

      const stored = await storage.put(file.buffer, file.originalName);
      const saved = await files.create({
        storageKey: stored.storageKey,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        uploadedById: userId,
      });

      const latest = await submissions.findLatest(userId, documentTypeId);
      if (latest && latest.status !== "VERIFIED") {
        return submissions.update(latest.id, {
          status: "UPLOADED",
          fileId: saved.id,
          rejectionReason: null,
        });
      }
      return submissions.create({
        userId,
        documentTypeId,
        status: "UPLOADED",
        fileId: saved.id,
        version: (latest?.version ?? 0) + 1,
      });
    },

    async verify(submissionId: string, adminId: string) {
      const submission = await submissions.findById(submissionId);
      if (!submission) {
        throw new AppError("Submission not found", 404);
      }
      if (submission.status !== "UPLOADED") {
        throw new AppError("Only UPLOADED submissions can be verified", 400);
      }
      return submissions.update(submissionId, {
        status: "VERIFIED",
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: null,
      });
    },

    async reject(submissionId: string, adminId: string, reason: string) {
      const submission = await submissions.findById(submissionId);
      if (!submission) {
        throw new AppError("Submission not found", 404);
      }
      if (submission.status !== "UPLOADED") {
        throw new AppError("Only UPLOADED submissions can be rejected", 400);
      }
      return submissions.update(submissionId, {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      });
    },

    listByUser(userId: string) {
      return submissions.listByUser(userId);
    },

    async listRequired(userId: string) {
      const user = await users.findById(userId);
      if (!user || !user.buildingId) {
        return [];
      }
      const types = await documentTypes.listRequiredByBuilding(user.buildingId);
      const result = [];
      for (const type of types) {
        let submission = await submissions.findLatest(userId, type.id);
        if (!submission) {
          submission = await submissions.create({
            userId,
            documentTypeId: type.id,
            status: "REQUESTED",
            version: 1,
          });
        }
        result.push({ documentType: type, submission });
      }
      return result;
    },
  };
};

export type DocumentService = ReturnType<typeof createDocumentService>;
