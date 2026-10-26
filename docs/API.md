# API — ตลาดพระเครื่อง

POST `/admin/users`: ADMIN สร้างได้เฉพาะ MEMBER; SUPER_ADMIN สร้าง MEMBER/MODERATOR/ADMIN/SUPER_ADMIN ได้ รับ `{username,password,confirmPassword,displayName,role,currentPassword,reason}` รหัสใหม่อย่างน้อย 8 ตัวและยืนยันตรงกัน ต้องยืนยันรหัสผู้ดูแลและมีเหตุผลอย่างน้อย 5 ตัว ตรวจสิทธิ์ซ้ำใน Serializable transaction และลง audit USER_CREATED_BY_ADMIN ไม่คืน passwordHash ไม่ล็อกอินเป็นบัญชีใหม่ และใช้ได้แม้ปิดสมัครสมาชิกสาธารณะ จำกัด 10 ครั้ง/ผู้ดูแล/15 นาที MODERATOR/MEMBER ไม่มีสิทธิ์

PUT `/admin/social`: ADMIN/SUPER_ADMIN ส่ง `{socialLinks:[{id,label,url,enabled}]}` สูงสุด 12 ช่องทาง URL ต้อง HTTPS ยาวไม่เกิน 500 ตัวอักษร เก็บใน site settings JSON โดยคงค่าอื่นไว้ แสดงเฉพาะ enabled ในหน้า /contact และ footer การแก้ settings ทั่วไปคง socialLinks ล่าสุดเพื่อไม่เขียนทับค่าจากเมนู Social

## การบีบอัดรูปและเปิด–ปิดรับสมาชิก

POST `/uploads` ใช้กับรูปประกาศ ป๊อปอัป และช่องอัปโหลดอื่นทั้งหมด ตรวจชนิดไฟล์จริง (JPG/PNG/WebP ภาพนิ่ง) ขนาดต้นฉบับตาม maxImageMb และจำนวนพิกเซลไม่เกิน 40 ล้าน ก่อนประมวลผลบนเซิร์ฟเวอร์: หมุนตาม EXIF, ไม่ขยายรูปเล็ก, ลบ EXIF/GPS, รักษาความโปร่งใส และสร้าง WebP สองขนาด

- รูปหลัก: ด้านยาวสูงสุด 1600 พิกเซล ไม่เกิน 1 MiB; เริ่ม quality 84 ลด quality หรือขนาดเมื่อจำเป็น
- รูปย่อ: ด้านยาวสูงสุด 600 พิกเซล ไม่เกิน 150 KiB; เริ่ม quality 76
- ประมวลผลทั้งสองไฟล์ให้สำเร็จก่อนเขียน storage และสร้างแถว uploads; ไม่เก็บต้นฉบับ หากบันทึกล้มเหลวจะพยายามลบไฟล์ใหม่ทั้งคู่ ไม่มีข้อมูลไบนารีรูปในฐานข้อมูล ฐานข้อมูลเก็บ id/เจ้าของ/storage keys ตามเดิม
- Response เพิ่ม `optimization:{format,width,height,originalBytes,imageBytes,thumbnailBytes}` นอกเหนือจาก `id`; นโยบายมีผลกับการอัปโหลดใหม่ ไม่เปลี่ยนรูปที่บันทึกไว้แล้ว

GET `/settings` มี `registrationEnabled:boolean` ค่าเริ่มต้น true สำหรับข้อมูลเดิม PUT `/admin/settings` ต้องส่ง boolean นี้เสมอ และใช้ได้เฉพาะ SUPER_ADMIN เมื่อเป็น false POST `/auth/register` คืน 403 ข้อความปิดรับสมัคร โดยตรวจทั้งก่อน hash และใน transaction ก่อนสร้างบัญชี การเข้าสู่ระบบและบัญชีเดิมยังใช้ได้ เมื่อเปิดกลับเป็น true สมัครได้ตามปกติ ค่านี้บันทึกใน site_settings JSON เดิม จึงไม่ต้องเพิ่ม migration

## แจ้งเรื่องถึงผู้ดูแล

Migration `202610260006_support_tickets` เพิ่มตาราง `support_tickets` และ `support_messages` โดยแยกจากรายงานประกาศเดิม

