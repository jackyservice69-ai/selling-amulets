import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.test.local", override: true, quiet: true });
if (
  !process.env.DATABASE_URL ||
  !new URL(process.env.DATABASE_URL).pathname.endsWith("_test")
)
  throw new Error("E2E requires a separate _test database");
process.env.PORT = "3002";
process.env.APP_ORIGIN = "http://localhost:5174";
process.env.NODE_ENV = "test";
const { db } = await import("../server/db.js");
const { default: bcrypt } = await import("bcryptjs");
const role = await db.role.findUniqueOrThrow({
  where: { name: "SUPER_ADMIN" },
});
const passwordHash = await bcrypt.hash("E2E-test-only-admin-593!", 12);
await db.user.upsert({
  where: { username: "e2e_admin" },
  create: {
    username: "e2e_admin",
    passwordHash,
    roleId: role.id,
    referralCode: "E2EADMINTEST",
    profile: { create: { displayName: "ผู้ดูแลทดสอบ E2E" } },
    shop: {
      create: {
        slug: "e2e-admin",
        name: "ร้านผู้ดูแลทดสอบ",
        description: "เฉพาะฐานข้อมูลทดสอบ",
        active: false,
      },
    },
  },
  update: { passwordHash, status: "ACTIVE", roleId: role.id },
});
await import("../server/index.js");
