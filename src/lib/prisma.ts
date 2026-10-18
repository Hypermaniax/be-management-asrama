import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma } from "../generated/prisma/client.ts";
import { PrismaClient } from "../generated/prisma/client.ts";
import { config } from "./config.ts";

const adapter = new PrismaPg({ connectionString: config.databaseUrl });

export const prisma = new PrismaClient({ adapter });

export type Db = Prisma.TransactionClient;

export type TransactionRunner = <T>(fn: (tx: Db) => Promise<T>) => Promise<T>;

export const runTransaction: TransactionRunner = (fn) => prisma.$transaction(fn);
