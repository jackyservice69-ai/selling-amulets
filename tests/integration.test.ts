import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { app } from "../server/app.js";
import { db } from "../server/db.js";
import { config } from "../server/config.js";
const runFile = promisify(execFile);

const origin = config.APP_ORIGIN,
  run = Date.now().toString(36),
  testPassword = "Test482!";
const alice = request.agent(app),
  bob = request.agent(app),
  admin = request.agent(app),
  guest = request.agent(app);
let aliceCsrf = "",
  bobCsrf = "",
  adminCsrf = "",
  aliceId = "",
  bobId = "",
  adminId = "",
  aliceCode = "",
  shopSlug = "",
  imageId = "",
  listingId = "",
  version = 1,
  categoryId = "",
  popupId = "";
const createBody = () => ({
  title: `พระเครื่องทดสอบ ${run}`,
  description: "รายละเอียดพระเครื่องสำหรับตรวจสอบระบบจริงอย่างครบถ้วน",
  categoryId,
  temple: "วัดทดสอบ",
  master: "เกจิทดสอบ",
  price: 2500,
  priceType: "FIXED",
  imageIds: [imageId],
  draft: false,
});
const write = (
  client: typeof alice,
  token: string,
  path: string,
  body: unknown,
  method: "post" | "put" | "delete" = "post",
) =>
  client[method](`/api${path}`)
    .set("Origin", origin)
    .set("X-CSRF-Token", token)
    .send(body);
