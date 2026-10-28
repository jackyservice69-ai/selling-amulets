# รายงานทดสอบระบบสมาชิก รูปภาพ และผู้ดูแล

## เพิ่มการลบประกาศ — 28 ตุลาคม 2026

- `npm test`: ผ่าน 73/73 รวม 13 กรณีใหม่ใน `tests/listing-deletion.test.ts`: เจ้าของทุกสถานะ, สิทธิ์ ADMIN/SUPER_ADMIN/MODERATOR, CSRF/Origin, IDOR, version เก่า, concurrent delete, rollback เมื่อ audit ล้มเหลว, เก็บรายงานและตรวจ public media ที่ใช้ร่วมกัน
- `npm run lint` และ `npm run build`: ผ่านทั้ง frontend และ server
- E2E การลบบน desktop/mobile: ผ่าน 2/2 ตรวจ Cancel/Escape/focus restoration, ห้ามยกเลิก/ปิด/ส่งซ้ำขณะรอ API, ข้อผิดพลาดและ retry, เหตุผลผู้ดูแล, public 404 หลังลบและ notification เจ้าของ รูปหลักฐาน `output/playwright/delete-owner-desktop.png`, `delete-admin-mobile.png`
- เครื่องนี้มีบริการอื่นครอง `127.0.0.1:3002` ทำให้เริ่มชุดทดสอบด้วยค่าเดิม timeout จึงใช้ API ทดสอบพอร์ต 3012 ผ่าน config ชั่วคราวใน `.tools/playwright-deletion.config.ts` โดยไม่เปลี่ยนพอร์ตแอปหรือปิดบริการอื่น
- Migration PostgreSQL ผ่านบน validation branch แยกจาก production; ทดสอบ owner/manager delete, version conflict, ห้ามเผยแพร่ซ้ำ, ลบพร้อมกันได้ครั้งเดียวและแจ้งเตือนเจ้าของผ่านจริง หลักฐาน `output/postgres-listing-deletion.json`
- Migration เดียวกันผ่าน local/test MySQL และ production Neon โดยตรวจว่าประกาศจริงเดิมทั้ง 2 รายการยังอยู่ และไม่ได้ลบประกาศจริงระหว่างปล่อยระบบ หลักฐาน `output/listing-deletion-production-migration.json`
- ใช้ soft deletion เพื่อรักษา report/history/audit และไฟล์ที่ใช้ร่วมกัน โดยนำออกจากรายการเจ้าของ ผู้ดูแล และสาธารณะ การเก็บข้อมูลนี้ไม่ใช่ hard-delete จาก storage

26 ตุลาคม 2026 (Asia/Bangkok) — Windows, Node.js 26.10.0, MySQL 8.0.44, Prisma 6.19.3

เปลี่ยนตามคำขอผู้ใช้เป็น Username + Password อย่างน้อย 8 ตัวอักษร ไม่เก็บอีเมล ไม่ใช้ Gmail และถอด SMTP การยืนยันและการรีเซ็ตผ่านอีเมลออก

| การตรวจ | ผลและหลักฐาน |
|---|---|
| Prisma generate / migrations | ผ่าน migration 003–006 ทั้ง `amulet_market` และ `amulet_market_test`; สำรองฐานพัฒนาก่อนเปลี่ยน schema |
| Typecheck / lint | ผ่าน frontend และ backend |
| MySQL integration | **60/60 ผ่าน** ไม่มี skip; รอบล่าสุด 22:32 น. ดู `output/test-results.json` |
| Browser E2E | **16/16 ผ่าน** ไม่มี skip/retry ในรอบแยก Desktop 1440×1000 และ Pixel 7 Chromium อย่างละ 8 tests ดู `output/playwright/verification-summary.json` และ `results-desktop.json` / `results-mobile.json` |
| Production build | `npm run build` ผ่าน Vite และ compiled Express |
| Compiled server | HTTP health, static root, asset และ SPA fallback ผ่าน ดู `output/release-smoke.json` |
| บัญชีเดิม / schema | บัญชีผู้ดูแลเดิมใช้ชื่อผู้ใช้และรหัสผ่านเดิมได้ เข้า admin ได้; ไม่มีคอลัมน์อีเมลและตาราง token อีเมล ดู `output/username-auth-smoke.json` |
| Production config | โหลด config ด้วย HTTPS และ session secret โดยไม่มี SMTP ได้ ดู `output/username-auth-smoke.json` |