| เส้นทาง | การใช้งาน |
|---|---|
| GET `/me/support?status=OPEN&page=1&limit=12` | รายการของผู้ใช้ปัจจุบันเท่านั้น; status ไม่ระบุ = ทั้งหมด |
| POST `/me/support` | สร้างเรื่องด้วย `{subject, body, clientRequestId}` |
| GET `/me/support/:id?page=1` | อ่านเรื่องตนเองพร้อมประวัติ; ถ้าไม่ส่ง page เปิดหน้าสุดท้าย |
| POST `/me/support/:id/messages` | เพิ่มข้อความด้วย `{body, version, clientRequestId}` และตั้งเป็น OPEN แม้เดิมปิดแล้ว |
| GET `/admin/support` และ `/admin/support/:id` | รายการ/บทสนทนาทั้งหมด เฉพาะ ADMIN และ SUPER_ADMIN |
| POST `/admin/support/:id/messages` | `{body, version, clientRequestId, status?}`; status เป็น ANSWERED (ค่าเริ่มต้น) หรือ CLOSED |

หัวข้อ 3–160 ตัวอักษร ข้อความ 1–5000 ตัวอักษรหลัง trim, clientRequestId เป็น UUID ที่ client คงเดิมเมื่อ retry payload เดิม และเปลี่ยนเมื่อแก้ข้อความ รายการแบ่งหน้าได้สูงสุด 48 เรื่อง ประวัติแบ่งหน้าครั้งละ 20 ข้อความเรียงเก่าไปใหม่ คืน `{ticket, messages:{items,total,page,limit}}` เมื่อเปิดรายละเอียด ทุกการเขียนต้องมี Origin/CSRF; จำกัดรวม 30 ครั้งต่อผู้ส่งใน 15 นาที

สร้างเรื่อง/ข้อความ/แจ้งเตือนทำใน Serializable transaction เดียวกัน พร้อมตรวจสิทธิ์ซ้ำและ version การตอบชนกันคืน 409 โดยไม่เพิ่มข้อความ คำขอซ้ำของผู้ส่งและ UUID เดิมไม่เพิ่มข้อความหรือแจ้งเตือนซ้ำ ทุกข้อความของผู้แจ้งแจ้งถึงผู้ดูแลที่ ACTIVE ผ่านกระดิ่ง ลิงก์ `/admin/support/:id`; คำตอบผู้ดูแลแจ้งผู้แจ้งที่ `/dashboard/support/:id` และลง audit `SUPPORT_REPLIED` กระดิ่งดึงข้อมูลทุก 30 วินาทีและเมื่อกดเปิด หน้าสนทนาดึงใหม่ทุก 30 วินาที มีปุ่มโหลดเรื่องล่าสุด และรีเฟรชเมื่อกดลิงก์แจ้งเตือนเรื่องเดิม

Base URL `/api` บน origin เดียวกับเว็บไซต์ รับ JSON ยกเว้น upload ที่ใช้ multipart/form-data เวลาตอบกลับ ISO 8601 UTC ราคาทศนิยมจาก MySQL อาจเป็น string ห้ามคำนวณราคาโดยอาศัย float สำหรับงานการเงิน (ระบบนี้ไม่มีธุรกรรมการเงิน)

## Session และข้อผิดพลาด

สมัคร/เข้าสู่ระบบคืน `{user, csrf}` พร้อม HttpOnly `sid` cookie เก็บ CSRF ในหน่วยความจำ ฝั่ง client ส่ง `credentials: include` ทุกครั้ง ทุกคำขอเขียนต้องมี `Origin` ตรง `APP_ORIGIN` และเมื่อเข้าสู่ระบบแล้วต้องส่ง `X-CSRF-Token` จาก `/auth/me` หรือผล login ด้วย รวม logout/change password ที่ทำขณะล็อกอินอยู่ ห้ามใส่ session token ใน URL หรือ localStorage

Error: `{error: "ข้อความไทย", fields?: [{field, message}]}` รหัส 400 validation, 401 ไม่ล็อกอิน/หมดอายุ, 403 ไม่มีสิทธิ์/CSRF, 404 ไม่พบหรือไม่มีสิทธิ์เห็น, 409 ข้อมูลซ้ำ/เวอร์ชันขัดแย้ง, 429 เกินอัตรา, 500 ระบบขัดข้อง

