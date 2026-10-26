import { db } from "../server/db.js";
import { defaultSettings } from "../server/validation.js";

// Infrastructure data only. Never import local users, shops, listings or demo media.
try {
  for(const name of ["MEMBER","MODERATOR","ADMIN","SUPER_ADMIN"] as const) await db.role.upsert({where:{name},create:{name},update:{}});
  for(const [i,[name,slug]] of [["พระสมเด็จ","somdej"],["พระเหรียญ","medals"],["พระเนื้อผง","powder"],["พระเนื้อดิน","clay"],["พระกริ่ง / รูปหล่อ","statues"],["เครื่องราง / ของสะสม","talismans"]].entries())await db.category.upsert({where:{slug},create:{id:`category-${slug}`,name,slug,sortOrder:i},update:{}});
  await db.siteSetting.upsert({where:{id:"site"},create:{id:"site",value:{...defaultSettings,description:"พื้นที่พบปะของคนรักพระเครื่องและนักสะสม",contact:"ติดต่อผู้ดูแลผ่านระบบแจ้งเรื่องของเว็บไซต์"}},update:{}});
  console.log("Production roles, categories and settings ready. No demo listings created.");
} finally {await db.$disconnect();}
