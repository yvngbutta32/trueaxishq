import fs from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

export function normalizeKey(relKey: string): string {
  const key = relKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !key ||
    key.length > 512 ||
    key.includes("..") ||
    key.startsWith("/") ||
    key.endsWith("/") ||
    key.split("/").some((segment) => !segment || segment === ".") ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key)
  ) {
    throw new Error("Invalid storage key");
  }
  return key;
}

export function getUploadPath(relKey: string): string {
  const key = normalizeKey(relKey);
  const root = path.resolve(ENV.uploadDir);
  const target = path.resolve(root, key);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid storage key");
  return target;
}

async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(path.resolve(ENV.uploadDir), { recursive: true });
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const filePath = getUploadPath(key);
  await ensureUploadDir();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, typeof data === "string" ? data : Buffer.from(data));
  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}
