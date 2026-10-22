import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.ts";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const newRefreshToken = (): string => randomBytes(32).toString("hex");

export const refreshTokenRepository = {
  create(userId: string, token: string, expiresAt: Date) {
    return prisma.refreshToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  },

  // Finds a live (revokedAt null) refresh-token row for the given plaintext token.
  findLive(token: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
    });
  },

  // Finds any row for the given token (including revoked) — used for reuse detection.
  findAny(token: string) {
    return prisma.refreshToken.findFirst({ where: { tokenHash: hashToken(token) } });
  },

  revoke(id: string) {
    return prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // Theft-containment: a replayed token invalidates every session of the owner.
  revokeAllForUser(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
