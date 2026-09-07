import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { PrismaClient } from "@prisma/client";
import { db } from "./db";
import { assert } from "./domain";

export const digest = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export const manifestDigest = (value: unknown) => digest(canonical(value));
const root = () => path.resolve(/* turbopackIgnore: true */ process.env.MEDIA_LOCAL_PATH ?? "./data/media");
function s3() {
  assert(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY, "Private S3 storage is not configured.");
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined, region: process.env.S3_REGION ?? "us-east-1", forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
  });
}
async function write(key: string, data: Buffer) {
  if (process.env.MEDIA_DRIVER === "s3") {
    await s3().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: data, ContentType: "image/png" }));
  } else {
    await mkdir(root(), { recursive: true, mode: 0o700 });
    await writeFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ root(), key), data, { flag: "wx", mode: 0o600 });
  }
}
export async function readAsset(asset: { key: string; sha256: string }) {
  assert(/^[a-f0-9-]+\.png$/.test(asset.key), "Invalid asset key.", 500);
  const data = process.env.MEDIA_DRIVER === "s3"
    ? Buffer.from(await (await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: asset.key }))).Body!.transformToByteArray())
    : await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ root(), asset.key));
  assert(digest(data) === asset.sha256, "The stored asset failed its integrity check. Export blocked.", 409);
  return data;
}
export async function ownedAsset(ownerId: string, id: string) {
  const asset = await db.asset.findFirst({ where: { id, ownerId } });
  assert(asset, "Asset not found.", 404);
  return asset;
}
export async function deleteStoredAsset(key: string) {
  assert(/^[a-f0-9-]+\.png$/.test(key), "Invalid asset key.", 500);
  if (process.env.MEDIA_DRIVER === "s3") {
    await s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  } else {
    await rm(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ root(), key), { force: true });
  }
}
export async function saveAsset(ownerId: string, data: Buffer, width: number, height: number, provenance: string, client: Pick<PrismaClient, "asset"> = db) {
  const key = `${randomUUID()}.png`;
  await write(key, data);
  try {
    return await client.asset.create({ data: {
      ownerId, key, sha256: digest(data), mime: "image/png", width, height, provenance,
      license: "Procedural studio artwork; no third-party photograph or image model.",
    } });
  } catch (error) {
    await deleteStoredAsset(key);
    throw error;
  }
}
