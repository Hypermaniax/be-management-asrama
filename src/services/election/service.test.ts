import assert from "node:assert/strict";
import { test } from "node:test";
import { createElectionService } from "./service.ts";

type Fakes = {
  election?: unknown;
  existingByCode?: unknown;
  openInScope?: unknown;
  eligible?: unknown[];
  userRoles?: unknown[];
  occupancy?: unknown;
  vote?: unknown;
  candidate?: unknown;
  existingCandidate?: unknown;
  candidates?: unknown[];
  votes?: unknown[];
  roleByCode?: unknown;
  role?: unknown;
  position?: unknown;
  positionAssignments?: unknown[];
};

const makeService = (fakes: Fakes = {}) => {
  const statuses: { id: string; status: string }[] = [];
  const savedResults: unknown[] = [];
  const createdAssignments: Record<string, unknown>[] = [];
  const eligibleSet: { electionId: string; roleIds: string[] }[] = [];

  const deps = {
    elections: {
      create: async (data: Record<string, unknown>) => ({ id: "el1", ...data }),
      findById: async () =>
        fakes.election === undefined
          ? {
              id: "el1",
              status: "OPEN",
              buildingId: null,
              periodId: "p1",
              allowAbstain: true,
              startAt: new Date("2026-01-01"),
              endAt: new Date("2026-01-31"),
            }
          : fakes.election,
      findByCode: async () => fakes.existingByCode ?? null,
      findOpenByScope: async () => fakes.openInScope ?? null,
      list: async () => [],
      update: async (id: string, data: Record<string, unknown>) => ({ id, ...data }),
      setStatus: async (id: string, status: string) => {
        statuses.push({ id, status });
        return { id, status };
      },
      softDelete: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    eligibleRoles: {
      setForElection: async (electionId: string, roleIds: string[]) => {
        eligibleSet.push({ electionId, roleIds });
      },
      listByElection: async () =>
        fakes.eligible ?? [{ electionId: "el1", roleId: "r-penghuni", role: { code: "PENGHUNI" } }],
    },
    candidates: {
      add: async (data: Record<string, unknown>) => ({ id: "c1", ...data }),
      findById: async () =>
        fakes.candidate === undefined
          ? { id: "c1", electionId: "el1", userId: "u1" }
          : fakes.candidate,
      findByUser: async () => fakes.existingCandidate ?? null,
      listByElection: async () => fakes.candidates ?? [],
      remove: async (id: string) => ({ id, deletedAt: new Date() }),
    },
    votes: {
      cast: async (data: Record<string, unknown>) => ({ id: "v1", ...data }),
      findByVoter: async () => fakes.vote ?? null,
      listByElection: async () => fakes.votes ?? [],
      countByCandidate: async () => [],
    },
    results: {
      saveMany: async (_electionId: string, rows: unknown[]) => {
        savedResults.push(...rows);
        return rows;
      },
      listByElection: async () => savedResults,
    },
    users: {
      findById: async () => ({ id: "u1" }),
    },
    userRoles: {
      listByUser: async () =>
        fakes.userRoles ?? [{ roleId: "r-penghuni", role: { code: "PENGHUNI" } }],
    },
    roles: {
      findByCode: async () =>
        fakes.roleByCode === undefined ? { id: "r-penghuni", code: "PENGHUNI" } : fakes.roleByCode,
      findById: async () => (fakes.role === undefined ? { id: "r-penghuni" } : fakes.role),
    },
    occupancies: {
      findActiveByUser: async () => (fakes.occupancy === undefined ? { id: "occ1" } : fakes.occupancy),
    },
    periods: {
      findById: async () => ({ id: "p1" }),
    },
    buildings: {
      findById: async () => ({ id: "b1" }),
    },
    positions: {
      findById: async () =>
        fakes.position === undefined
          ? { id: "pos-ketua", code: "KETUA", buildingId: null }
          : fakes.position,
    },
    positionAssignments: {
      create: async (data: Record<string, unknown>) => {
        createdAssignments.push(data);
        return { id: "pa1", ...data };
      },
      listByPosition: async () => fakes.positionAssignments ?? [],
      end: async (id: string) => ({ id, isActive: false }),
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  };

  return {
    service: createElectionService(deps as never),
    statuses,
    savedResults,
    createdAssignments,
    eligibleSet,
  };
};

test("createElection defaults eligible role to PENGHUNI", async () => {
  const { service, eligibleSet } = makeService();

  await service.createElection({
    code: "KETUA-2026",
    title: "Pemilihan Ketua 2026",
    startAt: new Date("2026-01-01"),
    endAt: new Date("2026-01-31"),
    createdById: "admin",
  });

  assert.deepEqual(eligibleSet, [{ electionId: "el1", roleIds: ["r-penghuni"] }]);
});

test("createElection rejects a duplicate code with 409", async () => {
  const { service } = makeService({ existingByCode: { id: "el0" } });

  await assert.rejects(
    () =>
      service.createElection({
        code: "KETUA-2026",
        title: "Pemilihan Ketua 2026",
        startAt: new Date("2026-01-01"),
        endAt: new Date("2026-01-31"),
        createdById: "admin",
      }),
    (err: { status?: number }) => err.status === 409,
  );
});

test("castVote rejects a second vote from the same voter with 409", async () => {
  const { service } = makeService({ vote: { id: "v0" } });

  await assert.rejects(
    () => service.castVote("el1", "u1", "c1"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("castVote rejects a voter whose role is not eligible with 403", async () => {
  const { service } = makeService({
    userRoles: [{ roleId: "r-calon", role: { code: "CALON_PENGHUNI" } }],
  });

  await assert.rejects(
    () => service.castVote("el1", "u1", "c1"),
    (err: { status?: number }) => err.status === 403,
  );
});

test("castVote rejects an eligible voter without an active occupancy with 403", async () => {
  const { service } = makeService({ occupancy: null });

  await assert.rejects(
    () => service.castVote("el1", "u1", "c1"),
    (err: { status?: number }) => err.status === 403,
  );
});

test("castVote rejects abstain when abstain is not allowed with 400", async () => {
  const { service } = makeService({
    election: {
      id: "el1",
      status: "OPEN",
      buildingId: null,
      periodId: "p1",
      allowAbstain: false,
    },
  });

  await assert.rejects(
    () => service.castVote("el1", "u1", null),
    (err: { status?: number }) => err.status === 400,
  );
});

test("castVote rejects when the election is not open with 409", async () => {
  const { service } = makeService({
    election: { id: "el1", status: "DRAFT", allowAbstain: true },
  });

  await assert.rejects(
    () => service.castVote("el1", "u1", "c1"),
    (err: { status?: number }) => err.status === 409,
  );
});

test("castVote records a vote from an eligible active resident", async () => {
  const { service } = makeService();

  const vote = await service.castVote("el1", "u1", "c1");

  assert.equal((vote as { candidateId: string }).candidateId, "c1");
  assert.equal((vote as { voterId: string }).voterId, "u1");
});

test("getResult is forbidden before the election is closed with 403", async () => {
  const { service } = makeService();

  await assert.rejects(
    () => service.getResult("el1"),
    (err: { status?: number }) => err.status === 403,
  );
});

test("closeElection records ranked results including abstain", async () => {
  const { service, statuses, savedResults } = makeService({
    election: { id: "el1", status: "OPEN", periodId: "p1", allowAbstain: true },
    candidates: [
      { id: "c1", userId: "u1" },
      { id: "c2", userId: "u2" },
    ],
    votes: [
      { candidateId: "c1" },
      { candidateId: "c1" },
      { candidateId: null },
    ],
  });

  await service.closeElection("el1");

  assert.deepEqual(statuses, [{ id: "el1", status: "CLOSED" }]);
  assert.equal(savedResults.length, 3);
  const top = savedResults[0] as { candidateId: string; votes: number; rank: number };
  assert.equal(top.candidateId, "c1");
  assert.equal(top.votes, 2);
  assert.equal(top.rank, 1);
});

test("finalize assigns the winner to the KETUA position and marks DONE", async () => {
  const { service, createdAssignments, statuses } = makeService({
    election: { id: "el1", status: "CLOSED", periodId: "p1", buildingId: null },
    candidate: { id: "c1", electionId: "el1", userId: "u1" },
  });

  const result = await service.finalize("el1", { candidateId: "c1", positionId: "pos-ketua" });

  assert.equal(createdAssignments.length, 1);
  assert.equal(createdAssignments[0].positionId, "pos-ketua");
  assert.equal(createdAssignments[0].userId, "u1");
  assert.equal(createdAssignments[0].periodId, "p1");
  assert.deepEqual(statuses, [{ id: "el1", status: "DONE" }]);
  assert.equal((result as { assignment: { id: string } }).assignment.id, "pa1");
});

test("finalize rejects a tie without an explicit candidate with 409", async () => {
  const { service } = makeService({
    election: { id: "el1", status: "CLOSED", periodId: "p1", buildingId: null },
    candidates: [
      { id: "c1", userId: "u1" },
      { id: "c2", userId: "u2" },
    ],
    votes: [{ candidateId: "c1" }, { candidateId: "c2" }],
  });

  await assert.rejects(
    () => service.finalize("el1", { positionId: "pos-ketua" }),
    (err: { status?: number }) => err.status === 409,
  );
});

test("addCandidate rejects a non-resident with 400", async () => {
  const { service } = makeService({
    election: { id: "el1", status: "DRAFT", allowAbstain: true },
    occupancy: null,
  });

  await assert.rejects(
    () => service.addCandidate("el1", { userId: "u1" }),
    (err: { status?: number }) => err.status === 400,
  );
});

test("addCandidate rejects a duplicate candidate with 409", async () => {
  const { service } = makeService({
    election: { id: "el1", status: "DRAFT", allowAbstain: true },
    existingCandidate: { id: "c0" },
  });

  await assert.rejects(
    () => service.addCandidate("el1", { userId: "u1" }),
    (err: { status?: number }) => err.status === 409,
  );
});
