import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "../server/db.js";
import { password, username as usernameSchema } from "../server/validation.js";
try {
  const username = usernameSchema.parse(process.env.ADMIN_USERNAME);
  const secret = password.parse(process.env.ADMIN_PASSWORD);
  const role = await db.role.upsert({
    where: { name: "SUPER_ADMIN" },
    create: { name: "SUPER_ADMIN" },
    update: {},
  });
  if (await db.user.findUnique({ where: { username } }))
    throw new Error(
      "ชื่อผู้ใช้นี้มีบัญชีแล้ว สคริปต์จะไม่เปลี่ยนสิทธิ์หรือรหัสผ่านของบัญชีเดิม",
    );
  await db.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(secret, 12),
      roleId: role.id,
      referralCode: randomBytes(6).toString("hex").toUpperCase(),
      profile: { create: { displayName: "ผู้ดูแลระบบ" } },
      shop: {
        create: {
          slug: `admin-${randomBytes(4).toString("hex")}`,
          name: "ร้านผู้ดูแลระบบ",
          description: "",
          active: false,
        },
      },
    },
  });
  console.log("สร้างบัญชีผู้ดูแลสูงสุดเรียบร้อย");
} finally {
  await db.$disconnect();
}
