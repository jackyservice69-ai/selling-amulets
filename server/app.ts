import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import multer from "multer";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import pino from "pino";
import { resolve } from "node:path";
import { db, containsText } from "./db.js";
import { config } from "./config.js";
import {
  session,
  auth,
  roles,
  csrf,
  createSession,
  hash,
  random,
  HttpError,
  publicUser,
  staffRoles,
  managerRoles,
  publicWhere,
  publicInclude,
} from "./security.js";
import {
  registerSchema,
  loginSchema,
  password,
  username,
  shopSchema,
  profileSchema,
  settingsSchema,
  categorySchema,
  campaignSchema,
  bannerSchema,
  text,
} from "./validation.js";
import { settings, processUpload, getObject } from "./storage.js";
import { supportRouter } from "./support.js";
import {
  saveListing,
  moderate,
  searchListings,
  paging,
  notifyStaff,
  verifyImages,
  recordView,
  popupEligible,
} from "./services.js";
export const logger = pino({
  redact: ["req.headers.cookie", "password", "currentPassword", "confirmPassword", "email", "token"],
});
export const app = express();
app.disable("x-powered-by");
if (config.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "blob:", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: config.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use(cors({ origin: config.APP_ORIGIN, credentials: true }));
app.use(express.json({ limit: "300kb" }), cookieParser());
app.use("/api", session);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    keyGenerator: (req) =>
      req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip || "127.0.0.1"),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "คำขอมากเกินไป กรุณาลองใหม่ในหนึ่งนาที" },
  }),
);
app.get("/api/health", async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
});
app.use("/api", csrf);
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 50,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "พยายามเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาที" },
});
app.post(
  [
    "/api/auth/register",
    "/api/auth/login",
  ],
  authLimit,
);
app.post("/api/auth/register", async (req, res) => {
  if (!(await settings()).registrationEnabled) throw new HttpError(403, "ขณะนี้ปิดรับสมัครสมาชิกชั่วคราว");
  const data = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await db.$transaction(async (tx) => {
    if (!(await settings(tx)).registrationEnabled) throw new HttpError(403, "ขณะนี้ปิดรับสมัครสมาชิกชั่วคราว");
    const referrer = data.ref
      ? await tx.user.findUnique({ where: { referralCode: data.ref } })
      : null;
    if (data.ref && !referrer) throw new HttpError(400, "รหัสแนะนำไม่ถูกต้อง");
    if (referrer?.username.toLowerCase() === data.username)
      throw new HttpError(400, "ไม่สามารถแนะนำตัวเองได้");
    const role = await tx.role.findUniqueOrThrow({ where: { name: "MEMBER" } });
    const user = await tx.user.create({
      data: {
        username: data.username,
        passwordHash,
        roleId: role.id,
        referralCode: random().slice(0, 12).toUpperCase(),
        profile: { create: { displayName: data.displayName } },
        shop: {
          create: {
            name: `ร้าน${data.displayName}`,
            slug: `${data.username}-${random().slice(0, 6)}`,
            description: "",
          },
        },
      },
      include: { role: true, profile: true },
    });
    if (referrer)
      await tx.referral.create({
        data: { referrerId: referrer.id, referredId: user.id },
      });
    return user;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const token = await createSession(user.id, res, req.sessionId);
  res.status(201).json({ user: publicUser(user), csrf: token });
});
app.post("/api/auth/login", async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await db.user.findUnique({
    where: { username: data.username },
    include: { role: true, profile: true },
  });
  const valid = await bcrypt.compare(
    data.password,
    user?.passwordHash ??
      "$2b$12$jBgBhHjaQBbcGca4q9tVRenVqTW1v4d71A8CtHVNHhcvdqrb8tzGW",
  );
  if (!user || !valid || user.status !== "ACTIVE")
    throw new HttpError(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ");
  const token = await createSession(user.id, res, req.sessionId);
  res.json({ user: publicUser(user), csrf: token });
});
app.get("/api/auth/me", (req, res) =>
  res.json({
    user: req.user ? publicUser(req.user) : null,
    csrf: req.csrf ?? null,
  }),
);
app.post("/api/auth/logout", auth, async (req, res) => {
  await db.session.deleteMany({ where: { id: req.sessionId } });
  res.clearCookie("sid", { path: "/" }).json({ ok: true });
});
app.post("/api/me/password", auth, async (req, res) => {
  const data = z
    .object({ currentPassword: z.string().max(100), password })
    .parse(req.body);
  if (!(await bcrypt.compare(data.currentPassword, req.user!.passwordHash)))
    throw new HttpError(400, "รหัสผ่านปัจจุบันไม่ถูกต้อง");
  const passwordHash = await bcrypt.hash(data.password, 12);
  await db.$transaction([
    db.user.update({ where: { id: req.user!.id }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId: req.user!.id } }),
  ]);
  res.clearCookie("sid", { path: "/" }).json({ ok: true });
});
app.get("/api/settings", async (_req, res) => res.json(await settings()));
app.get("/api/categories", async (_req, res) =>
  res.json(
    await db.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ),
);
app.get("/api/amulets", async (req, res) =>
  res.json(await searchListings(req.query)),
);
function visitor(req: Request, res: Response) {
  let v = req.cookies.visitor as string | undefined;
  if (!v || !/^\w{64}$/.test(v)) {
    v = random();
    res.cookie("visitor", v, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.NODE_ENV === "production",
      maxAge: 365 * 86400000,
      path: "/",
    });
  }
  return hash(v);
}
app.get("/api/amulets/:id", async (req, res) => {
  const a = await db.amulet.findFirst({
    where: { ...publicWhere, id: String(req.params.id) },
    include: {
      ...publicInclude,
      shop: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoId: true,
          description: true,
          createdAt: true,
          contacts: {
            where: { visible: true },
            orderBy: [{ primary: "desc" }, { sortOrder: "asc" }],
          },
        },
      },
    },
  });
  if (!a) throw new HttpError(404, "ไม่พบประกาศที่เผยแพร่");
  await recordView(a.id, "amulet", visitor(req, res));
  res.json(a);
});
app.get("/api/shops", async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const where: Prisma.ShopWhereInput = {
    active: true,
    user: { status: "ACTIVE" },
    ...(req.query.featured === "true" ? { featured: true } : {}),
  };
  const [items, total] = await db.$transaction([
    db.shop.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoId: true,
        featured: true,
        views: true,
        _count: { select: { amulets: { where: publicWhere } } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.shop.count({ where }),
  ]);
  res.json({ items, total, page, limit });
});
app.get("/api/shops/:slug", async (req, res) => {
  const shop = await db.shop.findFirst({
    where: {
      slug: String(req.params.slug),
      active: true,
      user: { status: "ACTIVE" },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoId: true,
      coverId: true,
      views: true,
      createdAt: true,
      contacts: {
        where: { visible: true },
        orderBy: [{ primary: "desc" }, { sortOrder: "asc" }],
      },
      _count: { select: { amulets: { where: publicWhere } } },
    },
  });
  if (!shop) throw new HttpError(404, "ไม่พบร้านค้าที่เปิดอยู่");
  await recordView(shop.id, "shop", visitor(req, res));
  res.json(shop);
});
app.get("/api/content", async (_req, res) => {
  const now = new Date(),
    where = { active: true, startsAt: { lte: now }, endsAt: { gte: now } };
  const [banners, announcements] = await Promise.all([
    db.banner.findMany({ where, orderBy: { sortOrder: "asc" }, take: 20 }),
    db.announcement.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  res.json({ banners, announcements });
});
app.get("/api/popups", async (req, res) => {
  const now = new Date(),
    v = visitor(req, res);
  let s = req.cookies.popupSession as string | undefined;
  if (!s || !/^\w{64}$/.test(s)) {
    s = random();
    res.cookie("popupSession", s, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.NODE_ENV === "production",
      path: "/",
    });
  }
  const popups = await db.popup.findMany({
    where: {
      active: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [{ page: String(req.query.page ?? "/") }, { page: "*" }],
      audience: { in: ["ALL", req.user ? "MEMBER" : "GUEST"] },
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 20,
  });
  const eligible = [];
  for (const p of popups)
    if (await popupEligible(p, req.user?.id ?? v, hash(s))) eligible.push(p);
  res.json(eligible);
});
app.post("/api/popups/:id/claim", async (req, res) => {
  const { page } = z.object({ page: text(200, 1) }).parse(req.body);
  const v = req.user?.id ?? visitor(req, res),
    s = req.cookies.popupSession;
  if (!s) throw new HttpError(409, "กรุณาโหลดข้อมูลใหม่");
  const result = await db.$transaction(
    async (tx) => {
      const now = new Date();
      const p = await tx.popup.findFirst({
        where: {
          id: String(req.params.id),
          OR: [{ page }, { page: "*" }],
          active: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
          audience: { in: ["ALL", req.user ? "MEMBER" : "GUEST"] },
        },
      });
      if (!p || !(await popupEligible(p, v, hash(s), tx)))
        throw new HttpError(409, "ประกาศนี้แสดงครบตามกำหนดแล้ว");
      await tx.popupView.create({
        data: {
          popupId: p.id,
          visitorKey: v,
          sessionKey: hash(s),
          userId: req.user?.id,
        },
      });
      return p;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  res.json(result);
});
app.get("/api/me/shop", auth, async (req, res) =>
  res.json(
    await db.shop.findUnique({
      where: { userId: req.user!.id },
      include: { contacts: { orderBy: { sortOrder: "asc" } } },
    }),
  ),
);
app.put("/api/me/shop", auth, async (req, res) => {
  const data = shopSchema.parse(req.body);
  const result = await db.$transaction(async (tx) => {
    const ids = [data.logoId, data.coverId].filter((x): x is string => !!x);
    await verifyImages(tx, req.user!.id, [...new Set(ids)]);
    const { contacts, ...fields } = data;
    return tx.shop.update({
      where: { userId: req.user!.id },
      data: { ...fields, contacts: { deleteMany: {}, create: contacts } },
      include: { contacts: true },
    });
  });
  res.json(result);
});
app.put("/api/me/profile", auth, async (req, res) => {
  const data = profileSchema.parse(req.body);
  if (data.avatarId) await verifyImages(db, req.user!.id, [data.avatarId]);
  res.json(
    await db.userProfile.update({ where: { userId: req.user!.id }, data }),
  );
});
app.get("/api/me/amulets", auth, async (req, res) => {
  const { page, limit, skip } = paging(req.query),
    where = { shop: { userId: req.user!.id } };
  const [items, total] = await db.$transaction([
    db.amulet.findMany({
      where,
      include: {
        ...publicInclude,
        histories: { orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    db.amulet.count({ where }),
  ]);
  res.json({ items, total, page, limit });
});
app.get("/api/me/amulets/:id", auth, async (req, res) => {
  const a = await db.amulet.findFirst({
    where: { id: String(req.params.id), shop: { userId: req.user!.id } },
    include: {
      ...publicInclude,
      histories: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!a) throw new HttpError(404, "ไม่พบประกาศของคุณ");
  res.json(a);
});
app.post("/api/me/amulets", auth, async (req, res) =>
  res.status(201).json(await saveListing(req.user!.id, req.body)),
);
app.put("/api/me/amulets/:id", auth, async (req, res) =>
  res.json(await saveListing(req.user!.id, req.body, String(req.params.id))),
);
app.post("/api/me/amulets/:id/close", auth, async (req, res) => {
  const id = String(req.params.id);
  await db.$transaction(async (tx) => {
    const a = await tx.amulet.findFirst({
      where: { id, shop: { userId: req.user!.id } },
    });
    if (!a) throw new HttpError(404, "ไม่พบประกาศของคุณ");
    if (a.status === "SUSPENDED")
      throw new HttpError(403, "ประกาศถูกระงับ กรุณาติดต่อผู้ดูแล");
    if (a.status === "CLOSED") return;
    await tx.amulet.update({
      where: { id },
      data: { status: "CLOSED", version: { increment: 1 } },
    });
    await tx.amuletStatusHistory.create({
      data: {
        amuletId: id,
        actorId: req.user!.id,
        status: "CLOSED",
        reason: "เจ้าของปิดประกาศ",
      },
    });
  });
  res.json({ ok: true });
});
app.use("/api/me/support", auth, supportRouter(false));
app.use("/api/admin/support", roles(managerRoles), supportRouter(true));
app.get("/api/me/notifications", auth, async (req, res) => {
  const { page, limit, skip } = paging(req.query),
    where = { userId: req.user!.id };
  const [items, total, unread] = await db.$transaction([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  res.json({ items, total, page, limit, unread });
});
app.post("/api/me/notifications/read", auth, async (req, res) => {
  const data = z.object({ id: text(100).optional() }).parse(req.body);
  await db.notification.updateMany({
    where: {
      userId: req.user!.id,
      readAt: null,
      ...(data.id ? { id: data.id } : {}),
    },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});
app.get("/api/me/favorites", auth, async (req, res) => {
  const { page, limit, skip } = paging(req.query),
    where = { userId: req.user!.id, amulet: publicWhere };
  const [items, total] = await db.$transaction([
    db.favorite.findMany({
      where,
      include: { amulet: { include: publicInclude } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.favorite.count({ where }),
  ]);
  res.json({ items: items.map((i) => i.amulet), total, page, limit });
});
app.put("/api/me/favorites/:id", auth, async (req, res) => {
  const { saved } = z.object({ saved: z.boolean() }).parse(req.body);
  const amuletId = String(req.params.id),
    userId = req.user!.id;
  if (
    !(await db.amulet.findFirst({
      where: { ...publicWhere, id: amuletId },
      select: { id: true },
    }))
  )
    throw new HttpError(404, "ไม่พบประกาศ");
  if (saved)
    await db.favorite.upsert({
      where: { userId_amuletId: { userId, amuletId } },
      create: { userId, amuletId },
      update: {},
    });
  else await db.favorite.deleteMany({ where: { userId, amuletId } });
  res.json({ saved });
});
app.get("/api/me/referrals", auth, async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const [items, total] = await db.$transaction([
    db.referral.findMany({
      where: { referrerId: req.user!.id },
      select: {
        id: true,
        createdAt: true,
        referred: {
          select: { username: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.referral.count({ where: { referrerId: req.user!.id } }),
  ]);
  res.json({
    items,
    total,
    page,
    limit,
    code: req.user!.referralCode,
    url: `${config.APP_ORIGIN}/register?ref=${req.user!.referralCode}`,
    countAt: "REGISTRATION",
    counted: total,
  });
});
app.post("/api/amulets/:id/reports", auth, async (req, res) => {
  const data = z
    .object({ reason: text(100, 3), details: text(3000) })
    .parse(req.body);
  const id = String(req.params.id);
  if (!(await db.amulet.findFirst({ where: { ...publicWhere, id } })))
    throw new HttpError(404, "ไม่พบประกาศ");
  await db.$transaction(async (tx) => {
    const report = await tx.report.create({
      data: { ...data, userId: req.user!.id, amuletId: id },
    });
    await notifyStaff(
      tx,
      "มีรายงานประกาศใหม่",
      data.reason,
      "/admin/reports",
      `report:${report.id}`,
    );
  });
  res.status(201).json({ ok: true });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});
app.post("/api/uploads", auth, upload.single("image"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "กรุณาเลือกรูปภาพ");
  res.status(201).json(await processUpload(req.user!.id, req.file.buffer));
});
app.get("/api/media/:id", async (req, res) => {
  const id = String(req.params.id),
    image = await db.upload.findUnique({ where: { id } });
  if (!image) throw new HttpError(404, "ไม่พบรูปภาพ");
  let allowed =
    req.user?.id === image.userId ||
    (!!req.user && staffRoles.includes(req.user.role.name));
  if (!allowed) {
    const now = new Date();
    const [listing, shop, banner, popup, category, s] = await Promise.all([
      db.amuletImage.count({ where: { uploadId: id, amulet: publicWhere } }),
      db.shop.count({
        where: {
          active: true,
          user: { status: "ACTIVE" },
          OR: [{ logoId: id }, { coverId: id }],
        },
      }),
      db.banner.count({
        where: {
          imageId: id,
          active: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
      }),
      db.popup.count({
        where: {
          imageId: id,
          active: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
          audience: { in: ["ALL", req.user ? "MEMBER" : "GUEST"] },
        },
      }),
      db.category.count({ where: { imageId: id, active: true } }),
      settings(),
    ]);
    allowed = !!(
      listing ||
      shop ||
      banner ||
      popup ||
      category ||
      [s.logoId, s.heroId, s.faviconId].includes(id)
    );
  }
  if (!allowed) throw new HttpError(404, "ไม่พบรูปภาพ");
  res.setHeader("Cache-Control", "private, no-store");
  res
    .type("image/webp")
    .send(
      await getObject(req.query.thumb === "1" ? image.thumbnailKey : image.key),
    );
});
app.use("/api/admin", roles(staffRoles));
app.get("/api/admin/stats", async (_req, res) => {
  const [
    users,
    shops,
    total,
    pending,
    approved,
    rejected,
    suspended,
    reports,
    views,
    newUsers,
    events,
  ] = await Promise.all([
    db.user.count(),
    db.shop.count(),
    db.amulet.count(),
    db.amulet.count({ where: { status: "PENDING" } }),
    db.amulet.count({ where: { status: "APPROVED" } }),
    db.amulet.count({ where: { status: "REJECTED" } }),
    db.amulet.count({ where: { status: "SUSPENDED" } }),
    db.report.count({ where: { resolved: false } }),
    db.viewEvent.count(),
    db.user.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    }),
    db.viewEvent.groupBy({
      by: ["day"],
      _count: { id: true },
      where: { createdAt: { gte: new Date(Date.now() - 90 * 86400000) } },
      orderBy: { day: "asc" },
    }),
  ]);
  res.json({
    users,
    shops,
    total,
    pending,
    approved,
    rejected,
    suspended,
    reports,
    views,
    newUsers,
    daily: events.map((e) => ({ day: e.day, count: e._count.id })),
  });
});
app.get("/api/admin/amulets", async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const status = z
    .enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "SUSPENDED", "CLOSED"])
    .optional()
    .parse(req.query.status || undefined);
  const where: Prisma.AmuletWhereInput = {
    ...(status ? { status } : {}),
    ...(req.query.q
      ? { title: containsText(String(req.query.q).slice(0, 200)) }
      : {}),
  };
  const [items, total] = await db.$transaction([
    db.amulet.findMany({
      where,
      include: {
        ...publicInclude,
        histories: {
          include: { actor: { select: { username: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    db.amulet.count({ where }),
  ]);
  res.json({ items, total, page, limit });
});
app.post("/api/admin/amulets/:id/status", async (req, res) =>
  res.json(await moderate(req.user!.id, String(req.params.id), req.body)),
);
app.put(
  "/api/admin/amulets/:id/featured",
  roles(managerRoles),
  async (req, res) => {
    const { featured } = z.object({ featured: z.boolean() }).parse(req.body);
    res.json(
      await db.amulet.update({
        where: { id: String(req.params.id) },
        data: { featured },
      }),
    );
  },
);
app.get("/api/admin/reports", async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const [items, total] = await db.$transaction([
    db.report.findMany({
      include: {
        amulet: { select: { title: true, id: true, shopId: true } },
        user: { select: { username: true } },
      },
      orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    db.report.count(),
  ]);
  res.json({ items, total, page, limit });
});
app.put("/api/admin/reports/:id", async (req, res) => {
  const { resolution } = z
    .object({ resolution: text(2000, 5) })
    .parse(req.body);
  res.json(
    await db.$transaction(async (tx) => {
      const r = await tx.report.update({
        where: { id: String(req.params.id) },
        data: { resolved: true, resolution },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "REPORT_RESOLVED",
          entityId: r.id,
          detail: resolution,
        },
      });
      return r;
    }),
  );
});
app.use("/api/admin/users", roles(managerRoles));
app.post("/api/admin/users", rateLimit({windowMs:15*60000,limit:10,keyGenerator:req=>req.user!.id,standardHeaders:"draft-8",legacyHeaders:false}), async (req,res) => {
  const data=z.object({username,password,confirmPassword:z.string(),displayName:text(100,2),role:z.enum(["MEMBER","MODERATOR","ADMIN","SUPER_ADMIN"]).default("MEMBER"),currentPassword:z.string().max(100),reason:text(1000,5)}).parse(req.body);
  if(data.password !== data.confirmPassword) throw new HttpError(400,"ยืนยันรหัสผ่านไม่ตรงกัน");
  if(req.user!.role.name !== "SUPER_ADMIN" && data.role !== "MEMBER") throw new HttpError(403,"ผู้ดูแลสร้างได้เฉพาะบัญชีสมาชิก");
  if(!await bcrypt.compare(data.currentPassword,req.user!.passwordHash)) throw new HttpError(400,"รหัสผ่านของผู้ดูแลไม่ถูกต้อง");
  const passwordHash=await bcrypt.hash(data.password,12);
  const result=await db.$transaction(async tx=>{
    const actor=await tx.user.findUnique({where:{id:req.user!.id},include:{role:true}});
    if(!actor || actor.status !== "ACTIVE" || !managerRoles.includes(actor.role.name) || (actor.role.name !== "SUPER_ADMIN" && data.role !== "MEMBER")) throw new HttpError(403,"คุณไม่มีสิทธิ์สร้างบัญชีประเภทนี้");
    const role=await tx.role.findUniqueOrThrow({where:{name:data.role}});
    const user=await tx.user.create({data:{username:data.username,passwordHash,roleId:role.id,referralCode:random().slice(0,12).toUpperCase(),profile:{create:{displayName:data.displayName}},shop:{create:{name:`ร้าน${data.displayName}`,slug:`${data.username.replace(/[^a-z0-9_-]/g,"-")}-${random().slice(0,6)}`,description:"",active:data.role === "MEMBER"}}},include:{role:true,profile:true}});
    await tx.auditLog.create({data:{actorId:actor.id,action:"USER_CREATED_BY_ADMIN",entityId:user.id,detail:JSON.stringify({role:data.role,reason:data.reason})}});
    return publicUser(user);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  res.status(201).json(result);
});
const passwordResetLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 10,
  keyGenerator: req => req.user!.id,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "รีเซ็ตรหัสผ่านมากเกินไป กรุณารอ 15 นาที" },
});
app.post("/api/admin/users/:id/password", passwordResetLimit, async (req, res) => {
  const id = String(req.params.id);
  const data = z.object({
    currentPassword: z.string().max(100),
    password,
    confirmPassword: z.string().max(72),
    reason: text(1000, 5),
  }).refine(v => v.password === v.confirmPassword, {
    path: ["confirmPassword"], message: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน",
  }).parse(req.body);
  if (!(await bcrypt.compare(data.currentPassword, req.user!.passwordHash)))
    throw new HttpError(400, "รหัสผ่านของผู้ดูแลไม่ถูกต้อง");
  if (id === req.user!.id)
    throw new HttpError(400, "เปลี่ยนรหัสผ่านของตนเองได้ที่หน้าข้อมูลส่วนตัว");
  const passwordHash = await bcrypt.hash(data.password, 12);
  await db.$transaction(async tx => {
    const actor = await tx.user.findUnique({ where: { id: req.user!.id }, include: { role: true } });
    const target = await tx.user.findUnique({ where: { id }, include: { role: true } });
    if (!actor || actor.status !== "ACTIVE" || !managerRoles.includes(actor.role.name) || actor.passwordHash !== req.user!.passwordHash)
      throw new HttpError(403, "สิทธิ์ของคุณเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่");
    if (!target) throw new HttpError(404, "ไม่พบบัญชี");
    if (actor.role.name !== "SUPER_ADMIN" && target.role.name !== "MEMBER")
      throw new HttpError(403, "ผู้ดูแลรีเซ็ตรหัสผ่านได้เฉพาะบัญชีสมาชิก");
    await tx.user.update({ where: { id }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.auditLog.create({ data: { actorId: actor.id, entityId: id, action: "PASSWORD_RESET_BY_ADMIN", detail: data.reason } });
    await tx.notification.create({ data: {
      userId: id, eventKey: `password-reset:${id}:${random()}`,
      title: "ผู้ดูแลรีเซ็ตรหัสผ่านของคุณแล้ว",
      body: "กรุณาเข้าสู่ระบบด้วยรหัสผ่านที่ได้รับและเปลี่ยนรหัสผ่านในหน้าข้อมูลส่วนตัว",
      href: "/dashboard/profile",
    } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ ok: true });
});
app.get("/api/admin/users", async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const q = String(req.query.q ?? "").slice(0, 100);
  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { username: containsText(q) },
          { shop: { name: containsText(q) } },
        ],
      }
    : {};
  const [items, total] = await db.$transaction([
    db.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        status: true,
        maxListings: true,
        createdAt: true,
        profile: true,
        role: { select: { name: true } },
        shop: { select: { id: true, slug: true, name: true, featured: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.user.count({ where }),
  ]);
  res.json({ items, total, page, limit });
});
app.put("/api/admin/users/:id", async (req, res) => {
  const id = String(req.params.id);
  const data = z
    .object({
      status: z.enum(["ACTIVE", "SUSPENDED"]),
      maxListings: z.number().int().min(1).max(1000),
      role: z.enum(["MEMBER", "MODERATOR", "ADMIN", "SUPER_ADMIN"]).optional(),
      reason: text(1000, 5),
    })
    .parse(req.body);
  const target = await db.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!target) throw new HttpError(404, "ไม่พบบัญชี");
  if (id === req.user!.id)
    throw new HttpError(400, "ไม่สามารถเปลี่ยนสิทธิ์หรือระงับบัญชีตนเอง");
  if (
    req.user!.role.name !== "SUPER_ADMIN" &&
    (target.role.name !== "MEMBER" || (data.role && data.role !== "MEMBER"))
  )
    throw new HttpError(
      403,
      "เฉพาะผู้ดูแลสูงสุดเท่านั้นที่เปลี่ยนสิทธิ์ผู้ดูแลได้",
    );
  await db.$transaction(async (tx) => {
    const role = data.role
      ? await tx.role.findUniqueOrThrow({ where: { name: data.role } })
      : null;
    await tx.user.update({
      where: { id },
      data: {
        status: data.status,
        maxListings: data.maxListings,
        ...(role ? { roleId: role.id } : {}),
      },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.notification.create({
      data: {
        userId: id,
        title: "สถานะบัญชีมีการเปลี่ยนแปลง",
        body: data.reason,
        href: "/dashboard",
        eventKey: `account:${id}:${random()}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "USER_UPDATED",
        entityId: id,
        detail: JSON.stringify(data),
      },
    });
  });
  res.json({ ok: true });
});
app.use("/api/admin/categories", roles(managerRoles));
app.get("/api/admin/categories", async (_req, res) =>
  res.json(await db.category.findMany({ orderBy: { sortOrder: "asc" } })),
);
app.post("/api/admin/categories", async (req, res) => {
  const data = categorySchema.parse(req.body);
  res.status(201).json(await db.category.create({ data }));
});
app.put("/api/admin/categories/:id", async (req, res) => {
  const id = String(req.params.id),
    data = categorySchema.parse(req.body);
  if (data.parentId) {
    let parent: string | null = data.parentId;
    for (let depth = 0; parent; depth++) {
      if (parent === id || depth > 20)
        throw new HttpError(400, "หมวดหมู่ย่อยอ้างอิงวนซ้ำ");
      parent =
        (
          await db.category.findUnique({
            where: { id: parent },
            select: { parentId: true },
          })
        )?.parentId ?? null;
    }
  }
  res.json(await db.category.update({ where: { id }, data }));
});
app.use("/api/admin/content", roles(managerRoles));
app.get("/api/admin/content", async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const [
    popups,
    banners,
    announcements,
    popupCount,
    bannerCount,
    announcementCount,
  ] = await db.$transaction([
    db.popup.findMany({ take: limit, skip, orderBy: { id: "desc" } }),
    db.banner.findMany({ take: limit, skip, orderBy: { id: "desc" } }),
    db.announcement.findMany({ take: limit, skip, orderBy: { id: "desc" } }),
    db.popup.count(),
    db.banner.count(),
    db.announcement.count(),
  ]);
  res.json({
    popups,
    banners,
    announcements,
    page,
    limit,
    totals: {
      popups: popupCount,
      banners: bannerCount,
      announcements: announcementCount,
    },
  });
});
for (const kind of ["popups", "banners", "announcements"] as const) {
  const schema =
    kind === "popups"
      ? campaignSchema
      : kind === "banners"
        ? bannerSchema
        : z.object({
            title: text(200, 1),
            body: text(5000, 1),
            active: z.boolean(),
          });
  app.post(`/api/admin/content/${kind}`, async (req, res) => {
    const data = schema.parse(req.body);
    let item;
    if (kind === "popups")
      item = await db.popup.create({ data: campaignSchema.parse(data) });
    else if (kind === "banners")
      item = await db.banner.create({ data: bannerSchema.parse(data) });
    else
      item = await db.announcement.create({
        data: z
          .object({
            title: text(200, 1),
            body: text(5000, 1),
            active: z.boolean(),
          })
          .parse(data),
      });
    res.status(201).json(item);
  });
  app.put(`/api/admin/content/${kind}/:id`, async (req, res) => {
    const id = String(req.params.id);
    let item;
    if (kind === "popups")
      item = await db.popup.update({
        where: { id },
        data: campaignSchema.parse(req.body),
      });
    else if (kind === "banners")
      item = await db.banner.update({
        where: { id },
        data: bannerSchema.parse(req.body),
      });
    else
      item = await db.announcement.update({
        where: { id },
        data: z
          .object({
            title: text(200, 1),
            body: text(5000, 1),
            active: z.boolean(),
          })
          .parse(req.body),
      });
    res.json(item);
  });
  app.delete(`/api/admin/content/${kind}/:id`, async (req, res) => {
    const id = String(req.params.id);
    if (kind === "popups") await db.popup.delete({ where: { id } });
    else if (kind === "banners") await db.banner.delete({ where: { id } });
    else await db.announcement.delete({ where: { id } });
    res.json({ ok: true });
  });
}
app.get("/api/admin/audit", roles(managerRoles), async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const [items, total] = await db.$transaction([
    db.auditLog.findMany({
      include: { actor: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.auditLog.count(),
  ]);
  res.json({ items, total, page, limit });
});
app.put("/api/admin/settings", roles(["SUPER_ADMIN"]), async (req, res) => {
  const data = settingsSchema.parse(req.body);
  await db.$transaction(async (tx) => {
    data.socialLinks=(await settings(tx)).socialLinks;
    await tx.siteSetting.upsert({
      where: { id: "site" },
      create: { id: "site", value: data },
      update: { value: data },
    });
    await tx.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "SETTINGS_UPDATED",
        entityId: "site",
        detail: "ปรับการตั้งค่าเว็บไซต์",
      },
    });
  });
  res.json(data);
});
app.put("/api/admin/social", roles(managerRoles), async (req,res)=>{
  const data=z.object({socialLinks:settingsSchema.shape.socialLinks}).parse(req.body);
  const saved=await db.$transaction(async tx=>{
    const current=await settings(tx);
    const value={...current,socialLinks:data.socialLinks};
    await tx.siteSetting.upsert({where:{id:"site"},create:{id:"site",value},update:{value}});
    await tx.auditLog.create({data:{actorId:req.user!.id,action:"SOCIAL_UPDATED",entityId:"site",detail:"แก้ไขช่องทางติดต่อ Social"}});
    return value;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  res.json(saved);
});
app.put(
  "/api/admin/shops/:id/featured",
  roles(managerRoles),
  async (req, res) => {
    const { featured } = z.object({ featured: z.boolean() }).parse(req.body);
    res.json(
      await db.shop.update({
        where: { id: String(req.params.id) },
        data: { featured },
      }),
    );
  },
);
app.use("/api", (_req, _res, next) =>
  next(new HttpError(404, "ไม่พบ API ที่ร้องขอ")),
);
if (config.NODE_ENV === "production" || config.SERVE_STATIC) {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบช่องที่กรอก",
      fields: error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof multer.MulterError) {
    res
      .status(400)
      .json({ error: "ไฟล์มีขนาดใหญ่เกินไปหรือจำนวนไฟล์ไม่ถูกต้อง" });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({
        error: "ข้อมูลซ้ำ กรุณาเปลี่ยนชื่อผู้ใช้หรือรหัสที่ใช้",
      });
      return;
    }
    if (["P2025", "P2003"].includes(error.code)) {
      res.status(404).json({ error: "ไม่พบข้อมูลอ้างอิงที่ต้องการ" });
      return;
    }
    if (error.code === "P2034") {
      res.status(409).json({ error: "มีคำขอพร้อมกัน กรุณาลองอีกครั้ง" });
      return;
    }
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" });
    return;
  }
  logger.error(
    { type: error instanceof Error ? error.name : "unknown" },
    "request failed",
  );
  res.status(500).json({ error: "ระบบขัดข้อง กรุณาลองอีกครั้ง" });
});
