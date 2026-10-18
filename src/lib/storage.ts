import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type StoredFile = {
  storageKey: string;
  checksum: string;
  sizeBytes: number;
};

export type Storage = {
  put(buffer: Buffer, originalName: string): Promise<StoredFile>;
  getStream(storageKey: string): NodeJS.ReadableStream;
  delete(storageKey: string): Promise<void>;
};

const checksumOf = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);

export const createLocalStorage = (baseDir: string): Storage => {
  const root = resolve(baseDir);

  const resolveKey = (storageKey: string) => {
    const full = resolve(join(root, storageKey));
    if (!full.startsWith(root)) {
      throw new Error("Invalid storage key");
    }
    return full;
  };

  return {
    async put(buffer, originalName) {
      const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName(originalName)}`;
      const full = resolveKey(key);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, buffer);
      return {
        storageKey: key,
        checksum: checksumOf(buffer),
        sizeBytes: buffer.byteLength,
      };
    },

    getStream(storageKey) {
      return createReadStream(resolveKey(storageKey));
    },

    async delete(storageKey) {
      await unlink(resolveKey(storageKey)).catch(() => undefined);
    },
  };
};
