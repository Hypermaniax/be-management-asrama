import type { AuditInput } from "../../lib/audit.ts";
import { redact } from "../../lib/audit.ts";
import { AppError } from "../../lib/errors.ts";
import type { AuditRepository, ListAuditFilters } from "../../repositories/audit.ts";

type AuditDeps = {
  audit: AuditRepository;
};

export const createAuditService = ({ audit }: AuditDeps) => ({
  record(input: AuditInput) {
    return audit.record({
      ...input,
      before: redact(input.before),
      after: redact(input.after),
    });
  },

  list(filters: ListAuditFilters = {}) {
    return audit.list(filters);
  },

  async getById(id: string) {
    const log = await audit.findById(id);
    if (!log) {
      throw new AppError("Audit log not found", 404);
    }
    return log;
  },
});

export type AuditService = ReturnType<typeof createAuditService>;
