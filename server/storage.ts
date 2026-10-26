import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { optimizeImage } from "./images.js";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { config } from "./config.js";
import { db } from "./db.js";
import { defaultSettings } from "./validation.js";
import { HttpError } from "./security.js";
const s3 =
  config.STORAGE_DRIVER === "s3"
    ? new S3Client({
        endpoint: config.S3_ENDPOINT,
        region: config.S3_REGION,
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.S3_ACCESS_KEY!,
          secretAccessKey: config.S3_SECRET_KEY!,
        },
      })
    : null;
export async function putObject(key: string, body: Buffer) {
  if (s3)
    await s3.send(
      new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: "image/webp",
      }),
    );
  else {
    await mkdir(resolve("uploads"), { recursive: true });
    await writeFile(resolve("uploads", key), body);
  }
}
export async function getObject(key: string) {
  if (s3) {
    const r = await s3.send(
      new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
    );
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  return readFile(resolve("uploads", key));
}
export async function settings(client: Pick<Prisma.TransactionClient, "siteSetting"> = db) {
  const s = await client.siteSetting.findUnique({ where: { id: "site" } });
  return { ...defaultSettings, ...(s?.value as object) };
}
export async function processUpload(userId: string, buffer: Buffer) {
  const s = await settings();
  if (buffer.length > s.maxImageMb * 1024 * 1024)
    throw new HttpError(400, `รูปภาพต้องไม่เกิน ${s.maxImageMb} MB`);
  const optimized = await optimizeImage(buffer);
  const name = randomUUID();
  const key = `${name}.webp`,
    thumbnailKey = `${name}-thumb.webp`;
  try {
    await putObject(key, optimized.image);
    await putObject(thumbnailKey, optimized.thumbnail);
    const upload = await db.upload.create({
      data: { userId, key, thumbnailKey }, select: { id: true },
    });
    return { ...upload, optimization: optimized.optimization };
  } catch (error) {
    await Promise.allSettled([key, thumbnailKey].map(objectKey => s3
      ? s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: objectKey }))
      : rm(resolve("uploads", objectKey), { force: true })));
    throw error;
  }
}