## กรณีทดสอบที่เกี่ยวกับการเปลี่ยนแปลง

### ประกาศอนุมัติแล้วแต่ร้านปิด — แก้ 26 ตุลาคม 2026

พบประกาศจริง APPROVED ของผู้ดูแลที่ shop.active=false จึงไม่ผ่าน publicWhere เปิดเฉพาะร้านของผู้แจ้งผ่าน API ของเจ้าของร้านโดยคงสถานะประกาศและช่องทางติดต่อเดิมไว้ ตรวจ production แล้วประกาศปรากฏใน catalog/detail และอ่านรูปสาธารณะได้ ไม่เปลี่ยนนโยบายอนุมัติและไม่ยกเว้น publicWhere ให้เจ้าหน้าที่

หน้า “ประกาศของฉัน” เพิ่มคำเตือนร้านปิดพร้อมลิงก์ไปตั้งค่าร้าน แสดงสถานะ “อนุมัติแล้ว” แทน “เผยแพร่แล้ว” และซ่อนลิงก์หน้าสาธารณะระหว่างร้านปิด เพิ่มการทดสอบปิดร้านหลังประกาศอนุมัติ → API 404/คำเตือน → เปิดจากหน้าตั้งค่าจริง → API 200/ลิงก์ดูประกาศ ผ่าน desktop และ mobile 2/2; lint/typecheck/build ผ่าน หลักฐาน output/admin-listing-visibility-fix.json และ output/playwright/shop-closed-warning-{desktop,mobile}.png

### สร้างสมาชิกตามสิทธิ์, Social และ production

- API เพิ่ม 4 tests สำหรับ ADMIN สร้างเฉพาะ MEMBER, SUPER_ADMIN สร้างเจ้าหน้าที่ได้, ปฏิเสธ MEMBER/MODERATOR, ตรวจ CSRF/รหัสผู้ดูแล/ยืนยันรหัส, ไม่สร้างซ้ำ, ไม่บันทึกรหัสลง audit และใช้ชื่อผู้ใช้ที่มี @ ได้
- Social ทดสอบ HTTPS validation, สิทธิ์ ADMIN/SUPER_ADMIN และไม่เขียนทับ registrationEnabled; การบันทึก settings ทั่วไปคง Social ล่าสุด
- E2E ทั้ง desktop/mobile สร้าง ADMIN ผ่านฟอร์มจริง ตรวจรหัสผู้ดูแลผิดแล้วข้อมูลยังอยู่, ADMIN เห็นสิทธิ์ MEMBER เท่านั้น, บันทึก Social/แก้ validation/reload และตรวจลิงก์ที่เมนูติดต่อเรา
- PostgreSQL บน Neon สาขา release-validation-20261026 ผ่าน migration, seed เฉพาะข้อมูลระบบ และ API health/signup/create-user/social/search/support ดู output/postgres-validation.json
- Production HTTPS ผ่าน health, admin login, admin APIs, SPA routes, ป๊อปอัปอ่านภาพจาก R2 และอัปโหลด PNG ผ่าน Vercel API ได้ WebP ใน R2 จริง ดู output/live-production-verification.json; ลบเฉพาะไฟล์/แถวที่สร้างเพื่อ health check หลังตรวจแล้ว ไม่เหลือพระตัวอย่างในฐานจริง
- Production ย้ายเฉพาะป๊อปอัปต้อนรับ 1 รายการที่ยังอยู่ใน local ล่าสุด ไม่คืนรายการป๊อปอัปที่ผู้ใช้ลบไปแล้ว ไม่มีการย้ายสมาชิก/ร้าน/พระสาธิตจาก local
- Static premium audit ล่าสุด 25 รายการจากข้อจำกัดการตรวจ shared components (เดิม 24 + shared Textarea ในฟอร์มสร้างสมาชิก) ไม่มี unresolved ownership; ไม่อ้างว่า strict static audit ผ่าน

### บีบอัดรูปอัปโหลดและสวิตช์รับสมัครสมาชิก

