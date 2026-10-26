import "dotenv/config";
import { z } from "zod";
const env = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(3001),
    SERVE_STATIC: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    APP_ORIGIN: z.url().default("http://localhost:5173"),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
  })
  .parse(process.env);
if (
  env.NODE_ENV === "production" &&
  (!env.APP_ORIGIN.startsWith("https://") ||
    env.SESSION_SECRET.startsWith("REPLACE"))
)
  throw new Error(
    "ตั้งค่า HTTPS และ SESSION_SECRET ก่อนเริ่ม production",
  );
if (
  env.STORAGE_DRIVER === "s3" &&
  (!env.S3_BUCKET || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY)
)
  throw new Error("กรุณาตั้งค่า S3");
export const config = env;
