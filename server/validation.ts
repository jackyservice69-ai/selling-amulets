import { z } from "zod";
z.config(z.locales.th());
export const text = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .min(min, `กรุณากรอกอย่างน้อย ${min} ตัวอักษร`)
    .max(max, `กรอกได้ไม่เกิน ${max} ตัวอักษร`);
export const password = z
  .string()
  .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
  .max(72, "รหัสผ่านยาวเกินไป")
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= 72,
    "รหัสผ่านต้องไม่เกิน 72 ไบต์",
  );
export const safeUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    if (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\"))
      return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "ใช้ลิงก์ HTTPS หรือลิงก์ภายในเว็บไซต์เท่านั้น");
export const username = text(40, 3).regex(/^[a-zA-Z0-9_@.-]+$/, "ใช้ตัวอักษรอังกฤษ ตัวเลข _ @ . หรือ -").transform(v => v.toLowerCase());
export const registerSchema = z.object({ username, password, displayName: text(100, 2), ref: text(20).optional() });
export const loginSchema = z.object({ username, password: z.string().max(100) });
export const listingSchema = z
  .object({
    title: text(200, 5),
    description: text(10000, 20),
    categoryId: text(100, 1),
    temple: text(150).default(""),
    master: text(150).default(""),
    year: text(30).default(""),
    listingType: z.enum(["SALE", "SHOW"]).default("SALE"),
    price: z.coerce.number().min(0).max(9999999999).nullable().default(null),
    priceType: z.enum(["FIXED", "ASK"]).default("FIXED"),
    imageIds: z
      .array(text(100, 1))
      .min(1, "กรุณาเพิ่มรูปภาพ")
      .max(12)
      .refine((a) => new Set(a).size === a.length, "รูปภาพซ้ำ"),
    draft: z.boolean().default(false),
    version: z.number().int().optional(),
  })
  .refine((v) => v.listingType === "SHOW" || v.priceType !== "FIXED" || v.price !== null, {
    path: ["price"], message: "กรุณาระบุราคาสำหรับประกาศขาย",
  })
  .transform(v => v.listingType === "SHOW" ? { ...v, price: null, priceType: "ASK" as const } : v);
const contact = z
  .object({
    type: z.enum([
      "PHONE",
      "LINE",
      "LINE_URL",
      "FACEBOOK",
      "MESSENGER",
      "WEBSITE",
      "INSTAGRAM",
      "TIKTOK",
      "OTHER",
    ]),
    value: text(500, 1),
    visible: z.boolean(),
    primary: z.boolean(),
    sortOrder: z.number().int().min(0).max(100),
  })
  .superRefine((v, ctx) => {
    const valid =
      v.type === "PHONE"
        ? /^[+\d ()-]{6,30}$/.test(v.value)
        : v.type === "LINE"
          ? /^[\w.@-]{1,100}$/.test(v.value)
          : safeUrl.safeParse(v.value).success &&
            v.value.startsWith("https://");
    if (!valid)
      ctx.addIssue({
        code: "custom",
        message: "ช่องทางติดต่อไม่ถูกต้อง ใช้ HTTPS สำหรับลิงก์",
        path: ["value"],
      });
  });
export const shopSchema = z
  .object({
    name: text(120, 2),
    description: text(5000),
    active: z.boolean(),
    logoId: text(100).nullable().optional(),
    coverId: text(100).nullable().optional(),
    contacts: z.array(contact).max(15),
  })
  .refine(
    (s) => s.contacts.filter((c) => c.primary).length <= 1,
    "ตั้งช่องทางหลักได้หนึ่งรายการ",
  );
export const profileSchema = z.object({
  displayName: text(100, 2),
  phone: text(30).nullable(),
  avatarId: text(100).nullable(),
});
export const settingsSchema = z.object({
  socialLinks: z.array(z.object({id:z.uuid(),label:text(60,1),url:z.url().max(500).refine(v=>new URL(v).protocol === "https:","ใช้ลิงก์ HTTPS เท่านั้น"),enabled:z.boolean()})).max(12).default([]),
  registrationEnabled: z.boolean(),
  name: text(100, 2),
  description: text(300),
  footer: text(500),
  contact: text(300),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoId: text(100).nullable(),
  faviconId: text(100).nullable(),
  heroId: text(100).nullable(),
  notice: text(500),
  maxImages: z.number().int().min(1).max(12),
  maxImageMb: z.number().int().min(1).max(15),
  maxListings: z.number().int().min(1).max(1000),
  approvalPolicy: z.literal("ALWAYS_REVIEW"),
  referralCountAt: z.literal("REGISTRATION"),
});
export const defaultSettings: z.infer<typeof settingsSchema> = {
  socialLinks: [],
  registrationEnabled: true,
  name: "ตลาดพระเครื่อง",
  description:
    "พื้นที่พบปะของคนรักพระเครื่อง ค้นพบเรื่องราวและสิ่งสะสมที่มีคุณค่า",
  footer: "Thai Amulet Market · พื้นที่ของคนรักพระเครื่อง",
  contact: "ติดต่อผู้ดูแลผ่านช่องทางที่กำหนดในหลังบ้าน",
  primaryColor: "#7c5129",
  logoId: null,
  faviconId: null,
  heroId: null,
  notice:
    "ประกาศทุกชิ้นผ่านการตรวจสอบก่อนเผยแพร่ การอนุมัติไม่ใช่การรับรองความแท้",
  maxImages: 12,
  maxImageMb: 8,
  maxListings: 50,
  approvalPolicy: "ALWAYS_REVIEW",
  referralCountAt: "REGISTRATION",
};
export const categorySchema = z.object({
  name: text(100, 1),
  slug: text(100, 1).regex(/^[a-z0-9-]+$/),
  parentId: text(100).nullable(),
  imageId: text(100).nullable(),
  sortOrder: z.number().int(),
  active: z.boolean(),
});
export const campaignSchema = z
  .object({
    name: text(100, 1),
    title: text(200, 1),
    body: text(5000),
    imageId: text(100).nullable(),
    buttonText: text(100).nullable(),
    url: safeUrl.nullable(),
    active: z.boolean(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    audience: z.enum(["ALL", "GUEST", "MEMBER"]),
    page: text(200, 1),
    delaySeconds: z.number().int().min(0).max(300),
    maxViews: z.number().int().min(1).max(100),
    oncePerSession: z.boolean(),
    intervalHours: z.number().int().min(0).max(8760),
  })
  .refine(
    (v) => new Date(v.endsAt) > new Date(v.startsAt),
    "วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น",
  );
export const bannerSchema = z
  .object({
    title: text(200, 1),
    imageId: text(100).nullable(),
    url: safeUrl,
    sortOrder: z.number().int(),
    active: z.boolean(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  })
  .refine(
    (v) => new Date(v.endsAt) > new Date(v.startsAt),
    "วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น",
  );