- อัปโหลด PNG รายละเอียดสูงผ่าน API จริง ตรวจไฟล์หลัก/thumbnail เป็น WebP ภายใต้เพดานขนาดและพิกเซล และแนบกับป๊อปอัปจริงได้; เก็บเพียง key อ้างอิงในฐานข้อมูล
- ตรวจ EXIF orientation, การตัด metadata, alpha transparency, ไม่ขยายรูปเล็ก, ปฏิเสธไฟล์เสีย/ปลอม/SVG ก่อนเกิดไฟล์หรือ DB row และลบไฟล์ใหม่เมื่อจำลอง DB insert ล้มเหลว
- ทดสอบ setting เก่าที่ไม่มี flag ให้ default true, เฉพาะ SUPER_ADMIN เปลี่ยนได้, บังคับ CSRF, PUT ขาด flag คืน 400, ปิดแล้วสมัครผ่าน API ไม่ได้, สมาชิกเดิม login ได้, ปิดระหว่าง hash แล้วไม่สร้างบัญชี และเปิดใหม่สมัครได้ พร้อม audit
- E2E เพิ่มการปิด–เปิดผ่านสวิตช์จริง/บันทึก/reload และฟอร์มที่เปิดค้างไว้ก่อนปิด จากนั้นสมัครใหม่ อัปโหลดรูปในหน้าประกาศและหน้าป๊อปอัป บันทึกจริง และตรวจ response/รูปที่เก็บแล้วเป็น WebP
- ภาพสนับสนุน QR เดิม 1,996,220 bytes ผ่านตัวบีบอัดใหม่ได้รูปหลัก 190,318 bytes และรูปย่อ 42,192 bytes ทั้งคู่ถอดรหัสตรงกับ QR ต้นฉบับ ดู `output/optimized-qr-check.json`
- รูปเดิมที่บันทึกไว้ไม่ถูกแปลงซ้ำ; ไม่มี schema migration เพิ่ม และ local ยังเปิดรับสมัครเป็นค่าเริ่มต้น ภาพ UI: `output/playwright/registration-switch-{desktop,mobile}.png` และ `registration-closed-{desktop,mobile}.png`
- รอบ browser แรกติดชื่อปุ่มใน test ที่ใช้ “บันทึก” แทน “บันทึกเนื้อหา”; แก้ locator ให้ตรงกับ UI แล้วตรวจทั้งชุดใหม่ ผลล่าสุดแสดงในตารางด้านบน

### แจ้งเรื่องและตอบกลับผ่านกระดิ่ง

- Migration 006 เพิ่มเรื่องและข้อความ สนทนาได้สองทาง โดยสมาชิกอ่านได้เฉพาะของตน ADMIN/SUPER_ADMIN รับเรื่องและตอบกลับได้ MODERATOR ไม่มีสิทธิ์รับเรื่อง
- Integration เพิ่ม 7 tests ตรวจ auth/CSRF/validation/เจ้าของ/สิทธิ์ผู้ดูแล/บัญชีระงับ, notification เฉพาะผู้ดูแลที่ ACTIVE, ลิงก์กระดิ่ง, การอ่านแจ้งเตือนเฉพาะเจ้าของ, ส่งซ้ำ UUID เดิมไม่ซ้ำข้อความ, ตอบพร้อมกันสำเร็จเพียงหนึ่งคำขอ, version เก่าคืน 409, ปิดและเปิดเรื่องใหม่, audit, pagination และ rate limit
- E2E ผ่านทั้ง desktop/mobile ตั้งแต่เมนูสมาชิก → สร้างเรื่อง → กระดิ่งผู้ดูแล → ตอบกลับ → กระดิ่งผู้แจ้ง → ส่งข้อมูลเพิ่ม → ปิดเรื่องและกรองรายการ พร้อมทดสอบข้อความว่าง, network 503, version 409, draft คงอยู่หลัง refresh/error, unsaved guard และคลิกกระดิ่งกลับเข้าเรื่องเดิมแล้วเห็นข้อความใหม่
- ภาพตรวจจริง `output/playwright/support-member-mobile.png`, `support-admin-mobile.png` และเวอร์ชัน desktop ในโฟลเดอร์เดียวกัน; ไม่ล้นจอมือถือ
- สำรองก่อน migration ที่ `backups/before-support-tickets.sql`; lint ไม่มี warning, typecheck/build และ compiled server smoke ผ่าน
- Static premium audit ล่าสุดมี 24 รายการ (เดิม 21 และเพิ่ม 3 จาก Button asChild/Shared Textarea ใน support page) ตัวตรวจไม่ติดตาม composition ของ shared components; ปุ่มสร้างเรื่องและฟอร์มใช้ได้จริงตาม E2E และ Textarea owner มี resize-none ไม่มี unresolved ownership ไม่อ้างว่า strict static audit ผ่าน

