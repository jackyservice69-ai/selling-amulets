import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaClient as PostgresClient } from "../.generated/postgres/index.js";
export const db: PrismaClient = process.env.DATABASE_URL?.startsWith("postgres")
  ? new PostgresClient({datasources:{db:{url:process.env.DATABASE_URL}}}) as unknown as PrismaClient
  : new PrismaClient();
export const containsText = (value:string) => process.env.DATABASE_URL?.startsWith("postgres") ? {contains:value,mode:"insensitive" as const} : {contains:value};