รายการส่วนใหญ่รับ `page` (1–10000), `limit` (1–48 ค่าเริ่มต้น 12) คืน `{items,total,page,limit}` ไม่ส่งรหัสผ่าน hash หรือ session ของผู้ใช้อื่น

## ผู้เยี่ยมชมและ Authentication

| Method / path | ข้อมูลและผลลัพธ์ |
|---|---|
| GET `/health` | ตรวจ MySQL จริง คืน `{status:"ok"}` |
| POST `/auth/register` | `username,password,displayName,ref?` รหัสผ่าน 8 ตัวอักษรขึ้นไป ไม่เกิน 72 ไบต์ สร้างร้านและ session |
| POST `/auth/login` | `username,password` หมุน session เดิม คืน user/CSRF |
| GET `/auth/me` | สมาชิกปัจจุบันหรือ null และ CSRF |
| POST `/auth/logout` | ลบ session ปัจจุบัน |
| GET `/settings` | การตั้งค่าเว็บไซต์ที่แสดงสาธารณะ ไม่มี secrets |
| GET `/categories` | หมวดหมู่เปิดใช้งาน เรียง sortOrder |
| GET `/amulets` | `q,category,shop,min,max,sort,featured,page,limit`; shop เป็น slug; sort: newest, price_asc, price_desc, popular |
| GET `/amulets/:id` | ประกาศ APPROVED ของร้าน/บัญชี/หมวดที่เปิดใช้งานเท่านั้น พร้อมช่องทางที่เปิดเผย นับ view ผู้เยี่ยมชมหนึ่งครั้งต่อวัน |
| GET `/shops` | `featured,page,limit` ร้านเปิดใช้งาน |
| GET `/shops/:slug` | ข้อมูลร้าน ยอดประกาศและยอดเข้าชม; ดึงประกาศแยกด้วย `/amulets?shop=:slug` |
| GET `/content` | `{banners,announcements}` เฉพาะเนื้อหาที่เปิดและอยู่ในช่วงเวลา |
| GET `/popups?page=/catalog` | popup ที่ตรงหน้า/กลุ่ม/ช่วงเวลา/จำนวนครั้ง |
| POST `/popups/:id/claim` | `{page:"/catalog"}` จองการแสดงแบบ transaction ตรวจกลุ่มและความถี่ซ้ำ คืน popup หรือ409 |
| GET `/media/:id?thumb=1` | bytes WebP ตรวจสิทธิ์และสถานะทุกครั้ง `Cache-Control:no-store` |

## สมาชิก (ทุก role ที่ล็อกอิน)

| Method / path | ข้อมูลและผลลัพธ์ |
|---|---|
| GET/PUT `/me/shop` | `name,description,active,logoId,coverId,contacts[]`; contacts: type,value,visible,primary,sortOrder |
| PUT `/me/profile` | `displayName,phone,avatarId` รูปต้องเป็นของผู้ใช้ |
| POST `/me/password` | `currentPassword,password` รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร ยกเลิก session ทั้งหมด |
| GET `/me/amulets` | ประกาศของตน `q,status,page,limit` |
| GET `/me/amulets/:id` | รายละเอียดและประวัติของประกาศตนเอง |
| POST `/me/amulets` | สร้างตาม payload ด้านล่าง คืน201 |
| PUT `/me/amulets/:id` | แก้ไข ต้องส่ง version ปัจจุบัน กลับ PENDING หรือ DRAFT ตามคำขอ |
| POST `/me/amulets/:id/close` | ปิดประกาศ ยกเว้นประกาศถูกระงับ |
| POST `/uploads` | multipart field `image` ไฟล์ JPEG/PNG/WebP ภาพนิ่ง คืน `{id,...}` |
| GET `/me/notifications` | pagination และ `unread` ทั้งหมด |
| POST `/me/notifications/read` | `{id}` อ่านหนึ่งรายการ หรือ `{}` อ่านทั้งหมดของตน |
| GET `/me/favorites` | ประกาศที่ยังเปิดเผยได้ในรายการโปรดของตน |
| PUT `/me/favorites/:id` | `{saved:boolean}` idempotent |
| GET `/me/referrals` | items,total,page,limit,code,url,countAt,counted; `total` ผู้สมัครทั้งหมด `counted` นับเมื่อสมัครสมาชิก (`REGISTRATION`) |
| POST `/amulets/:id/reports` | `reason,details` รายงานประกาศ public คืน201 |