- สมัครและล็อกอินโดยไม่ส่งอีเมล; รหัสผ่าน 8 ตัวผ่าน และ 7 ตัวถูกปฏิเสธทั้ง API และหน้าเว็บ
- Username ตัดช่องว่างหัวท้ายและแปลงเป็นตัวพิมพ์เล็ก; ชื่อซ้ำต่างตัวพิมพ์ถูกปฏิเสธ; login ด้วย email-only ไม่ผ่าน
- เปลี่ยนรหัสผ่านต้องทราบรหัสผ่านปัจจุบัน ยกเลิกทุก session และรหัสผ่านเก่าใช้ไม่ได้
- `/auth/forgot`, `/auth/reset`, `/auth/verify` และ `/me/verification` คืน 404
- กู้บัญชีผ่านคำสั่งผู้ดูแลเซิร์ฟเวอร์: สมาชิกทั่วไปเป็นผู้ดำเนินการไม่ได้, รหัสผ่าน 7 ตัวไม่ผ่าน, SUPER_ADMIN ที่ ACTIVE ทำได้พร้อม audit และการยกเลิก session
- Referral นับเมื่อสมัครสมาชิกและไม่รับนโยบาย VERIFICATION
- ระบบเดิมยังผ่านการทดสอบอัปโหลด/สิทธิ์รูป/ส่งตรวจ/อนุมัติ/ค้นหา/ร้านค้า/โปรด/แจ้งเตือน/รายงาน/การตั้งค่า/CSRF/rate limits

ภาพฟอร์มและ validation: `output/playwright/register-desktop.png` และ `output/playwright/register-mobile.png` ตรวจภาพมือถือแล้วไม่มีช่องอีเมลและแสดงข้อกำหนดรหัสผ่าน 8 ตัวอักษร

## ขอบเขต

การทดสอบนี้รันในเครื่อง ไม่ได้ deploy ไป Vercel หรือเปลี่ยนระบบเก็บรูป ไม่ได้รัน Docker Engine หรือทดสอบ HTTPS บนโดเมนสาธารณะ ไม่มีการส่งอีเมลในระบบปัจจุบัน

ผลก่อนเปลี่ยน Username อยู่ใน [รายงานเดิม](history/TEST-REPORT-before-username.md) เพื่อเก็บประวัติ ไม่ใช่ข้อกำหนดหรือผลตรวจของเวอร์ชันปัจจุบัน

## ป๊อปอัปหลายประกาศแบบสไลด์อัตโนมัติ

- แสดงหลายประกาศที่ตรงวันเวลา หน้าเว็บ กลุ่มผู้ชม และความถี่ โดยเปลี่ยนทุก 5 วินาที มีปุ่มก่อนหน้า/ถัดไป จุดเลือกสไลด์ และหยุด/เล่น
- คง delaySeconds แยกรายการ; claim และนับยอดเมื่อรายการนั้นแสดงครั้งแรกเท่านั้น การวนซ้ำในป๊อปอัปชุดเดิมไม่เพิ่มยอด และปิดแล้วไม่เปิดรายการที่ยังรอขึ้นมาในหน้าเดิม
- หยุดเมื่อผู้ใช้เลื่อนเอง วางเมาส์เหนือสไลด์ ย้ายไปแท็บอื่น หรือเปิด reduced motion; เปลี่ยนหน้า/บัญชีจะยกเลิกคำขอเดิม
- Integration ใช้ฐานข้อมูลจริงตรวจหลายประกาศและยอดแต่ละรายการ; E2E ทั้งสองขนาดจอใช้ API สร้าง 3 ประกาศ ตรวจ auto/manual/pause/delay/close/reduced motion/CTA พร้อมจำลอง 503 แล้ว retry และ 409 แล้วข้ามรายการ
- ภาพตรวจ: `output/playwright/popup-slides-desktop.png` และ `popup-slides-mobile.png`; typecheck/lint/build และ compiled-server smoke ผ่าน ไม่ต้องเปลี่ยน schema
- รอบ E2E รวมครั้งแรกผ่าน 9/10 โดย test สมัครสมาชิกบนมือถือชน global API rate limit 300 requests/minute หลังทดสอบต่อเนื่อง จึงตรวจซ้ำแยกแต่ละ project ด้วย test server ใหม่ ได้ 5/5 ทั้งคู่ โดยไม่แก้หรือปิด rate limit ของระบบ
- Static premium audit ยังคง 21 รายการจากข้อจำกัดของตัวตรวจ shared components ตามรายละเอียดด้านล่าง

