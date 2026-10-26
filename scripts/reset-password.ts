import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "../server/db.js";
import { password, username, text } from "../server/validation.js";

// Local operator command only. No public password-reset endpoint.
try {
  const actorName = username.parse(process.env.OPERATOR_USERNAME);
  const targetName = username.parse(process.env.TARGET_USERNAME);
  const secret = password.parse(process.env.NEW_PASSWORD);
  const reason = text(1000, 5).parse(process.env.RESET_REASON);
  const actor = await db.user.findUnique({ where: { username: actorName }, include: { role: true } });
  if (!actor || actor.status !== "ACTIVE" || actor.role.name !== "SUPER_ADMIN") throw new Error("ต้องระบุผู้ดูแลสูงสุดที่เปิดใช้งาน");
  const target = await db.user.findUnique({ where: { username: targetName } });
  if (!target) throw new Error("ไม่พบชื่อผู้ใช้ที่ต้องการกู้บัญชี");
  const passwordHash = await bcrypt.hash(secret, 12);
  await db.$transaction(async tx => {
    await tx.user.update({ where: { id: target.id }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: target.id } });
    await tx.auditLog.create({ data: { actorId: actor.id, entityId: target.id, action: "PASSWORD_RESET_BY_OPERATOR", detail: reason } });
    await tx.notification.create({ data: { eventKey: `password-reset:${randomUUID()}`, userId: target.id, title: "ผู้ดูแลตั้งรหัสผ่านใหม่ให้บัญชีของคุณ", body: "กรุณาเข้าสู่ระบบและเปลี่ยนรหัสผ่านในหน้าข้อมูลส่วนตัว", href: "/dashboard/profile" } });
  });
  console.log("ตั้งรหัสผ่านใหม่และยกเลิกการเข้าสู่ระบบเดิมแล้ว");
} catch {
  console.error("ตั้งรหัสผ่านไม่สำเร็จ ตรวจชื่อผู้ดูแล ชื่อผู้ใช้ เหตุผล และรหัสผ่านอย่างน้อย 8 ตัวอักษร");
  process.exitCode = 1;
} finally { await db.$disconnect(); }