ตัวอย่างประกาศหลังอัปโหลดรูปและโหลด category ID จริง:

```json
{
  "title":"พระเครื่องตัวอย่างสำหรับทดสอบ",
  "description":"รายละเอียดที่เจ้าของประกาศระบุ อย่างน้อยยี่สิบตัวอักษร",
  "categoryId":"ID_FROM_CATEGORIES",
  "temple":"วัดตัวอย่าง", "master":"", "year":"", "material":"เนื้อผง",
  "size":"", "condition":"รายละเอียดสภาพ",
  "priceType":"FIXED", "price":2500,
  "imageIds":["ID_FROM_UPLOAD"], "draft":false
}
```

ภาพแรกเป็นภาพหลัก `ASK` ใช้ `price:null` ตอนแก้ไขเพิ่ม `version` ที่อ่านล่าสุด ห้ามกำหนด shopId/status จาก client; server เป็นผู้ตัดสิน บัญชี MEMBER เผยแพร่เองไม่ได้ การแก้ไขประกาศถูกระงับถูกปฏิเสธ

## ผู้ตรวจสอบ MODERATOR / ADMIN / SUPER_ADMIN

| Method / path | ข้อมูล |
|---|---|
| GET `/admin/stats` | ตัวเลขและกราฟรายวัน/เดือน |
| GET `/admin/amulets` | `q,status,page,limit` รวมภาพ/ประวัติเพื่อตรวจสอบ |
| POST `/admin/amulets/:id/status` | `status,reason,version`; APPROVED/REJECTED/SUSPENDED/CLOSED/PENDING; REJECTED และ SUSPENDED ต้องมีเหตุผล |
| GET `/admin/reports` | pagination รายงาน |
| PUT `/admin/reports/:id` | `resolution` ปิดรายงานและ audit |

การอนุมัติและแจ้งเตือนอยู่ใน transaction ใช้ version และ unique eventKey ป้องกันแจ้งซ้ำ การ retry ผลอนุมัติเดิมคืนผลเดิม ไม่สร้างประวัติซ้ำ

## ADMIN / SUPER_ADMIN

| Method / path | ข้อมูล |
|---|---|
| PUT `/admin/amulets/:id/featured` | `{featured}` ปักหมุด |
| PUT `/admin/shops/:id/featured` | `{featured}` ร้านแนะนำ |
| GET `/admin/users` | `q,page,limit` ข้อมูลจัดการที่ไม่มี password/token |
| PUT `/admin/users/:id` | `status,maxListings,role?,reason` เปลี่ยนสถานะและยกเลิก sessions; เปลี่ยน role ได้เฉพาะ SUPER_ADMIN; ห้ามจัดการบัญชีตนเอง |
| GET/POST `/admin/categories` | list หรือสร้าง `name,slug,parentId,imageId,sortOrder,active` |
| PUT `/admin/categories/:id` | แก้ไข category ตรวจ parent ไม่วนซ้ำ ใช้ active=false แทนลบหมวดที่มีประกาศ |
| GET `/admin/content` | page,limit; arrays popups/banners/announcements และ totals แยกชนิด |
| POST `/admin/content/:kind` | kind: popups,banners,announcements |
| PUT/DELETE `/admin/content/:kind/:id` | แก้ไข/ลบเนื้อหา |
| GET `/admin/audit` | pagination ประวัติผู้ดำเนินการ |

Popup: `name,title,body,imageId,buttonText,url,active,startsAt,endsAt,audience,page,delaySeconds,maxViews,oncePerSession,intervalHours` audience ALL/GUEST/MEMBER; page `*` หรือ pathname; ช่วงเวลา ISO UTC

