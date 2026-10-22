import assert from "node:assert/strict";
import { test } from "node:test";
import { createBillingService } from "./service.ts";

type Outstanding = {
  id: string;
  buildingId: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: Date;
};

type Fakes = {
  building?: unknown;
  feeRule?: unknown;
  active?: unknown[];
  existingInvoice?: unknown;
  existingPayment?: unknown;
  user?: unknown;
  outstanding?: Outstanding[];
  invoice?: unknown;
  cashAccount?: unknown;
  pending?: unknown;
  submission?: unknown;
  proofFile?: unknown;
};

const future = new Date("2099-01-01");

const makeService = (fakes: Fakes = {}) => {
  const recorded: {
    data: Record<string, unknown>;
    allocations: { invoiceId: string; amount: number }[];
    updates: { id: string; paidAmount: number; status: string }[];
  }[] = [];
  const ledgerPosted: Record<string, unknown>[] = [];
  const submissionsCreated: Record<string, unknown>[] = [];
  const submissionsRejected: { id: string; reviewerId: string; reason: string }[] = [];
  const submissionsAttached: { id: string; paymentId: string }[] = [];
  const proofsStored: Record<string, unknown>[] = [];

  const deps = {
    invoices: {
      create: async (data: Record<string, unknown>) => ({ id: "i1", ...data }),
      findById: async () =>
        fakes.invoice === undefined
          ? { id: "i1", status: "ISSUED", paidAmount: 0 }
          : fakes.invoice,
      findActiveByUserPeriod: async () => fakes.existingInvoice ?? null,
      listOutstandingByUser: async () => fakes.outstanding ?? [],
      listByUser: async () => [],
      list: async () => [],
      updatePaymentState: async () => ({}),
      void: async (id: string) => ({ id, status: "VOID" }),
    },
    payments: {
      record: async (
        data: Record<string, unknown>,
        allocations: { invoiceId: string; amount: number }[],
        updates: { id: string; paidAmount: number; status: string }[],
      ) => {
        recorded.push({ data, allocations, updates });
        return { id: "p1", ...data, allocations };
      },
      findById: async () => ({ id: "p1" }),
      findByIdempotencyKey: async () => fakes.existingPayment ?? null,
      list: async () => [],
    },
    paymentSubmissions: {
      create: async (data: Record<string, unknown>) => {
        submissionsCreated.push(data);
        return { id: "s1", status: "PENDING", ...data };
      },
      findById: async () =>
        fakes.submission === undefined ? null : fakes.submission,
      findPendingByInvoice: async () => fakes.pending ?? null,
      list: async () => [],
      listByUser: async () => [],
      claimPending: async () => ({ count: 1 }),
      attachPayment: async (id: string, paymentId: string) => {
        submissionsAttached.push({ id, paymentId });
        return { id, paymentId };
      },
      reject: async (id: string, reviewerId: string, reason: string) => {
        submissionsRejected.push({ id, reviewerId, reason });
        return { id, status: "REJECTED", reviewNote: reason };
      },
    },
    files: {
      findById: async () =>
        fakes.proofFile === undefined
          ? { id: "f1", uploadedById: "u1" }
          : fakes.proofFile,
      create: async (data: Record<string, unknown>) => {
        proofsStored.push(data);
        return { id: "f1", ...data };
      },
    },
    storage: {
      put: async (buffer: Buffer, originalName: string) => ({
        storageKey: `key-${originalName}`,
        checksum: "checksum",
        sizeBytes: buffer.length,
      }),
    },
    occupancies: {
      listActiveByBuilding: async () =>
        fakes.active ?? [
          { id: "o1", userId: "u1", monthlyRateSnapshot: 350000, room: { buildingId: "b1" } },
        ],
    },
    feeRules: {
      findActiveForBuilding: async () =>
        fakes.feeRule === undefined ? { dueDayOfMonth: 10 } : fakes.feeRule,
    },
    buildings: {
      findById: async () => (fakes.building === undefined ? { id: "b1" } : fakes.building),
    },
    users: {
      findById: async () =>
        fakes.user === undefined ? { id: "u1", buildingId: "b1" } : fakes.user,
    },
    cashAccounts: {
      findById: async () =>
        fakes.cashAccount === undefined
          ? { id: "ca1", buildingId: "b1" }
          : fakes.cashAccount,
      findByBuildingId: async () =>
        fakes.cashAccount === undefined
          ? { id: "ca1", buildingId: "b1" }
          : fakes.cashAccount,
    },
    categories: {
      findByName: async () => ({ id: "cat1", kind: "INCOME", buildingId: "b1" }),
      list: async () => [{ id: "cat1", kind: "INCOME", buildingId: "b1" }],
    },
    ledger: {
      create: async (data: Record<string, unknown>) => {
        ledgerPosted.push(data);
        return { id: "le1", ...data };
      },
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  };
  return {
    service: createBillingService(deps as never),
    recorded,
    ledgerPosted,
    submissionsCreated,
    submissionsRejected,
    submissionsAttached,
    proofsStored,
  };
};

const paymentInput = {
  userId: "u1",
  amount: 300000,
  method: "CASH" as const,
  idempotencyKey: "key-1",
};

test("generateMonthly rejects an out-of-range month with 400", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.generateMonthly({ buildingId: "b1", year: 2026, month: 13 }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("generateMonthly rejects a missing building with 404", async () => {
  const { service } = makeService({ building: null });

  await assert.rejects(
    () => service.generateMonthly({ buildingId: "b1", year: 2026, month: 1 }),
    (err: { status?: number }) => err.status === 404,
  );
});

test("generateMonthly rejects a building without an active fee rule with 409", async () => {
  const { service } = makeService({ feeRule: null });

  await assert.rejects(
    () => service.generateMonthly({ buildingId: "b1", year: 2026, month: 1 }),
    (err: { status?: number }) => err.status === 409,
  );
});

test("generateMonthly snapshots the occupancy rate into the invoice", async () => {
  const { service } = makeService();

  const created = await service.generateMonthly({ buildingId: "b1", year: 2026, month: 1 });

  assert.equal(created.length, 1);
  assert.equal(created[0].baseAmount, 350000);
  assert.equal(created[0].totalAmount, 350000);
});

test("generateMonthly skips a period that already has an invoice", async () => {
  const { service } = makeService({ existingInvoice: { id: "i0" } });

  const created = await service.generateMonthly({ buildingId: "b1", year: 2026, month: 1 });

  assert.equal(created.length, 0);
});

test("recordPayment rejects a non-positive amount with 400", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.recordPayment({ ...paymentInput, amount: 0 }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("recordPayment rejects a missing user with 404", async () => {
  const { service } = makeService({ user: null });

  await assert.rejects(
    () => service.recordPayment(paymentInput),
    (err: { status?: number }) => err.status === 404,
  );
});

test("recordPayment returns the existing payment for a repeated idempotency key", async () => {
  const { service, recorded } = makeService({ existingPayment: { id: "p0" } });

  const payment = await service.recordPayment(paymentInput);

  assert.equal(payment.id, "p0");
  assert.equal(recorded.length, 0);
});

test("recordPayment auto-allocates across outstanding invoices and settles them", async () => {
  const { service, recorded } = makeService({
    outstanding: [
      { id: "i1", buildingId: "b1", totalAmount: 300000, paidAmount: 0, dueDate: future },
      { id: "i2", buildingId: "b1", totalAmount: 300000, paidAmount: 0, dueDate: future },
    ],
  });

  await service.recordPayment({ ...paymentInput, amount: 500000 });

  assert.deepEqual(recorded[0].allocations, [
    { invoiceId: "i1", amount: 300000 },
    { invoiceId: "i2", amount: 200000 },
  ]);
  assert.deepEqual(recorded[0].updates, [
    { id: "i1", paidAmount: 300000, status: "PAID" },
    { id: "i2", paidAmount: 200000, status: "PARTIAL" },
  ]);
});

test("recordPayment rejects an allocation for a non-outstanding invoice with 400", async () => {
  const { service } = makeService({ outstanding: [] });

  await assert.rejects(
    () =>
      service.recordPayment({
        ...paymentInput,
        allocations: [{ invoiceId: "ghost", amount: 1000 }],
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("recordPayment rejects an allocation above the invoice remaining with 400", async () => {
  const { service } = makeService({
    outstanding: [
      { id: "i1", buildingId: "b1", totalAmount: 300000, paidAmount: 250000, dueDate: future },
    ],
  });

  await assert.rejects(
    () =>
      service.recordPayment({
        ...paymentInput,
        amount: 100000,
        allocations: [{ invoiceId: "i1", amount: 100000 }],
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("recordPayment rejects when the building has no cash account with 409", async () => {
  const { service } = makeService({
    outstanding: [{ id: "i1", buildingId: "b1", totalAmount: 300000, paidAmount: 0, dueDate: future }],
    cashAccount: null,
  });

  await assert.rejects(
    () => service.recordPayment(paymentInput),
    (err: { status?: number }) => err.status === 409,
  );
});

test("recordPayment posts an IN ledger entry for the payment", async () => {
  const { service, ledgerPosted } = makeService({
    outstanding: [{ id: "i1", buildingId: "b1", totalAmount: 300000, paidAmount: 0, dueDate: future }],
  });

  await service.recordPayment(paymentInput);

  assert.equal(ledgerPosted.length, 1);
  assert.equal(ledgerPosted[0].direction, "IN");
  assert.equal(ledgerPosted[0].amount, 300000);
  assert.equal(ledgerPosted[0].sourceType, "PAYMENT");
  assert.equal(ledgerPosted[0].cashAccountId, "ca1");
});

test("voidInvoice rejects a missing invoice with 404", async () => {
  const { service } = makeService({ invoice: null });

  await assert.rejects(
    () => service.voidInvoice("missing"),
    (err: { status?: number }) => err.status === 404,
  );
});

test("voidInvoice rejects an invoice that already has payments with 409", async () => {
  const { service } = makeService({
    invoice: { id: "i1", status: "ISSUED", paidAmount: 1000 },
  });

  await assert.rejects(
    () => service.voidInvoice("i1"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("voidInvoice voids an unpaid invoice", async () => {
  const { service } = makeService();

  const voided = await service.voidInvoice("i1");

  assert.equal(voided.status, "VOID");
});

const openInvoice = {
  id: "i1",
  code: "INV-1",
  userId: "u1",
  buildingId: "b1",
  periodYear: 2026,
  periodMonth: 1,
  dueDate: future,
  totalAmount: 300000,
  paidAmount: 0,
  status: "ISSUED",
};

const pendingSubmission = {
  id: "s1",
  code: "SUB-1",
  userId: "u1",
  invoiceId: "i1",
  amount: 300000,
  method: "TRANSFER",
  referenceNo: null,
  proofFileId: "f1",
  note: null,
  status: "PENDING",
  reviewedById: null,
  reviewedAt: null,
  paymentId: null,
  payment: null,
};

const submissionInput = {
  invoiceId: "i1",
  amount: 300000,
  method: "TRANSFER" as const,
  proofFileId: "f1",
};

test("createSubmission rejects an invoice owned by another user with 403", async () => {
  const { service } = makeService({
    invoice: { ...openInvoice, userId: "u2" },
  });

  await assert.rejects(
    () => service.createSubmission("u1", submissionInput),
    (err: { status?: number }) => err.status === 403,
  );
});

test("createSubmission rejects a settled invoice with 409", async () => {
  const { service } = makeService({
    invoice: { ...openInvoice, status: "PAID" },
  });

  await assert.rejects(
    () => service.createSubmission("u1", submissionInput),
    (err: { status?: number }) => err.status === 409,
  );
});

test("createSubmission requires the full invoice remaining amount", async () => {
  const { service } = makeService({ invoice: openInvoice });

  await assert.rejects(
    () => service.createSubmission("u1", { ...submissionInput, amount: 100000 }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("createSubmission rejects a proof owned by another user with 403", async () => {
  const { service } = makeService({
    invoice: openInvoice,
    proofFile: { id: "f1", uploadedById: "u2" },
  });

  await assert.rejects(
    () => service.createSubmission("u1", submissionInput),
    (err: { status?: number }) => err.status === 403,
  );
});

test("createSubmission rejects a second pending submission for the invoice", async () => {
  const { service } = makeService({
    invoice: openInvoice,
    pending: { id: "s0" },
  });

  await assert.rejects(
    () => service.createSubmission("u1", submissionInput),
    (err: { status?: number }) => err.status === 409,
  );
});

test("createSubmission stores a PENDING submission with a SUB code", async () => {
  const { service, submissionsCreated } = makeService({ invoice: openInvoice });

  const created = await service.createSubmission("u1", submissionInput);

  assert.equal(created.status, "PENDING");
  assert.match(String(created.code), /^SUB-/);
  assert.equal(submissionsCreated[0].invoiceId, "i1");
  assert.equal(submissionsCreated[0].amount, 300000);
});

test("verifySubmission settles the invoice and posts a payment and ledger entry", async () => {
  const { service, recorded, ledgerPosted, submissionsAttached } = makeService({
    invoice: openInvoice,
    submission: pendingSubmission,
  });

  const result = await service.verifySubmission("s1", "admin1");

  assert.equal(result.payment?.id, "p1");
  assert.equal(recorded[0].data.idempotencyKey, "submission:s1");
  assert.deepEqual(recorded[0].allocations, [{ invoiceId: "i1", amount: 300000 }]);
  assert.deepEqual(recorded[0].updates, [
    { id: "i1", paidAmount: 300000, status: "PAID" },
  ]);
  assert.equal(ledgerPosted[0].direction, "IN");
  assert.equal(ledgerPosted[0].amount, 300000);
  assert.equal(ledgerPosted[0].sourceType, "PAYMENT");
  assert.deepEqual(submissionsAttached, [{ id: "s1", paymentId: "p1" }]);
});

test("verifySubmission is idempotent once verified", async () => {
  const { service, recorded } = makeService({
    submission: {
      ...pendingSubmission,
      status: "VERIFIED",
      paymentId: "p9",
      payment: { id: "p9" },
    },
  });

  const result = await service.verifySubmission("s1", "admin1");

  assert.equal(result.payment?.id, "p9");
  assert.equal(recorded.length, 0);
});

test("verifySubmission rejects a stale amount with 409", async () => {
  const { service } = makeService({
    invoice: { ...openInvoice, paidAmount: 100000 },
    submission: pendingSubmission,
  });

  await assert.rejects(
    () => service.verifySubmission("s1", "admin1"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("rejectSubmission stores the reason without posting a ledger entry", async () => {
  const { service, submissionsRejected, ledgerPosted } = makeService({
    submission: pendingSubmission,
  });

  const rejected = await service.rejectSubmission("s1", "admin1", "Bukti buram");

  assert.equal(rejected.status, "REJECTED");
  assert.deepEqual(submissionsRejected, [
    { id: "s1", reviewerId: "admin1", reason: "Bukti buram" },
  ]);
  assert.equal(ledgerPosted.length, 0);
});

test("rejectSubmission refuses a non-pending submission with 409", async () => {
  const { service } = makeService({
    submission: { ...pendingSubmission, status: "VERIFIED" },
  });

  await assert.rejects(
    () => service.rejectSubmission("s1", "admin1", "late"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("uploadProof rejects content that does not match an allowed type", async () => {
  const { service } = makeService();

  await assert.rejects(
    () =>
      service.uploadProof("u1", {
        buffer: Buffer.from("not an image"),
        originalName: "proof.png",
        mimeType: "image/png",
        sizeBytes: 12,
      }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("uploadProof stores the detected MIME type", async () => {
  const { service, proofsStored } = makeService();

  const file = await service.uploadProof("u1", {
    buffer: Buffer.from("%PDF-1.4"),
    originalName: "proof.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8,
  });

  assert.equal(file.id, "f1");
  assert.equal(proofsStored[0].mimeType, "application/pdf");
  assert.equal(proofsStored[0].uploadedById, "u1");
});
