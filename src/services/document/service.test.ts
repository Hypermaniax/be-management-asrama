import assert from "node:assert/strict";
import { test } from "node:test";
import { createDocumentService } from "./service.ts";

type Fakes = {
  findByBuildingCode?: () => Promise<unknown>;
  typeFindById?: () => Promise<unknown>;
  latest?: unknown;
  submissionFindById?: () => Promise<unknown>;
};

const makeService = (fakes: Fakes = {}) => {
  const deps = {
    files: {
      create: async (data: Record<string, unknown>) => ({ id: "file1", ...data }),
      findById: async () => null,
      softDelete: async (id: string) => ({ id }),
    },
    documentTypes: {
      create: async (data: Record<string, unknown>) => ({ id: "dt1", ...data }),
      findById:
        fakes.typeFindById ??
        (async () => ({
          id: "dt1",
          allowedMimeTypes: ["application/pdf"],
          maxSizeBytes: 1000,
        })),
      findByBuildingCode: fakes.findByBuildingCode ?? (async () => null),
      listByBuilding: async () => [],
      listRequiredByBuilding: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      softDelete: async (id: string) => ({ id }),
    },
    submissions: {
      create: async (data: Record<string, unknown>) => ({ id: "sub1", ...data }),
      findById: fakes.submissionFindById ?? (async () => null),
      findLatest: async () => fakes.latest ?? null,
      listByUser: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
    },
    storage: {
      put: async (_buffer: Buffer, originalName: string) => ({
        storageKey: `k/${originalName}`,
        checksum: "abc",
        sizeBytes: _buffer.byteLength,
      }),
      getStream: () => null,
      delete: async () => {},
    },
    users: {
      findById: async () => ({ id: "u1", buildingId: "b1" }),
    },
  };
  return createDocumentService(deps as never);
};

const typeInput = {
  buildingId: "b1",
  code: "KTP",
  name: "KTP",
  allowedMimeTypes: ["application/pdf"],
  maxSizeBytes: 2 * 1024 * 1024,
};

const pdf = Buffer.from("%PDF-1.4 dummy");

test("createDocumentType rejects empty allowedMimeTypes with 400", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.createDocumentType({ ...typeInput, allowedMimeTypes: [] }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("createDocumentType rejects a duplicate code with 409", async () => {
  const service = makeService({ findByBuildingCode: async () => ({ id: "dt1" }) });

  await assert.rejects(
    () => service.createDocumentType(typeInput),
    (err: { status?: number }) => err.status === 409,
  );
});

test("upload rejects a disallowed MIME with 400", async () => {
  const service = makeService();

  await assert.rejects(
    () =>
      service.upload("u1", "dt1", {
        buffer: pdf,
        originalName: "a.pdf",
        mimeType: "image/png",
        sizeBytes: 10,
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("upload rejects an oversized file with 400", async () => {
  const service = makeService();

  await assert.rejects(
    () =>
      service.upload("u1", "dt1", {
        buffer: pdf,
        originalName: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 5000,
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("upload rejects content that does not match an allowed type with 400", async () => {
  const service = makeService();

  await assert.rejects(
    () =>
      service.upload("u1", "dt1", {
        buffer: Buffer.from("not a pdf"),
        originalName: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 9,
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("upload passes through with a valid PDF", async () => {
  const service = makeService();

  const created = await service.upload("u1", "dt1", {
    buffer: pdf,
    originalName: "a.pdf",
    mimeType: "application/pdf",
    sizeBytes: pdf.byteLength,
  });

  assert.equal(created.status, "UPLOADED");
  assert.equal(created.fileId, "file1");
});

test("verify rejects a non-UPLOADED submission with 400", async () => {
  const service = makeService({
    submissionFindById: async () => ({ id: "sub1", status: "REQUESTED" }),
  });

  await assert.rejects(
    () => service.verify("sub1", "admin1"),
    (err: { status?: number }) => err.status === 400,
  );
});