ป๊อปอัปหน้าเว็บใช้หลายรายการเป็นสไลด์: GET `/popups` เรียง `startsAt ASC,id ASC` ตรวจจากรายการที่ตรงเงื่อนไขสูงสุด 20 รายการแล้วกรองความถี่ ผู้ชมจะเห็นแต่ละรายการหลังครบ delaySeconds ของรายการนั้น ก่อนแสดงสไลด์ครั้งแรกเรียก claim ของรายการนั้นเท่านั้น การวนซ้ำภายในชุดที่เปิดอยู่ใช้ผลที่ claim แล้วโดยไม่เพิ่ม view ซ้ำ รายการที่ได้รับ 404/409 จะถูกข้าม ส่วนเครือข่ายขัดข้องขณะเลื่อนจะคงสไลด์ปัจจุบันและให้ลองอีกครั้ง ไม่มีการเปลี่ยนรูปแบบ payload หรือ schema

Banner: `title,imageId,url,sortOrder,active,startsAt,endsAt` ข่าวสาร: `title,body,active` URL ภายในเว็บหรือ HTTPS เท่านั้น

## SUPER_ADMIN เท่านั้น

PUT `/admin/settings`: payload ตาม `server/validation.ts#settingsSchema` ประกอบด้วย name,description,footer,contact,primaryColor,logoId,faviconId,heroId,notice,maxImages(1–12),maxImageMb(1–15),maxListings(1–1000),approvalPolicy(`ALWAYS_REVIEW`),referralCountAt(`REGISTRATION` เท่านั้น) บันทึก audit

ทุก role ถูกบังคับใน backend แม้เรียก API ตรง ระบบใช้ cookies จาก browser สำหรับ visitor view/popup; ผู้เยี่ยมชมที่ล้าง cookie อาจถูกนับเป็นผู้เยี่ยมชมใหม่

Username ใช้อักษรอังกฤษ ตัวเลข หรือ `_` จำนวน 3–40 ตัว ตัดช่องว่างหัวท้ายและแปลงเป็นตัวพิมพ์เล็กก่อนตรวจสอบ ไม่ต้องส่งอีเมล ระบบไม่มี public endpoint สำหรับกู้บัญชี; เส้นทางอีเมลเดิมคืน 404

POST `/admin/users/:id/password`: เฉพาะ ADMIN/SUPER_ADMIN พร้อม session/Origin/CSRF รับ `{currentPassword,password,confirmPassword,reason}` โดย currentPassword เป็นรหัสของผู้ดูแล รหัสใหม่อย่างน้อย 8 ตัวอักษร ยืนยันตรงกัน เหตุผล 5–1000 ตัวอักษร ADMIN รีเซ็ตได้เฉพาะ MEMBER; SUPER_ADMIN รีเซ็ตบัญชีอื่นได้ทุก role; ห้ามรีเซ็ตตนเอง เสร็จแล้วคืน `{ok:true}` เพิกถอนทุก session ของเป้าหมาย บันทึก `PASSWORD_RESET_BY_ADMIN` และแจ้งเตือนในระบบ จำกัด 10 คำขอ/15นาที/ผู้ดูแล ไม่เปลี่ยนสถานะหรือสิทธิ์ของเป้าหมาย

จำนวน `imageIds` ต่อประกาศสูงสุด 12 ตามค่าเริ่มต้นของ site settings และ hard limit ของ validation; รูปแรกเป็นรูปหลัก จัดลำดับโดยส่ง array ใหม่ผ่านการแก้ไขประกาศ การเปลี่ยนรูปหลักของประกาศที่เผยแพร่แล้วต้องกลับตรวจสอบตามนโยบายเดิม

`listingType`: `SALE` (สำหรับขาย; ค่าเริ่มต้น) หรือ `SHOW` (สำหรับโชว์) ใน payload สร้าง/แก้ไขและ response ประกาศทุกหน้า แบบ SHOW ไม่บังคับราคาและ normalize ฝั่ง server เป็น `price:null,priceType:"ASK"` แม้ client ส่งราคามาด้วย การแสดงผลต้องตรวจ listingType ก่อน price เพื่อแสดง “ไม่เปิดขาย” แทน “สอบถามราคา” แบบ SALE/FIXED ต้องมีราคา; SALE/ASK ไม่ต้องมีราคา ค่าประเภทอื่นคืน 400 การเปลี่ยนประเภทกลับ PENDING หรือ DRAFT ตามการบันทึกและตรวจ version เช่นเดียวกับการแก้ไขอื่น
