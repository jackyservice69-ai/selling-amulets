import { Prisma, AmuletStatus } from "@prisma/client";
import { z } from "zod";
import { db, containsText } from "./db.js";
import {
  HttpError,
  publicWhere,
  publicInclude,
  staffRoles,
} from "./security.js";
import { listingSchema, text } from "./validation.js";
import { settings } from "./storage.js";
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});
export function paging(query: unknown) {
  const p = pageSchema.parse(query);
  return { ...p, skip: (p.page - 1) * p.limit };
}
export async function notifyStaff(
  tx: Prisma.TransactionClient,
  title: string,
  body: string,
  href: string,
  key: string,
) {
  const staff = await tx.user.findMany({
    where: { status: "ACTIVE", role: { name: { in: staffRoles } } },
    select: { id: true },
  });
  await tx.notification.createMany({
    data: staff.map((u) => ({
      userId: u.id,
      title,
      body,
      href,
      eventKey: `${key}:${u.id}`,
    })),
    skipDuplicates: true,
  });
}
export async function verifyImages(
  tx: Prisma.TransactionClient,
  userId: string,
  ids: string[],
) {
  const uploads = await tx.upload.count({ where: { id: { in: ids }, userId } });
  if (uploads !== ids.length)
    throw new HttpError(400, "ไม่พบรูปภาพหรือคุณไม่มีสิทธิ์ใช้รูปภาพนี้");
}
export async function saveListing(userId: string, input: unknown, id?: string) {
  const data = listingSchema.parse(input),
    s = await settings();
  if (data.imageIds.length > s.maxImages)
    throw new HttpError(400, `เพิ่มภาพได้สูงสุด ${s.maxImages} ภาพ`);
  return db.$transaction(
    async (tx) => {
      const shop = await tx.shop.findUnique({
        where: { userId },
        include: { user: true },
      });
      if (!shop) throw new HttpError(400, "กรุณาตั้งค่าร้านค้าก่อน");
      const category = await tx.category.findFirst({
        where: { id: data.categoryId, active: true },
      });
      if (!category) throw new HttpError(400, "หมวดหมู่ไม่พร้อมใช้งาน");
      await verifyImages(tx, userId, data.imageIds);
      const old = id ? await tx.amulet.findFirst({ where: { id, deletedAt: null } }) : null;
      if (id && (!old || old.shopId !== shop.id))
        throw new HttpError(404, "ไม่พบประกาศของคุณ");
      if (old?.status === "SUSPENDED")
        throw new HttpError(403, "ประกาศถูกระงับ กรุณาติดต่อผู้ดูแล");
      if (old && old.version !== data.version)
        throw new HttpError(409, "ประกาศถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุด");
      if (
        !old &&
        (await tx.amulet.count({
          where: { shopId: shop.id, status: { not: "CLOSED" } },
        })) >= Math.min(shop.user.maxListings, s.maxListings)
      )
        throw new HttpError(400, "ถึงจำนวนประกาศสูงสุดแล้ว");
      const { imageIds, draft, version: _version, ...fields } = data;
      void _version;
      const status: AmuletStatus = draft ? "DRAFT" : "PENDING";
      const a = old
        ? await tx.amulet.update({
            where: { id: old.id, version: old.version, deletedAt: null },
            data: {
              ...fields,
              price: fields.priceType === "ASK" ? null : fields.price,
              status,
              rejectionReason: null,
              version: { increment: 1 },
              images: {
                deleteMany: {},
                create: imageIds.map((uploadId, sortOrder) => ({
                  uploadId,
                  sortOrder,
                })),
              },
            },
          })
        : await tx.amulet.create({
            data: {
              ...fields,
              price: fields.priceType === "ASK" ? null : fields.price,
              shopId: shop.id,
              status,
              images: {
                create: imageIds.map((uploadId, sortOrder) => ({
                  uploadId,
                  sortOrder,
                })),
              },
            },
          });
      await tx.amuletStatusHistory.create({
        data: {
          amuletId: a.id,
          actorId: userId,
          status,
          reason: old ? "สมาชิกแก้ไขประกาศ" : "สร้างประกาศ",
        },
      });
      if (status === "PENDING")
        await notifyStaff(
          tx,
          "มีประกาศรอตรวจสอบ",
          a.title,
          "/admin",
          `listing:${a.id}:${a.version}`,
        );
      return a;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function moderate(actorId: string, id: string, input: unknown) {
  const data = z
    .object({
      status: z.enum([
        "APPROVED",
        "REJECTED",
        "SUSPENDED",
        "CLOSED",
        "PENDING",
      ]),
      reason: z.string().trim().max(2000).default(""),
      version: z.number().int(),
    })
    .parse(input);
  if (["REJECTED", "SUSPENDED"].includes(data.status) && data.reason.length < 5)
    throw new HttpError(400, "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  return db.$transaction(async (tx) => {
    const a = await tx.amulet.findFirst({
      where: { id, deletedAt: null },
      include: { shop: true },
    });
    if (!a) throw new HttpError(404, "ไม่พบประกาศ");
    if (a.status === data.status) return a;
    if (a.version !== data.version)
      throw new HttpError(409, "ประกาศเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุด");
    if (
      data.status === "APPROVED" &&
      !["PENDING", "SUSPENDED", "CLOSED"].includes(a.status)
    )
      throw new HttpError(400, "สถานะนี้ยังอนุมัติไม่ได้");
    const changed = await tx.amulet.updateMany({
      where: { id, version: data.version, deletedAt: null },
      data: {
        status: data.status,
        rejectionReason: data.reason || null,
        version: { increment: 1 },
      },
    });
    if (!changed.count) throw new HttpError(409, "ประกาศเปลี่ยนแปลงแล้ว");
    await tx.amuletStatusHistory.create({
      data: { amuletId: id, actorId, status: data.status, reason: data.reason },
    });
    const labels: Record<string, string> = {
      APPROVED: "อนุมัติแล้ว",
      REJECTED: "ไม่อนุมัติ",
      SUSPENDED: "ถูกระงับ",
      CLOSED: "ปิดประกาศแล้ว",
      PENDING: "รอตรวจสอบ",
    };
    await tx.notification.create({
      data: {
        userId: a.shop.userId,
        title: `ประกาศ${labels[data.status]}`,
        body: `${a.title}${data.reason ? " — " + data.reason : ""}`,
        href: "/dashboard",
        eventKey: `moderation:${id}:${a.version + 1}:${data.status}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: `LISTING_${data.status}`,
        entityId: id,
        detail: data.reason,
      },
    });
    return tx.amulet.findUnique({ where: { id } });
  });
}
// Keep reports, images and moderation evidence private after deletion. All listing
// reads and writes exclude deletedAt, so a stale editor cannot restore a deletion.
export async function deleteListing(actorId: string, id: string, input: unknown, asManager = false) {
  const data = z.object({
    version: z.number().int().min(1),
    reason: asManager ? text(2000, 5) : text(2000).default("เจ้าของลบประกาศ"),
  }).parse(input);
  return db.$transaction(async (tx) => {
    const a = await tx.amulet.findFirst({
      where: { id, deletedAt: null, ...(!asManager ? { shop: { userId: actorId } } : {}) },
      include: { shop: { select: { userId: true } } },
    });
    if (!a) throw new HttpError(404, "ไม่พบประกาศที่สามารถลบได้");
    const changed = await tx.amulet.updateMany({
      where: { id, version: data.version, deletedAt: null },
      data: { deletedAt: new Date(), status: "CLOSED", featured: false, version: { increment: 1 } },
    });
    if (!changed.count) throw new HttpError(409, "ประกาศเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนลบ");
    await tx.amuletStatusHistory.create({
      data: { amuletId: id, actorId, status: "CLOSED", reason: `ลบประกาศ: ${data.reason}` },
    });
    await tx.auditLog.create({
      data: { actorId, action: "LISTING_DELETED", entityId: id,
        detail: JSON.stringify({ title: a.title, shopId: a.shopId, previousStatus: a.status, reason: data.reason, by: asManager ? "ADMIN" : "OWNER" }) },
    });
    if (asManager && actorId !== a.shop.userId) {
      await tx.notification.create({ data: {
        userId: a.shop.userId, title: "ผู้ดูแลลบประกาศของคุณ",
        body: `${a.title} — ${data.reason}`, href: "/dashboard",
        eventKey: `listing-deleted:${id}`,
      } });
    }
    return { ok: true };
  });
}
export async function searchListings(query: Record<string, unknown>) {
  const { page, limit, skip } = paging(query);
  const q = z.string().max(200).default("").parse(query.q);
  const sort = z
    .enum(["newest", "price_asc", "price_desc", "popular"])
    .default("newest")
    .parse(query.sort);
  const bounds = z
    .object({
      min: z.coerce.number().min(0).optional(),
      max: z.coerce.number().min(0).optional(),
    })
    .parse(query);
  const where: Prisma.AmuletWhereInput = {
    ...publicWhere,
    ...(query.category ? { categoryId: String(query.category) } : {}),
    ...(query.shop
      ? {
          shop: {
            ...(publicWhere.shop as Prisma.ShopWhereInput),
            slug: String(query.shop),
          },
        }
      : {}),
    ...(query.featured === "true" ? { featured: true } : {}),
    ...(bounds.min !== undefined || bounds.max !== undefined
      ? { price: { gte: bounds.min, lte: bounds.max } }
      : {}),
    ...(q
      ? {
          OR: [
            { title: containsText(q) },
            { temple: containsText(q) },
            { master: containsText(q) },
            { shop: { name: containsText(q) } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.AmuletOrderByWithRelationInput =
    sort === "popular"
      ? { views: "desc" }
      : sort === "price_asc"
        ? { price: "asc" }
        : sort === "price_desc"
          ? { price: "desc" }
          : { createdAt: "desc" };
  const [items, total] = await db.$transaction([
    db.amulet.findMany({
      where,
      include: publicInclude,
      orderBy: [orderBy, { id: "asc" }],
      skip,
      take: limit,
    }),
    db.amulet.count({ where }),
  ]);
  return { items, total, page, limit };
}
export async function recordView(
  entityId: string,
  type: "amulet" | "shop",
  visitorKey: string,
) {
  const day = new Date().toISOString().slice(0, 10);
  await db.$transaction(async (tx) => {
    // Let the unique key deduplicate atomically on both PostgreSQL and MySQL.
    // Do not rely on instanceof across the two separately generated clients.
    const created = await tx.viewEvent.createMany({
      data: [{ entityId, type, visitorKey, day }],
      skipDuplicates: true,
    });
    if (!created.count) return;
    if (type === "amulet")
      await tx.amulet.update({
        where: { id: entityId },
        data: { views: { increment: 1 } },
      });
    else
      await tx.shop.update({
        where: { id: entityId },
        data: { views: { increment: 1 } },
      });
  });
}
export async function popupEligible(
  p: {
    id: string;
    maxViews: number;
    oncePerSession: boolean;
    intervalHours: number;
  },
  visitorKey: string,
  sessionKey: string,
  tx: Prisma.TransactionClient = db,
) {
  const views = await tx.popupView.findMany({
    where: { popupId: p.id, visitorKey },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    views.length < p.maxViews &&
    !views.some((v) => p.oncePerSession && v.sessionKey === sessionKey) &&
    (!views.length ||
      Date.now() - views[0].createdAt.getTime() >= p.intervalHours * 3600000)
  );
}
