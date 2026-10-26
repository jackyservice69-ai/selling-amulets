export interface User {
  id: string;
  username: string;
  role: "MEMBER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
  referralCode: string;
  createdAt: string;
  maxListings: number;
  profile: {
    displayName: string;
    phone: string | null;
    avatarId: string | null;
  };
}
export interface Contact {
  id?: string;
  type: string;
  value: string;
  visible: boolean;
  primary: boolean;
  sortOrder: number;
}
export interface Shop {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  featured: boolean;
  logoId: string | null;
  coverId: string | null;
  contacts: Contact[];
  createdAt: string;
  views: number;
  _count?: { amulets: number };
}
export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageId: string | null;
  active: boolean;
  sortOrder: number;
}
export interface History {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
  actor?: { username: string };
}
export interface Amulet {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  category: Category;
  temple: string;
  master: string;
  year: string;
  material: string;
  size: string;
  condition: string;
  price: string | null;
  priceType: string;
  listingType: "SALE" | "SHOW";
  status: string;
  version: number;
  featured: boolean;
  rejectionReason: string | null;
  views: number;
  createdAt: string;
  updatedAt: string;
  images: { uploadId: string; sortOrder: number }[];
  shop: Shop;
  histories?: History[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface Notice {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
}
export interface Popup {
  id: string;
  name: string;
  title: string;
  body: string;
  imageId: string | null;
  buttonText: string | null;
  url: string | null;
  active: boolean;
  startsAt: string;
  endsAt: string;
  audience: string;
  page: string;
  delaySeconds: number;
  maxViews: number;
  oncePerSession: boolean;
  intervalHours: number;
}
export interface Banner {
  id: string;
  title: string;
  imageId: string | null;
  url: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
  active: boolean;
  createdAt: string;
}
export interface Settings {
  socialLinks: {id:string;label:string;url:string;enabled:boolean}[];
  registrationEnabled: boolean;
  name: string;
  description: string;
  footer: string;
  contact: string;
  primaryColor: string;
  logoId: string | null;
  faviconId: string | null;
  heroId: string | null;
  notice: string;
  maxImages: number;
  maxImageMb: number;
  maxListings: number;
  approvalPolicy: string;
  referralCountAt: string;
}
export const statuses: Record<string, string> = {
  DRAFT: "แบบร่าง",
  PENDING: "รอตรวจสอบ",
  APPROVED: "เผยแพร่แล้ว",
  REJECTED: "ไม่อนุมัติ",
  SUSPENDED: "ระงับประกาศ",
  CLOSED: "ปิดประกาศ",
};
export const money = (value: string | number | null) =>
  value === null
    ? "สอบถามราคา"
    : new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        maximumFractionDigits: 0,
      }).format(Number(value));
export const listingTypeLabel = (type: Amulet["listingType"]) => type === "SHOW" ? "สำหรับโชว์" : "สำหรับขาย";
export const listingPrice = (item: Pick<Amulet, "listingType" | "price">) => item.listingType === "SHOW" ? "ไม่เปิดขาย" : money(item.price);
export const date = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
export const media = (id: string | null | undefined, thumb = false) =>
  id ? `/api/media/${id}${thumb ? "?thumb=1" : ""}` : "/brand/mark.svg";
