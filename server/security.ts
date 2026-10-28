import { createHmac, randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { Prisma, RoleName } from "@prisma/client";
import { db } from "./db.js";
import { config } from "./config.js";
export type AuthUser = Prisma.UserGetPayload<{
  include: { role: true; profile: true };
}>;
declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
    sessionId?: string;
    csrf?: string;
  }
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (s: string) =>
  createHmac("sha256", config.SESSION_SECRET).update(s).digest("hex");
export const random = () => randomBytes(32).toString("hex");
export const staffRoles: RoleName[] = ["SUPER_ADMIN", "ADMIN", "MODERATOR"];
export const managerRoles: RoleName[] = ["SUPER_ADMIN", "ADMIN"];
export async function session(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const raw = req.cookies?.sid;
    if (raw) {
      const s = await db.session.findUnique({
        where: { id: hash(raw) },
        include: { user: { include: { role: true, profile: true } } },
      });
      if (s && s.expiresAt > new Date() && s.user.status === "ACTIVE") {
        req.user = s.user;
        req.sessionId = s.id;
        req.csrf = s.csrf;
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}
export function auth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "กรุณาเข้าสู่ระบบอีกครั้ง"));
  next();
}
export const roles =
  (allowed: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "กรุณาเข้าสู่ระบบ"));
    if (!allowed.includes(req.user.role.name))
      return next(new HttpError(403, "คุณไม่มีสิทธิ์ดำเนินการนี้"));
    next();
  };
export function csrf(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.headers.origin !== config.APP_ORIGIN)
    return next(new HttpError(403, "แหล่งที่มาของคำขอไม่ถูกต้อง"));
  if (req.user && req.headers["x-csrf-token"] !== req.csrf)
    return next(new HttpError(403, "คำขอหมดอายุ กรุณาโหลดหน้าใหม่"));
  next();
}
export async function createSession(
  userId: string,
  res: Response,
  oldId?: string,
) {
  const token = random();
  const csrfToken = random();
  await db.$transaction(async (tx) => {
    if (oldId) await tx.session.deleteMany({ where: { id: oldId } });
    await tx.session.create({
      data: {
        id: hash(token),
        userId,
        csrf: csrfToken,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
  });
  res.cookie("sid", token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 86400000,
    path: "/",
  });
  return csrfToken;
}
export const publicWhere: Prisma.AmuletWhereInput = {
  deletedAt: null,
  status: "APPROVED",
  shop: { active: true, user: { status: "ACTIVE" } },
  category: { active: true },
};
export const publicInclude = {
  category: true,
  images: {
    orderBy: { sortOrder: "asc" as const },
    select: { uploadId: true, sortOrder: true },
  },
  shop: { select: { id: true, name: true, slug: true, logoId: true } },
};
export const publicUser = (u: AuthUser) => ({
  id: u.id,
  username: u.username,
  role: u.role.name,
  profile: u.profile,
  referralCode: u.referralCode,
  createdAt: u.createdAt,
  maxListings: u.maxListings,
});
