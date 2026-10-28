import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { AmuletStatus } from "@prisma/client";
import { app } from "../server/app.js";
import { db } from "../server/db.js";
import { config } from "../server/config.js";
import { processUpload } from "../server/storage.js";

const suffix = Date.now().toString(36), origin = config.APP_ORIGIN;
const labels = ["owner", "other", "admin", "super", "moderator"] as const;
type Label = typeof labels[number];
const clients = Object.fromEntries(labels.map((label) => [label, request.agent(app)])) as Record<Label, ReturnType<typeof request.agent>>;
const tokens = {} as Record<Label, string>, ids = {} as Record<Label, string>;
let shopId = "", categoryId = "", uploadId = "";
const listingIds: string[] = [];
const write = (label: Label, path: string, body: unknown, method: "delete" | "put" | "post" = "delete") =>
  clients[label][method](`/api${path}`).set("Origin", origin).set("X-CSRF-Token", tokens[label]).send(body);
async function listing(status: AmuletStatus = "APPROVED") {
  const a = await db.amulet.create({ data: {
    title: `พระทดสอบการลบ ${suffix}`, description: "ประกาศสำหรับตรวจสอบการลบและสิทธิ์การเข้าถึง",
    shopId, categoryId, status, featured: true,
    images: { create: { uploadId, sortOrder: 0 } },
  } });
  listingIds.push(a.id);
  return a;
}
beforeAll(async () => {
  expect(new URL(config.DATABASE_URL).pathname.endsWith("_test")).toBe(true);
  const passwordHash = await bcrypt.hash("Delete-test-82!", 12);
  const roleNames = { owner: "MEMBER", other: "MEMBER", admin: "ADMIN", super: "SUPER_ADMIN", moderator: "MODERATOR" } as const;
  for (const label of labels) {
    const user = await db.user.create({ data: {
      username: `del_${label}_${suffix}`, passwordHash, referralCode: `D${label}${suffix}`,
      role: { connect: { name: roleNames[label] } }, profile: { create: { displayName: "ทดสอบลบประกาศ" } },
    } });
    ids[label] = user.id;
    const login = await clients[label].post("/api/auth/login").set("Origin", origin).send({ username: user.username, password: "Delete-test-82!" });
    expect(login.status).toBe(200); tokens[label] = login.body.csrf;
  }
  shopId = (await db.shop.create({ data: { userId: ids.owner, name: "ร้านทดสอบลบ", slug: `delete-${suffix}`, description: "ร้านสำหรับทดสอบ", active: true } })).id;
  categoryId = (await db.category.create({ data: { name: "ทดสอบการลบ", slug: `delete-${suffix}` } })).id;
  const source = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#ffffff" } }).png().toBuffer();
  uploadId = (await processUpload(ids.owner, source)).id;
});
afterAll(async () => {
  vi.restoreAllMocks();
  await db.report.deleteMany({ where: { amuletId: { in: listingIds } } });
  await db.amulet.deleteMany({ where: { id: { in: listingIds } } });
  if (shopId) await db.shop.delete({ where: { id: shopId } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  const uploads = await db.upload.findMany({ where: { userId: ids.owner } });
  await db.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
  await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await Promise.all(uploads.flatMap((u) => [u.key, u.thumbnailKey]).map((key) => rm(resolve("uploads", key), { force: true })));
  await db.$disconnect();
});

describe("Listing deletion authorization, visibility and evidence", () => {
  it("requires authentication, CSRF, ownership and manager roles; ignores forged privileges", async () => {
    const a = await listing();
    const own = `/me/amulets/${a.id}`, managed = `/admin/amulets/${a.id}`;
    expect((await request(app).delete(`/api${own}`).set("Origin", origin).send({ version: 1 })).status).toBe(401);
    expect((await clients.owner.delete(`/api${own}`).set("Origin", origin).send({ version: 1 })).status).toBe(403);
    expect((await clients.owner.delete(`/api${own}`).set("Origin", "https://evil.example").set("X-CSRF-Token", tokens.owner).send({ version: 1 })).status).toBe(403);
    expect((await write("other", own, { version: 1, shopId, asManager: true, role: "SUPER_ADMIN" })).status).toBe(404);
    for (const label of ["owner", "other", "moderator"] as const)
      expect((await write(label, managed, { version: 1, reason: "ทดสอบสิทธิ์การลบ" })).status).toBe(403);
    expect((await write("owner", own, {})).status).toBe(400);
    expect((await write("admin", managed, { version: 1, reason: " " })).status).toBe(400);
    expect((await db.amulet.findUniqueOrThrow({ where: { id: a.id } })).deletedAt).toBeNull();
  });

  it("rejects stale versions without changing visibility or creating audit evidence", async () => {
    const a = await listing();
    await db.amulet.update({ where: { id: a.id }, data: { version: { increment: 1 } } });
    expect((await write("owner", `/me/amulets/${a.id}`, { version: 1 })).status).toBe(409);
    expect((await request(app).get(`/api/amulets/${a.id}`)).status).toBe(200);
    expect(await db.auditLog.count({ where: { entityId: a.id } })).toBe(0);
    await write("owner", `/me/amulets/${a.id}`, { version: 2 });
  });

  it.each(["DRAFT", "PENDING", "APPROVED", "REJECTED", "SUSPENDED", "CLOSED"] as const)("owner can delete %s without losing reports and cannot restore it", async (status) => {
    const a = await listing(status);
    await db.favorite.create({ data: { userId: ids.other, amuletId: a.id } });
    const report = await db.report.create({ data: { userId: ids.other, amuletId: a.id, reason: "ทดสอบรายงาน", details: "หลักฐานที่ต้องยังอยู่หลังลบ" } });
    expect((await write("owner", `/me/amulets/${a.id}`, { version: a.version })).status).toBe(200);
    const stored = await db.amulet.findUniqueOrThrow({ where: { id: a.id } });
    expect(stored.deletedAt).toBeInstanceOf(Date);
    expect(stored).toMatchObject({ status: "CLOSED", featured: false, version: 2 });
    expect((await request(app).get(`/api/amulets/${a.id}`)).status).toBe(404);
    expect((await clients.owner.get(`/api/me/amulets/${a.id}`)).status).toBe(404);
    expect((await clients.owner.get("/api/me/amulets?limit=48")).body.items.map((x: { id: string }) => x.id)).not.toContain(a.id);
    expect((await clients.admin.get(`/api/admin/amulets?q=${suffix}&limit=48`)).body.items.map((x: { id: string }) => x.id)).not.toContain(a.id);
    expect((await clients.other.get("/api/me/favorites?limit=48")).body.items.map((x: { amuletId: string }) => x.amuletId)).not.toContain(a.id);
    expect((await write("owner", `/me/amulets/${a.id}`, { version: 2, title: a.title, description: a.description, categoryId, priceType: "ASK", imageIds: [uploadId] }, "put")).status).toBe(404);
    expect((await write("owner", `/me/amulets/${a.id}/close`, {}, "post")).status).toBe(404);
    expect((await write("admin", `/admin/amulets/${a.id}/status`, { version: 2, status: "APPROVED" }, "post")).status).toBe(404);
    expect((await write("admin", `/admin/amulets/${a.id}/featured`, { featured: true }, "put")).status).toBe(404);
    expect((await write("owner", `/me/amulets/${a.id}`, { version: 2 })).status).toBe(404);
    expect(await db.report.findUnique({ where: { id: report.id } })).not.toBeNull();
    expect(await db.auditLog.count({ where: { entityId: a.id, actorId: ids.owner, action: "LISTING_DELETED" } })).toBe(1);
  });

  it.each(["admin", "super"] as const)("%s can delete another shop's listing and notify its owner with a reason", async (label) => {
    const a = await listing();
    const before = (await clients.admin.get("/api/admin/stats")).body;
    expect((await write(label, `/admin/amulets/${a.id}`, { version: a.version, reason: "ลบตามคำขอเจ้าของร้าน" })).status).toBe(200);
    const after = (await clients.admin.get("/api/admin/stats")).body;
    expect(after.total).toBe(before.total - 1); expect(after.approved).toBe(before.approved - 1);
    const notice = await db.notification.findFirstOrThrow({ where: { eventKey: `listing-deleted:${a.id}` } });
    expect(notice).toMatchObject({ userId: ids.owner, href: "/dashboard" });
    expect(notice.body).toContain("ลบตามคำขอเจ้าของร้าน");
    expect(await db.auditLog.count({ where: { entityId: a.id, actorId: ids[label], action: "LISTING_DELETED" } })).toBe(1);
  });

  it("commits one deletion and one notification when two administrators delete concurrently", async () => {
    const a = await listing();
    const responses = await Promise.all((["admin", "super"] as const).map((label) => write(label, `/admin/amulets/${a.id}`, { version: 1, reason: "ลบประกาศทดสอบพร้อมกัน" })));
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.filter((r) => [404, 409].includes(r.status))).toHaveLength(1);
    expect(await db.auditLog.count({ where: { entityId: a.id, action: "LISTING_DELETED" } })).toBe(1);
    expect(await db.notification.count({ where: { eventKey: `listing-deleted:${a.id}` } })).toBe(1);
  });

  it("rolls back deletion if evidence cannot be saved", async () => {
    const a = await listing();
    const original = db.$transaction.bind(db);
    const fault = vi.spyOn(db, "$transaction").mockImplementationOnce((async (fn: (tx: typeof db) => Promise<unknown>) =>
      original(async (tx) => fn(new Proxy(tx, { get(target, prop) {
        if (prop === "auditLog") return { create: async () => { throw new Error("simulated audit failure"); } };
        return Reflect.get(target, prop);
      } }) as typeof db))) as typeof db.$transaction);
    try { expect((await write("owner", `/me/amulets/${a.id}`, { version: 1 })).status).toBe(500); }
    finally { fault.mockRestore(); }
    expect((await db.amulet.findUniqueOrThrow({ where: { id: a.id } })).deletedAt).toBeNull();
    expect(await db.amuletStatusHistory.count({ where: { amuletId: a.id } })).toBe(0);
    await write("owner", `/me/amulets/${a.id}`, { version: 1 });
  });

  it("blocks deleted images from guests while retaining images shared by a live listing", async () => {
    // Remove the authorization fixture's live reference; every other fixture is deleted.
    await db.amulet.updateMany({ where: { id: { in: listingIds } }, data: { deletedAt: new Date(), status: "CLOSED" } });
    const a = await listing(), b = await listing();
    expect((await request(app).get(`/api/media/${uploadId}`)).status).toBe(200);
    await write("owner", `/me/amulets/${a.id}`, { version: 1 });
    expect((await request(app).get(`/api/media/${uploadId}`)).status).toBe(200);
    await write("owner", `/me/amulets/${b.id}`, { version: 1 });
    expect((await request(app).get(`/api/media/${uploadId}`)).status).toBe(404);
    expect((await request(app).get(`/api/media/${uploadId}?thumb=1`)).status).toBe(404);
    expect((await request(app).get(`/api/amulets?shop=${shopId}`)).body.total).toBe(0);
    const shop = await request(app).get(`/api/shops/delete-${suffix}`);
    expect(shop.body._count.amulets).toBe(0);
  });
});