async function register(client: typeof alice, label: string, ref?: string) {
  return client
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      username: `test_${label}_${run}`,
      password: testPassword,
      displayName: `สมาชิกทดสอบ ${label}`,
      ...(ref ? { ref } : {}),
    });
}
beforeAll(async () => {
  expect(new URL(config.DATABASE_URL).pathname.endsWith("_test")).toBe(true);
  await db.$connect();
  const timezone = await db.$queryRaw<
    { difference: bigint }[]
  >`SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS difference`;
  expect(Number(timezone[0].difference)).toBe(0);
  const c = await db.category.create({
    data: { name: `หมวดทดสอบ ${run}`, slug: `test-${run}` },
  });
  categoryId = c.id;

});
afterAll(async () => {
  await db.$disconnect();
});
describe("ตลาดพระเครื่อง — MySQL integration / real HTTP middleware", () => {
  it("registers with hashed password and secure session flags; does not expose secrets", async () => {
    const r = await register(alice, "alice");
    expect(r.status).toBe(201);
    aliceCsrf = r.body.csrf;
    aliceId = r.body.user.id;
    aliceCode = r.body.user.referralCode;
    expect(r.body.user.passwordHash).toBeUndefined();
    expect(r.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(r.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
    const stored = await db.user.findUniqueOrThrow({ where: { id: aliceId } });
    expect(stored.passwordHash).not.toBe(testPassword);
    expect(stored.passwordHash).toMatch(/^\$2[ab]\$/);
  });
  it("registers a second member with a unique referral exactly once", async () => {
    const r = await register(bob, "bob", aliceCode);
    expect(r.status).toBe(201);
    bobCsrf = r.body.csrf;
    bobId = r.body.user.id;
    expect(r.body.user.referralCode).not.toBe(aliceCode);
    expect(
      await db.referral.count({
        where: { referrerId: aliceId, referredId: bobId },
      }),
    ).toBe(1);
    const duplicate = await register(request.agent(app), "bob", aliceCode);
    expect(duplicate.status).toBe(409);
    expect(await db.referral.count({ where: { referredId: bobId } })).toBe(1);
  });
  it("rejects self referral and forged referral codes", async () => {
    expect(
      (await register(request.agent(app), "alice", aliceCode)).status,
    ).toBe(400);
    expect(
      (await register(request.agent(app), "forged", "INVALID-CODE")).status,
    ).toBe(400);
  });
  it("logs in and rotates session; wrong password fails", async () => {
    expect(
      (
        await guest
          .post("/api/auth/login")
          .set("Origin", origin)
          .send({ username: `test_alice_${run}`, password: "wrong" })
      ).status,
    ).toBe(401);
    const r = await write(alice, aliceCsrf, "/auth/login", {
      username: `test_alice_${run}`,
      password: testPassword,
    });
    expect(r.status).toBe(200);
    aliceCsrf = r.body.csrf;
    const a = await register(admin, "admin");
    expect(a.status).toBe(201);
    adminId = a.body.user.id;
    adminCsrf = a.body.csrf;
    const role = await db.role.findUniqueOrThrow({
      where: { name: "SUPER_ADMIN" },
    });
    await db.user.update({ where: { id: adminId }, data: { roleId: role.id } });
    expect((await admin.get("/api/auth/me")).body.user.role).toBe(
      "SUPER_ADMIN",
    );
  });
  it("rejects missing CSRF token, foreign origin and unauthenticated writes", async () => {
    expect(
      (await alice.put("/api/me/shop").set("Origin", origin).send({})).status,
    ).toBe(403);
    expect(
      (
        await alice
          .put("/api/me/shop")
          .set("Origin", "https://evil.example")
          .set("X-CSRF-Token", aliceCsrf)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await guest
          .post("/api/me/amulets")
          .set("Origin", origin)
          .send(createBody())
      ).status,
    ).toBe(401);
  });
  it("member and guest cannot access admin APIs or assign themselves a role", async () => {
    expect((await alice.get("/api/admin/users")).status).toBe(403);
    expect((await guest.get("/api/admin/stats")).status).toBe(401);
    expect(
      (
        await write(
          alice,
          aliceCsrf,
          `/admin/users/${bobId}`,
          { role: "SUPER_ADMIN" },
          "put",
        )
      ).status,
    ).toBe(403);
  });
  it("validates image content, rejecting SVG and disguised executable bytes", async () => {
    for (const buffer of [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      Buffer.from("MZ not a photograph"),
    ]) {
      const r = await alice
        .post("/api/uploads")
        .set("Origin", origin)
        .set("X-CSRF-Token", aliceCsrf)
        .attach("image", buffer, {
          filename: "photo.jpg",
          contentType: "image/jpeg",
        });
      expect(r.status).toBe(400);
    }
  });
  it("processes PNG into WebP and keeps unattached uploads private", async () => {
    const png = await sharp({
      create: { width: 40, height: 40, channels: 3, background: "#ba9d65" },
    })
      .png()
      .toBuffer();
    const r = await alice
      .post("/api/uploads")
      .set("Origin", origin)
      .set("X-CSRF-Token", aliceCsrf)
      .attach("image", png, "amulet.png");
    expect(r.status).toBe(201);
    imageId = r.body.id;
    expect((await guest.get(`/api/media/${imageId}`)).status).toBe(404);
    expect((await bob.get(`/api/media/${imageId}`)).status).toBe(404);
    const media = await alice.get(`/api/media/${imageId}`);
    expect(media.status).toBe(200);
    expect(media.headers["content-type"]).toMatch("image/webp");
  });
  it("creates a real PENDING listing and notifies admin", async () => {
    const r = await write(alice, aliceCsrf, "/me/amulets", {
      ...createBody(),
      status: "APPROVED",
      shopId: "forged",
    });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("PENDING");
    expect(r.body.listingType).toBe("SALE");
    listingId = r.body.id;
    version = r.body.version;
    expect(
      (await db.amulet.findUniqueOrThrow({ where: { id: listingId } })).status,
    ).toBe("PENDING");
    expect(
      await db.notification.count({
        where: {
          userId: adminId,
          eventKey: { startsWith: `listing:${listingId}:` },
        },
      }),
    ).toBe(1);
  });
  it("keeps unapproved listing and its images out of direct public APIs and search", async () => {
    expect((await guest.get(`/api/amulets/${listingId}`)).status).toBe(404);
    expect((await guest.get(`/api/amulets?q=${run}`)).body.total).toBe(0);
    expect((await guest.get(`/api/media/${imageId}?thumb=1`)).status).toBe(404);
  });
  it("blocks editing another member listing and attaching another member image", async () => {
    expect(
      (
        await write(
          bob,
          bobCsrf,
          `/me/amulets/${listingId}`,
          { ...createBody(), version },
          "put",
        )
      ).status,
    ).toBe(400);
    expect(
      (await write(bob, bobCsrf, "/me/amulets", createBody())).status,
    ).toBe(400);
    expect((await bob.get(`/api/me/amulets/${listingId}`)).status).toBe(404);
  });
  it("requires rejection reason then persists rejection and notification atomically", async () => {
    expect(
      (
        await write(admin, adminCsrf, `/admin/amulets/${listingId}/status`, {
          status: "REJECTED",
          reason: "",
          version,
        })
      ).status,
    ).toBe(400);
    const r = await write(
      admin,
      adminCsrf,
      `/admin/amulets/${listingId}/status`,
      { status: "REJECTED", reason: "กรุณาเพิ่มรายละเอียดที่ชัดเจน", version },
    );
    expect(r.status).toBe(200);
    version = r.body.version;
    const mine = await alice.get(`/api/me/amulets/${listingId}`);
    expect(mine.body.rejectionReason).toContain("เพิ่มรายละเอียด");
    expect(mine.body.histories[0].status).toBe("REJECTED");
    expect(
      await db.notification.count({
        where: {
          userId: aliceId,
          eventKey: { startsWith: `moderation:${listingId}:` },
        },
      }),
    ).toBe(1);
  });
  it("resubmits rejected listing and rejects stale concurrent edit", async () => {
    const r = await write(
      alice,
      aliceCsrf,
      `/me/amulets/${listingId}`,
      { ...createBody(), version },
      "put",
    );
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("PENDING");
    expect(
      (
        await write(
          alice,
          aliceCsrf,
          `/me/amulets/${listingId}`,
          { ...createBody(), version },
          "put",
        )
      ).status,
    ).toBe(409);
    version = r.body.version;
  });
  it("approval publishes and a retry does not duplicate notification/history", async () => {
    const payload = {
      status: "APPROVED",
      reason: "ตรวจสอบความเหมาะสมแล้ว",
      version,
    };
    const r = await write(
      admin,
      adminCsrf,
      `/admin/amulets/${listingId}/status`,
      payload,
    );
    expect(r.status).toBe(200);
    version = r.body.version;
    expect(
      (
        await write(
          admin,
          adminCsrf,
          `/admin/amulets/${listingId}/status`,
          payload,
        )
      ).status,
    ).toBe(200);
    expect(
      await db.notification.count({
        where: { eventKey: `moderation:${listingId}:${version}:APPROVED` },
      }),
    ).toBe(1);
    expect(
      await db.amuletStatusHistory.count({
        where: { amuletId: listingId, status: "APPROVED" },
      }),
    ).toBe(1);
    expect((await guest.get(`/api/amulets/${listingId}`)).status).toBe(200);
    expect((await guest.get(`/api/media/${imageId}`)).status).toBe(200);
  });
  it("searches title, temple and master; filters price and category with bounded pagination", async () => {
    for (const q of [run, "วัดทดสอบ", "เกจิทดสอบ"]) {
      const r = await guest.get("/api/amulets").query({
        q,
        category: categoryId,
        min: 2000,
        max: 3000,
        sort: "price_asc",
        limit: 1,
      });
      expect(r.status).toBe(200);
      expect(r.body.items[0].id).toBe(listingId);
      expect(r.body.limit).toBe(1);
    }
    expect(
      (await guest.get("/api/amulets").query({ q: run, min: 3000 })).body.total,
    ).toBe(0);
    expect((await guest.get("/api/amulets?limit=100000")).status).toBe(400);
  });
  it("counts same visitor once per listing per day", async () => {
    const before = await db.amulet.findUniqueOrThrow({
      where: { id: listingId },
    });
    expect((await guest.get(`/api/amulets/${listingId}`)).status).toBe(200);
    expect((await guest.get(`/api/amulets/${listingId}`)).status).toBe(200);
    expect(
      (await db.amulet.findUniqueOrThrow({ where: { id: listingId } })).views,
    ).toBe(before.views);
  });
  it("opens listing and shop details concurrently without counting a visitor twice", async () => {
    const shop = (await alice.get("/api/me/shop")).body;
    for (const [entityId, path, type] of [
      [listingId, `/api/amulets/${listingId}`, "amulet"],
      [shop.id, `/api/shops/${shop.slug}`, "shop"],
    ] as const) {
      const previous = type === "amulet"
        ? await db.amulet.findUniqueOrThrow({ where: { id: entityId } })
        : await db.shop.findUniqueOrThrow({ where: { id: entityId } });
      const previousEvents = await db.viewEvent.count({ where: { entityId } });
      const cookie = `visitor=${randomBytes(32).toString("hex")}`;
      const responses = await Promise.all(Array.from({ length: 6 }, () => request(app).get(path).set("Cookie", cookie)));
      expect(responses.map((r) => r.status)).toEqual(Array(6).fill(200));
      const updated = type === "amulet"
        ? await db.amulet.findUniqueOrThrow({ where: { id: entityId } })
        : await db.shop.findUniqueOrThrow({ where: { id: entityId } });
      expect(updated.views).toBe(previous.views + 1);
      expect(await db.viewEvent.count({ where: { entityId } })).toBe(previousEvents + 1);
      expect((await request(app).get(path).set("Cookie", cookie)).status).toBe(200);
    }
  });
  it("public shop and listing omit private contacts, email and profile phone", async () => {
    const s = await alice.get("/api/me/shop");
    shopSlug = s.body.slug;
    const result = await write(
      alice,
      aliceCsrf,
      "/me/shop",
      {
        name: "ร้านทดสอบความเป็นส่วนตัว",
        description: "รายละเอียดร้านทดสอบ",
        active: true,
        contacts: [
          {
            type: "PHONE",
            value: "0812345678",
            visible: false,
            primary: false,
            sortOrder: 1,
          },
          {
            type: "LINE",
            value: "@publicline",
            visible: true,
            primary: true,
            sortOrder: 0,
          },
        ],
      },
      "put",
    );
    expect(result.status).toBe(200);
    const shop = await guest.get(`/api/shops/${shopSlug}`);
    expect(shop.body.contacts).toHaveLength(1);
    expect(shop.text).not.toContain("0812345678");
    expect(shop.text).not.toContain("@example.test");
    const listing = await guest.get(`/api/amulets/${listingId}`);
    expect(listing.body.shop.contacts).toHaveLength(1);
    expect(listing.text).not.toContain("passwordHash");
  });
  it("rejects javascript and unsafe links in contacts", async () => {
    const r = await write(
      alice,
      aliceCsrf,
      "/me/shop",
      {
        name: "ร้านทดสอบ",
        description: "",
        active: true,
        contacts: [
          {
            type: "WEBSITE",
            value: "javascript:alert(1)",
            visible: true,
            primary: false,
            sortOrder: 0,
          },
        ],
      },
      "put",
    );
    expect(r.status).toBe(400);
  });
  it("favorite operations are idempotent and private", async () => {
    for (let i = 0; i < 2; i++)
      expect(
        (
          await write(
            alice,
            aliceCsrf,
            `/me/favorites/${listingId}`,
            { saved: true },
            "put",
          )
        ).status,
      ).toBe(200);
    expect(
      await db.favorite.count({
        where: { userId: aliceId, amuletId: listingId },
      }),
    ).toBe(1);
    expect((await bob.get("/api/me/favorites")).body.items).toHaveLength(0);
    expect(
      (
        await write(
          alice,
          aliceCsrf,
          `/me/favorites/${listingId}`,
          { saved: false },
          "put",
        )
      ).status,
    ).toBe(200);
  });
  it("notification unread count matches DB; foreign reads cannot change recipient data", async () => {
    const mine = await alice.get("/api/me/notifications");
    expect(mine.body.unread).toBe(
      await db.notification.count({ where: { userId: aliceId, readAt: null } }),
    );
    const id = mine.body.items[0].id;
    await write(bob, bobCsrf, "/me/notifications/read", { id });
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id } })).readAt,
    ).toBeNull();
    await write(alice, aliceCsrf, "/me/notifications/read", { id });
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id } })).readAt,
    ).not.toBeNull();
    await write(alice, aliceCsrf, "/me/notifications/read", {});
    expect((await alice.get("/api/me/notifications")).body.unread).toBe(0);
  });
  it("editing approved listing returns it to review and immediately hides public media", async () => {
    const r = await write(
      alice,
      aliceCsrf,
      `/me/amulets/${listingId}`,
      { ...createBody(), version, title: `แก้ไขพระเครื่อง ${run}` },
      "put",
    );
    expect(r.status).toBe(200);
    version = r.body.version;
    expect(r.body.status).toBe("PENDING");
    expect((await guest.get(`/api/amulets/${listingId}`)).status).toBe(404);
    expect((await guest.get(`/api/media/${imageId}`)).status).toBe(404);
    const approve = await write(
      admin,
      adminCsrf,
      `/admin/amulets/${listingId}/status`,
      { status: "APPROVED", version },
    );
    version = approve.body.version;
  });
  it("creates reports and admin resolves them with an audit entry", async () => {
    expect(
      (
        await write(bob, bobCsrf, `/amulets/${listingId}/reports`, {
          reason: "ข้อมูลที่น่าสงสัย",
          details: "ต้องการให้ตรวจสอบรายละเอียด",
        })
      ).status,
    ).toBe(201);
    const report = await db.report.findFirstOrThrow({
      where: { amuletId: listingId },
    });
    expect(
      (
        await write(
          admin,
          adminCsrf,
          `/admin/reports/${report.id}`,
          { resolution: "ตรวจสอบและติดต่อเจ้าของประกาศแล้ว" },
          "put",
        )
      ).status,
    ).toBe(200);
    expect(
      (await db.report.findUniqueOrThrow({ where: { id: report.id } }))
        .resolved,
    ).toBe(true);
    expect(
      await db.auditLog.count({
        where: { entityId: report.id, action: "REPORT_RESOLVED" },
      }),
    ).toBe(1);
  });
  it("suspension cannot be bypassed by owner closing then resubmitting", async () => {
    const r = await write(
      admin,
      adminCsrf,
      `/admin/amulets/${listingId}/status`,
      { status: "SUSPENDED", reason: "ตรวจสอบเพิ่มเติมก่อนเผยแพร่", version },
    );
    version = r.body.version;
    expect(r.status).toBe(200);
    expect(
      (
        await write(
          alice,
          aliceCsrf,
          `/me/amulets/${listingId}`,
          { ...createBody(), version },
          "put",
        )
      ).status,
    ).toBe(403);
    expect(
      (await write(alice, aliceCsrf, `/me/amulets/${listingId}/close`, {}))
        .status,
    ).toBe(403);
    const restore = await write(
      admin,
      adminCsrf,
      `/admin/amulets/${listingId}/status`,
      { status: "APPROVED", version },
    );
    expect(restore.status).toBe(200);
    version = restore.body.version;
  });
  it("pausing a shop hides both listing and media until reopened", async () => {
    const shop = (await alice.get("/api/me/shop")).body;
    const data = {
      name: shop.name,
      description: shop.description,
      contacts: shop.contacts,
      active: false,
    };
    await write(alice, aliceCsrf, "/me/shop", data, "put");
    expect((await guest.get(`/api/amulets/${listingId}`)).status).toBe(404);
    expect((await guest.get(`/api/shops/${shopSlug}`)).status).toBe(404);
    expect((await guest.get(`/api/media/${imageId}`)).status).toBe(404);
    await write(alice, aliceCsrf, "/me/shop", { ...data, active: true }, "put");
  });
  it("popup checks schedule, audience, page and server-side frequency", async () => {
    const now = Date.now(),
      body = {
        name: "test",
        title: "ประกาศทดสอบ",
        body: "ข้อความประกาศ",
        imageId: null,
        buttonText: null,
        url: null,
        active: true,
        startsAt: new Date(now - 60000).toISOString(),
        endsAt: new Date(now + 3600000).toISOString(),
        audience: "GUEST",
        page: "/test-popup",
        delaySeconds: 0,
        maxViews: 1,
        oncePerSession: true,
        intervalHours: 24,
      };
    const r = await write(admin, adminCsrf, "/admin/content/popups", body);
    expect(r.status).toBe(201);
    popupId = r.body.id;
    expect((await alice.get("/api/popups?page=/test-popup")).body).toHaveLength(
      0,
    );
    expect((await guest.get("/api/popups?page=/wrong")).body).toHaveLength(0);
    expect(
      (await guest.get("/api/popups?page=/test-popup")).body.some(
        (p: { id: string }) => p.id === popupId,
      ),
    ).toBe(true);
    expect(
      (await write(guest, "", `/popups/${popupId}/claim`, { page: "/wrong" }))
        .status,
    ).toBe(409);
    expect(
      (
        await write(guest, "", `/popups/${popupId}/claim`, {
          page: "/test-popup",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await write(guest, "", `/popups/${popupId}/claim`, {
          page: "/test-popup",
        })
      ).status,
    ).toBe(409);
    expect((await guest.get("/api/popups?page=/test-popup")).body).toHaveLength(
      0,
    );
    expect(await db.popupView.count({ where: { popupId } })).toBe(1);
    await write(
      admin,
      adminCsrf,
      `/admin/content/popups/${popupId}`,
      {
        ...body,
        startsAt: new Date(now - 120000).toISOString(),
        endsAt: new Date(now - 60000).toISOString(),
      },
      "put",
    );
    expect(
      (await request(app).get("/api/popups?page=/test-popup")).body,
    ).toHaveLength(0);
  });
  it("returns multiple popup announcements and tracks each claim independently", async () => {
    const visitor = request.agent(app), ids: string[] = [];
    const body = {
      name: `slides_${run}`, title: "ประกาศหลายสไลด์", body: "ข้อความสำหรับการทดสอบ",
      imageId: null, buttonText: null, url: null, active: true,
      startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(),
      audience: "GUEST", page: `/slides-${run}`, delaySeconds: 0, maxViews: 1, oncePerSession: true, intervalHours: 0,
    };
    for (let i = 0; i < 3; i++) {
      const response = await write(admin, adminCsrf, "/admin/content/popups", { ...body, title: `ประกาศสไลด์ ${i + 1}` });
      expect(response.status).toBe(201);
      ids.push(response.body.id);
    }
    const list = await visitor.get("/api/popups").query({ page: body.page });
    expect(list.body.map((p: { id: string }) => p.id)).toEqual(ids);
    expect((await write(visitor, "", `/popups/${ids[0]}/claim`, { page: body.page })).status).toBe(200);
    expect((await visitor.get("/api/popups").query({ page: body.page })).body.map((p: { id: string }) => p.id)).toEqual(ids.slice(1));
    expect((await write(visitor, "", `/popups/${ids[1]}/claim`, { page: body.page })).status).toBe(200);
    expect((await write(visitor, "", `/popups/${ids[0]}/claim`, { page: body.page })).status).toBe(409);
    expect(await db.popupView.count({ where: { popupId: ids[0] } })).toBe(1);
    expect(await db.popupView.count({ where: { popupId: ids[1] } })).toBe(1);
    expect(await db.popupView.count({ where: { popupId: ids[2] } })).toBe(0);
    for (const id of ids) await write(admin, adminCsrf, `/admin/content/popups/${id}`, {}, "delete");
  });
  it("scheduled banners and announcements use real storage and CRUD", async () => {
    const now = Date.now(),
      body = {
        title: `แบนเนอร์ ${run}`,
        imageId: null,
        url: "/catalog",
        active: true,
        sortOrder: 1,
        startsAt: new Date(now - 60000).toISOString(),
        endsAt: new Date(now + 60000).toISOString(),
      };
    const r = await write(admin, adminCsrf, "/admin/content/banners", body);
    expect(r.status).toBe(201);
    expect(
      (await guest.get("/api/content")).body.banners.some(
        (b: { id: string }) => b.id === r.body.id,
      ),
    ).toBe(true);
    await write(
      admin,
      adminCsrf,
      `/admin/content/banners/${r.body.id}`,
      { ...body, active: false },
      "put",
    );
    expect(
      (await guest.get("/api/content")).body.banners.some(
        (b: { id: string }) => b.id === r.body.id,
      ),
    ).toBe(false);
    expect(
      (
        await write(
          admin,
          adminCsrf,
          `/admin/content/banners/${r.body.id}`,
          {},
          "delete",
        )
      ).status,
    ).toBe(200);
  });
  it("counts referrals at registration and rejects the removed verification policy", async () => {
    const current = (await guest.get("/api/settings")).body;
    expect(current.referralCountAt).toBe("REGISTRATION");
    expect((await alice.get("/api/me/referrals")).body.counted).toBe(1);
    expect((await write(admin, adminCsrf, "/admin/settings", { ...current, referralCountAt: "VERIFICATION" }, "put")).status).toBe(400);
  });
  it("session reads do not consume credential attempt quota", async () => {
    for (let i = 0; i < 55; i++)
      expect((await guest.get("/api/auth/me")).status).toBe(200);
    expect(
      (
        await write(alice, aliceCsrf, "/auth/login", {
          username: `test_alice_${run}`,
          password: testPassword,
        })
      ).status,
    ).toBe(200);
  });
  it("paginates managed content and persists announcement create, edit and delete", async () => {
    const ids: string[] = [];
    for (const title of ["ข่าวหนึ่ง", "ข่าวสอง"]) {
      const r = await write(admin, adminCsrf, "/admin/content/announcements", {
        title: `${title} ${run}`,
        body: "เนื้อหาสำหรับทดสอบข่าวสาร",
        active: true,
      });
      expect(r.status).toBe(201);
      ids.push(r.body.id);
    }
    const a = (await admin.get("/api/admin/content?limit=1&page=1")).body;
    const b = (await admin.get("/api/admin/content?limit=1&page=2")).body;
    expect(a.announcements).toHaveLength(1);
    expect(b.announcements).toHaveLength(1);
    expect(a.announcements[0].id).not.toBe(b.announcements[0].id);
    expect(a.totals.announcements).toBeGreaterThanOrEqual(2);
    expect(
      (
        await write(
          admin,
          adminCsrf,
          `/admin/content/announcements/${ids[0]}`,
          {
            title: "แก้ไขข่าวสาร",
            body: "เนื้อหาที่แก้ไขเรียบร้อย",
            active: false,
          },
          "put",
        )
      ).status,
    ).toBe(200);
    expect(
      (await guest.get("/api/content")).body.announcements.some(
        (v: { id: string }) => v.id === ids[0],
      ),
    ).toBe(false);
    for (const id of ids)
      expect(
        (
          await write(
            admin,
            adminCsrf,
            `/admin/content/announcements/${id}`,
            {},
            "delete",
          )
        ).status,
      ).toBe(200);
  });
  it("suspending account revokes sessions, hides listings and blocks login", async () => {
    const r = await write(
      admin,
      adminCsrf,
      `/admin/users/${aliceId}`,
      {
        status: "SUSPENDED",
        maxListings: 50,
        reason: "ระงับเพื่อทดสอบการบังคับสิทธิ์",
      },
      "put",
    );
    expect(r.status).toBe(200);
    expect((await alice.get("/api/me/amulets")).status).toBe(401);
    expect((await guest.get(`/api/amulets/${listingId}`)).status).toBe(404);
    expect((await guest.get(`/api/media/${imageId}`)).status).toBe(404);
    expect(
      (
        await guest
          .post("/api/auth/login")
          .set("Origin", origin)
          .send({ username: `test_alice_${run}`, password: testPassword })
      ).status,
    ).toBe(401);
    await write(
      admin,
      adminCsrf,
      `/admin/users/${aliceId}`,
      {
        status: "ACTIVE",
        maxListings: 50,
        reason: "สิ้นสุดทดสอบการระงับบัญชี",
      },
      "put",
    );
  });
  it("rejects short passwords and duplicate usernames regardless of case; accepts username-only login", async () => {
    const payload = { username: `policy_${run}`, displayName: "ทดสอบรหัสผ่าน", password: "Ab12345" };
    expect((await write(guest, "", "/auth/register", payload)).status).toBe(400);
    const registered = await write(request.agent(app), "", "/auth/register", { ...payload, username: `  POLICY_${run.toUpperCase()}  `, password: "Ab123456" });
    expect(registered.status).toBe(201);
    expect(registered.body.user.username).toBe(payload.username);
    expect(registered.body.user.email).toBeUndefined();
    expect(registered.body.user.emailVerifiedAt).toBeUndefined();
    expect((await write(request.agent(app), "", "/auth/register", { ...payload, username: payload.username.toUpperCase(), password: "Ab123456" })).status).toBe(409);
    expect((await write(request.agent(app), "", "/auth/login", { username: payload.username.toUpperCase(), password: "Ab123456" })).status).toBe(200);
    expect((await write(request.agent(app), "", "/auth/login", { email: "obsolete@example.test", password: "Ab123456" })).status).toBe(400);
  });
  it("removes all email reset and verification endpoints", async () => {
    for (const path of ["/auth/forgot", "/auth/reset", "/auth/verify", "/me/verification"])
      expect((await write(bob, bobCsrf, path, {})).status).toBe(404);
  });
  it("changes a password of exactly eight characters and revokes every session", async () => {
    const other = request.agent(app);
    expect((await write(other, "", "/auth/login", { username: `test_bob_${run}`, password: testPassword })).status).toBe(200);
    expect((await write(bob, bobCsrf, "/me/password", { currentPassword: "wrong", password: "New482!x" })).status).toBe(400);
    expect((await write(bob, bobCsrf, "/me/password", { currentPassword: testPassword, password: "short12" })).status).toBe(400);
    expect((await write(bob, bobCsrf, "/me/password", { currentPassword: testPassword, password: "New482!x" })).status).toBe(200);
    expect((await bob.get("/api/me/shop")).status).toBe(401);
    expect((await other.get("/api/me/shop")).status).toBe(401);
    expect((await write(other, "", "/auth/login", { username: `test_bob_${run}`, password: testPassword })).status).toBe(401);
    const loggedIn = await write(bob, "", "/auth/login", { username: `test_bob_${run}`, password: "New482!x" });
    expect(loggedIn.status).toBe(200);
    bobCsrf = loggedIn.body.csrf;
  });
  it("operator recovery requires an active super admin and records an audit while revoking sessions", async () => {
    const env = { ...process.env, OPERATOR_USERNAME: `test_bob_${run}`, TARGET_USERNAME: `test_bob_${run}`, NEW_PASSWORD: "Help482!", RESET_REASON: "ยืนยันเจ้าของบัญชีผ่านช่องทางที่บันทึกไว้แล้ว" };
    await expect(runFile(process.execPath, ["--import", "tsx", "scripts/reset-password.ts"], { env })).rejects.toMatchObject({ code: 1 });
    expect((await bob.get("/api/me/shop")).status).toBe(200);
    env.OPERATOR_USERNAME = `test_admin_${run}`;
    await expect(runFile(process.execPath, ["--import", "tsx", "scripts/reset-password.ts"], { env: { ...env, NEW_PASSWORD: "short12" } })).rejects.toMatchObject({ code: 1 });
    const result = await runFile(process.execPath, ["--import", "tsx", "scripts/reset-password.ts"], { env });
    expect(result.stdout).not.toContain(env.NEW_PASSWORD);
    expect(result.stderr).toBe("");
    expect((await bob.get("/api/me/shop")).status).toBe(401);
    expect(await db.auditLog.count({ where: { actorId: adminId, entityId: bobId, action: "PASSWORD_RESET_BY_OPERATOR" } })).toBe(1);
    expect((await write(bob, "", "/auth/login", { username: env.TARGET_USERNAME, password: env.NEW_PASSWORD })).status).toBe(200);
  });
  it("accepts twelve images, persists a selected primary image and rejects a thirteenth", async () => {
    const uploader = request.agent(app);
    const r = await register(uploader, "gallery");
    expect(r.status).toBe(201);
    const ids: string[] = [];
    const buffer = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#884422" } }).png().toBuffer();
    for (let i = 0; i < 13; i++) {
      const upload = await uploader.post("/api/uploads").set("Origin", origin).set("X-CSRF-Token", r.body.csrf).attach("image", buffer, "test.png");
      expect(upload.status).toBe(201);
      ids.push(upload.body.id);
    }
    expect((await write(uploader, r.body.csrf, "/me/amulets", { ...createBody(), imageIds: ids, draft: true })).status).toBe(400);
    const twelve = ids.slice(0, 12);
    const created = await write(uploader, r.body.csrf, "/me/amulets", { ...createBody(), imageIds: twelve, draft: true });
    expect(created.status).toBe(201);
    const reordered = [twelve[11], ...twelve.slice(0, 11)];
    expect((await write(uploader, r.body.csrf, `/me/amulets/${created.body.id}`, { ...createBody(), imageIds: reordered, draft: true, version: created.body.version }, "put")).status).toBe(200);
    const detail = await uploader.get(`/api/me/amulets/${created.body.id}`);
    expect(detail.body.images.map((v: { uploadId: string }) => v.uploadId)).toEqual(reordered);
  });
  it("persists show/sale type, clears showcase prices and reviews type changes before publication", async () => {
    const collector = request.agent(app);
    const account = await register(collector, "showcase");
    const token = account.body.csrf;
    const buffer = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#986532" } }).png().toBuffer();
    const upload = await collector.post("/api/uploads").set("Origin", origin).set("X-CSRF-Token", token).attach("image", buffer, "show.png");
    expect(upload.status).toBe(201);
    const body = { ...createBody(), title: `พระสำหรับโชว์ ${run}`, imageIds: [upload.body.id], listingType: "SHOW" };
    const created = await write(collector, token, "/me/amulets", { ...body, price: undefined, priceType: undefined });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ listingType: "SHOW", price: null, priceType: "ASK", status: "PENDING" });
    const id = created.body.id;
    const withPrice = await write(collector, token, `/me/amulets/${id}`, { ...body, price: 5000, version: created.body.version }, "put");
    expect(withPrice.status).toBe(200);
    expect(withPrice.body.price).toBeNull();
    expect((await write(admin, adminCsrf, `/admin/amulets/${id}/status`, { status: "APPROVED", version: withPrice.body.version, reason: "ตรวจสอบประกาศสำหรับโชว์แล้ว" })).status).toBe(200);
    const published = await guest.get(`/api/amulets/${id}`);
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ listingType: "SHOW", price: null });
    const catalog = await guest.get("/api/amulets").query({ q: body.title });
    expect(catalog.body.items[0]).toMatchObject({ id, listingType: "SHOW", price: null });
    expect((await guest.get("/api/amulets").query({ q: body.title, min: 0 })).body.total).toBe(0);
    const version = published.body.version;
    expect((await write(collector, token, `/me/amulets/${id}`, { ...body, listingType: "OTHER", version }, "put")).status).toBe(400);
    expect((await write(collector, token, `/me/amulets/${id}`, { ...body, listingType: "SALE", price: null, priceType: "FIXED", version }, "put")).status).toBe(400);
    const sale = await write(collector, token, `/me/amulets/${id}`, { ...body, listingType: "SALE", price: 2500, priceType: "FIXED", version }, "put");
    expect(sale.status).toBe(200);
    expect(sale.body).toMatchObject({ listingType: "SALE", price: "2500", status: "PENDING" });
    expect((await guest.get(`/api/amulets/${id}`)).status).toBe(404);
    const asked = await write(collector, token, `/me/amulets/${id}`, { ...body, listingType: "SALE", price: null, priceType: "ASK", version: sale.body.version }, "put");
    expect(asked.status).toBe(200);
    expect(asked.body).toMatchObject({ listingType: "SALE", price: null, priceType: "ASK" });
  });
  it("admin password reset enforces role boundaries, confirmation and administrator password", async () => {
    const manager = request.agent(app), member = request.agent(app), moderator = request.agent(app);
    const m = await register(manager, "manager"), u = await register(member, "reset_target"), mod = await register(moderator, "moderator");
    for (const [id, name] of [[m.body.user.id, "ADMIN"], [mod.body.user.id, "MODERATOR"]] as const) {
      const role = await db.role.findUniqueOrThrow({ where: { name } });
      await db.user.update({ where: { id }, data: { roleId: role.id } });
    }
    const body = { currentPassword: testPassword, password: "Reset82!", confirmPassword: "Reset82!", reason: "ยืนยันเจ้าของบัญชีแล้ว" };
    const endpoint = `/admin/users/${u.body.user.id}/password`;
    expect((await write(request.agent(app), "", endpoint, body)).status).toBe(401);
    expect((await write(member, u.body.csrf, endpoint, body)).status).toBe(403);
    expect((await write(moderator, mod.body.csrf, endpoint, body)).status).toBe(403);
    expect((await write(manager, "", endpoint, body)).status).toBe(403);
    expect((await write(manager, m.body.csrf, endpoint, { ...body, currentPassword: "wrong" })).status).toBe(400);
    expect((await write(manager, m.body.csrf, endpoint, { ...body, confirmPassword: "Different82!" })).status).toBe(400);
    expect((await write(manager, m.body.csrf, endpoint, { ...body, password: "short12", confirmPassword: "short12" })).status).toBe(400);
    expect((await write(manager, m.body.csrf, `/admin/users/${adminId}/password`, body)).status).toBe(403);
    expect((await write(manager, m.body.csrf, `/admin/users/${mod.body.user.id}/password`, body)).status).toBe(403);
    expect((await write(manager, m.body.csrf, `/admin/users/${m.body.user.id}/password`, body)).status).toBe(400);
    expect((await write(manager, m.body.csrf, endpoint, body)).status).toBe(200);
    expect((await member.get("/api/me/shop")).status).toBe(401);
    expect((await write(member, "", "/auth/login", { username: u.body.user.username, password: testPassword })).status).toBe(401);
    expect((await write(member, "", "/auth/login", { username: u.body.user.username, password: body.password })).status).toBe(200);
    const target = await db.user.findUniqueOrThrow({ where: { id: u.body.user.id }, include: { role: true } });
    expect(target.role.name).toBe("MEMBER");
    expect(target.status).toBe("ACTIVE");
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: target.id, action: "PASSWORD_RESET_BY_ADMIN" } });
    expect(audit.actorId).toBe(m.body.user.id);
    expect(audit.detail).toBe(body.reason);
    expect(JSON.stringify(audit)).not.toContain(body.password);
    expect((await write(admin, adminCsrf, `/admin/users/${m.body.user.id}/password`, body)).status).toBe(200);
    expect((await manager.get("/api/admin/users")).status).toBe(401);
    expect((await write(admin, adminCsrf, `/admin/users/${adminId}/password`, body)).status).toBe(400);
  });
  it("logout deletes server session and health checks database", async () => {
    expect((await write(admin, adminCsrf, "/auth/logout", {})).status).toBe(
      200,
    );
    expect((await admin.get("/api/admin/stats")).status).toBe(401);
    expect((await request(app).get("/api/health")).body.status).toBe("ok");
  });
  it("enforces credential rate limits while allowing session reads", async () => {
    let limited = false;
    for (let i = 0; i < 51; i++) {
      const result = await guest
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ username: "!", password: "" });
      if (result.status === 429) {
        limited = true;
        break;
      }
      expect(result.status).toBe(400);
    }
    expect(limited).toBe(true);
    expect((await guest.get("/api/auth/me")).status).toBe(200);
  });
});
