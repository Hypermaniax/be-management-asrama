export type AuditInput = {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  path?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

export type AuditRecorder = {
  record(input: AuditInput): Promise<unknown>;
};

const SENSITIVE_KEYS = new Set(["password", "token", "secret", "passwordHash"]);

// Removes secrets before they are persisted to the audit trail.
export const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SENSITIVE_KEYS.has(key) ? "[redacted]" : redact(entry),
      ]),
    );
  }
  return value;
};
