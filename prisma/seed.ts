import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { db } from "../server/db.js";
import { defaultSettings } from "../server/validation.js";
import { putObject } from "../server/storage.js";
async function seed() {
  for (const name of ["MEMBER", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const) {
    const role = await db.role.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    const perms =
      name === "MEMBER"
        ? ["OWN_SHOP", "OWN_LISTINGS"]
        : name === "MODERATOR"
          ? ["MODERATE_LISTINGS", "REVIEW_REPORTS"]
          : name === "ADMIN"
            ? [
                "MODERATE_LISTINGS",
                "REVIEW_REPORTS",
                "MANAGE_MEMBERS",
                "MANAGE_CONTENT",
              ]
            : [
                "MODERATE_LISTINGS",
                "REVIEW_REPORTS",
                "MANAGE_MEMBERS",
                "MANAGE_CONTENT",
                "MANAGE_SETTINGS",
                "MANAGE_ROLES",
              ];
    for (const key of perms) {
      const p = await db.permission.upsert({
        where: { name: key },
        create: { name: key },
        update: {},
      });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        create: { roleId: role.id, permissionId: p.id },
        update: {},
      });
    }
  }
  await db.siteSetting.upsert({
    where: { id: "site" },
    create: { id: "site", value: defaultSettings },
    update: {},
  });
  const names = [
    ["พระสมเด็จ", "somdej"],
    ["พระเหรียญ", "medals"],
    ["พระเนื้อผง", "powder"],
    ["พระเนื้อดิน", "clay"],
    ["พระกริ่ง / รูปหล่อ", "statues"],
    ["เครื่องราง / ของสะสม", "talismans"],
  ];
  for (const [i, [name, slug]] of names.entries())
    await db.category.upsert({
      where: { slug },
      create: { id: `category-${slug}`, name, slug, sortOrder: i },
      update: {},
    });
  await db.announcement.upsert({
    where: { id: "welcome" },
    create: {
      id: "welcome",
      title: "ยินดีต้อนรับสู่ตลาดพระเครื่อง",
      body: "เปิดร้านได้ฟรี และลงประกาศพระเครื่องเพื่อให้ผู้สนใจติดต่อคุณโดยตรง ประกาศทุกชิ้นต้องผ่านการตรวจสอบก่อนเผยแพร่ ไม่มีการชำระเงินภายในเว็บไซต์",
    },
    update: {},
  });
  // Demo data is opt-in and stored through the same real database and private media store.
  if (process.env.SEED_DEMO !== "true") {
    console.log("สร้างหมวดหมู่ สิทธิ์ และการตั้งค่าแล้ว (ไม่เพิ่มข้อมูลสาธิต)");
    return;
  }
  const role = await db.role.findUniqueOrThrow({ where: { name: "MEMBER" } });
  const shops = ["สยามพระเครื่อง", "บ้านพระเก่า", "มรดกศรัทธา"];
  for (const [i, name] of shops.entries()) {
    const user = await db.user.upsert({
      where: { username: `demo_collector_${i + 1}` },
      create: {
        id: `demo-user-${i}`,
        username: `demo_collector_${i + 1}`,
        passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
        roleId: role.id,
        referralCode: `DEMO${i}COLLECTOR`,
        profile: { create: { displayName: name } },
        shop: {
          create: {
            id: `demo-shop-${i}`,
            name: `${name} (ตัวอย่าง)`,
            slug: `demo-shop-${i}`,
            description:
              "ร้านตัวอย่างสำหรับสาธิตระบบ ภาพและราคาประกอบไม่ใช่สินค้าที่เสนอขายจริง",
            featured: true,
          },
        },
      },
      update: {},
      include: { shop: true },
    });
    const entries = [
      ["พระสมเด็จ พิมพ์ใหญ่ เนื้อผง", "somdej", 8500, 0],
      ["เหรียญรูปเหมือน เนื้อทองแดง", "medals", 3200, 1],
      ["พระพุทธรูปหล่อ เนื้อสัมฤทธิ์", "statues", 12500, 2],
      ["พระเนื้อดิน พิมพ์ซุ้มโค้ง", "clay", 4800, 3],
    ] as const;
    for (const [j, [title, category, price, asset]] of entries.entries()) {
      const id = `demo-amulet-${i}-${j}`;
      if (await db.amulet.findUnique({ where: { id } })) continue;
      let image: Buffer;
      try {
        image = await readFile(`public/brand/amulet-${asset + 1}.webp`);
      } catch {
        image = await sharp(await readFile("public/brand/hero.png"))
          .resize(700, 700, { fit: "cover" })
          .webp({ quality: 85 })
          .toBuffer();
      }
      const key = `seed-${i}-${j}.webp`,
        thumbnailKey = `seed-${i}-${j}-thumb.webp`;
      await putObject(key, image);
      await putObject(
        thumbnailKey,
        await sharp(image)
          .resize(600, 600, { fit: "inside" })
          .webp({ quality: 80 })
          .toBuffer(),
      );
      const upload = await db.upload.upsert({
        where: { key },
        create: { key, thumbnailKey, userId: user.id },
        update: {},
      });
      await db.amulet.create({
        data: {
          id,
          shopId: user.shop!.id,
          categoryId: `category-${category}`,
          title: `${title} (ตัวอย่าง)`,
          description:
            "ข้อมูลตัวอย่างสำหรับทดสอบตลาดพระเครื่อง ภาพประกอบสร้างขึ้นเพื่อสาธิตเท่านั้น ไม่ใช่หลักฐานการรับรองความแท้และไม่ใช่ประกาศสินค้าจริง กรุณาสร้างประกาศใหม่ด้วยข้อมูลและภาพของคุณเองก่อนเปิดใช้งาน",
          material:
            j === 1 ? "ทองแดง" : j === 2 ? "สัมฤทธิ์" : j === 3 ? "ดิน" : "ผง",
          condition: "ภาพประกอบสาธิต",
          price: price + i * 700,
          featured: j === 0 || j === 2,
          status: "APPROVED",
          createdAt: new Date(Date.now() - (i * 4 + j) * 3600000),
          images: { create: { uploadId: upload.id, sortOrder: 0 } },
          histories: {
            create: {
              actorId: user.id,
              status: "APPROVED",
              reason: "SEED_DEMO: ข้อมูลตัวอย่างสำหรับทดสอบ",
            },
          },
        },
      });
    }
  }
  console.log(
    "เพิ่มข้อมูลสาธิตในฐานข้อมูลแล้ว ไม่มีรหัสผ่านบัญชีสาธิตที่เข้าสู่ระบบได้",
  );
}
try {
  await seed();
} finally {
  await db.$disconnect();
}