## เพิ่ม 12 รูปและรีเซ็ตรหัสผ่านจากหลังบ้าน

- ทดสอบบันทึก 12 รูปและเปลี่ยนรูปหลักแล้วโหลดใหม่ ลำดับถูกเก็บจริง; รูปที่ 13 ถูกปฏิเสธ
- E2E ทั้ง desktop/mobile อัปโหลด 12 รูป เลือกรูปที่ 12 เป็นรูปหลัก บันทึก/เปิดแก้ไข/อนุมัติ และเปิดแกลเลอรีสาธารณะได้ครบ ไม่มีความกว้างล้นจอ
- รีเซ็ตผ่านหน้า admin ทดสอบกรอกรหัสผู้ดูแลผิดแล้วแก้ไขสำเร็จ ยกเลิกแล้วคืนโฟกัส กลับเข้าสู่ระบบสมาชิกด้วยรหัสใหม่ได้ และ session เดิมถูกยกเลิก
- Integration ตรวจ MEMBER/MODERATOR/guest/CSRF, รหัสผู้ดูแลผิด, ยืนยันรหัสไม่ตรง, รหัสสั้น, รีเซ็ตตนเอง และ ADMIN ที่พยายามรีเซ็ตเจ้าหน้าที่ ถูกปฏิเสธ; ADMIN รีเซ็ต MEMBER และ SUPER_ADMIN รีเซ็ต ADMIN ได้; audit ไม่เก็บรหัสผ่าน
- พบและแก้ระหว่างทดสอบ: grid gallery ต้องมี min-width:0 เพื่อให้ thumbnail เลื่อนภายในคอลัมน์; initial focus ของ dialog ต้องทำหลังจดจำปุ่มเปิดเพื่อคืน focus ได้
- ภาพตรวจจริง: output/playwright/twelve-images-mobile.png และ output/playwright/reset-password-mobile.png (รวมภาพ desktop ในโฟลเดอร์เดียวกัน)
- Static premium audit: ยังรายงาน 21 รายการจาก Button asChild/Radix Close และ shared Textarea ที่ตัวตรวจแบบ static ตีความไม่ครบ ไม่มี unresolved ownership; ไม่อ้างว่า strict audit ผ่าน ดู output/premium-audit.json ร่วมกับ browser tests และ shared Textarea ที่กำหนด resize-none

## ประกาศสำหรับโชว์ / สำหรับขาย

เพิ่ม listingType SALE/SHOW พร้อม migration005 ค่าเดิมเป็น SALE; SHOW ไม่บังคับราคาและล้างราคาเมื่อบันทึก แม้ส่งราคาผ่าน API โดยตรง แบบขายระบุราคายังบังคับราคา และแบบสอบถามราคาใช้งานได้ การเปลี่ยนประเภทหลังอนุมัติกลับ PENDING และหายจาก public API จนอนุมัติใหม่

Integration ผ่าน 39/39 และ E2E ผ่าน 8/8: desktop ทดสอบแบบขาย, mobile ทดสอบแบบโชว์ ตั้งแต่ฟอร์ม/preview/บันทึก/เปิดแก้ไข/อนุมัติ/หน้าสาธารณะ/รายการโปรด พร้อมตรวจซ่อนช่องราคา คงค่าราคาเมื่อสลับตัวเลือกก่อนบันทึก และแสดง “สำหรับโชว์ · ไม่เปิดขาย” แทนการสอบถามราคา ภาพ output/playwright/listing-type-desktop.png และ listing-type-mobile.png; typecheck/lint/build ผ่าน Static premium audit ยังมี 21 รายการจากข้อจำกัดการตรวจ shared components ตามที่อธิบายไว้ข้างต้น
