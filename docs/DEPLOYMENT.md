# ติดตั้ง สำรอง และกู้คืน

## Vercel + Neon PostgreSQL + Cloudflare R2

Production ใช้ Prisma client แยกที่ `.generated/postgres` จาก `prisma/production/schema.prisma`; local MySQL ใช้ schema เดิม `npm ci` สร้างทั้งสอง client ผ่าน postinstall และ `npm run build` ตรวจ type/build หน้าเว็บพร้อม server runtime

1. ตั้ง DATABASE_URL เป็น pooled Neon URL (connection_limit=3), DIRECT_DATABASE_URL เป็น direct URL, APP_ORIGIN เป็น HTTPS domain จริง, SESSION_SECRET แบบสุ่ม และ S3_ENDPOINT/S3_REGION=auto/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY พร้อม STORAGE_DRIVER=s3 ใน Vercel environment ที่เป็น encrypted/sensitive
2. ตรวจฐานข้อมูลปลายทางและใช้ `npm run db:migrate:production` ผ่าน direct URL; seed ด้วย `npm run db:seed:production` ซึ่งเพิ่มเฉพาะ roles, categories, site settings ไม่เพิ่มสมาชิก ร้าน หรือพระตัวอย่าง
3. สร้างผู้ดูแลผ่าน `npm run admin:create` โดยส่ง ADMIN_USERNAME/ADMIN_PASSWORD ผ่าน environment ของเครื่องที่เชื่อถือได้เพียงครั้งเดียว ไม่ต้องเก็บรหัสนี้ใน GitHub หรือ Vercel runtime
4. Vercel project `selling-amulets` ใช้ framework Vite, output dist, API จาก api/index.ts และ rewrites ตาม vercel.json ทั้งหน้าเว็บและ API ใช้โดเมนเดียวกัน การอัปโหลดเกิน 3 MiB จะย่อใน browser ก่อนส่งเพื่อให้อยู่ภายในข้อจำกัด request ของ Vercel แล้วตรวจและแปลงซ้ำบน server ก่อนเก็บ R2
5. ห้ามใช้ SEED_DEMO=true หรือย้ายฐาน local ทั้งชุดขึ้น production ภาพสาธิตสำหรับทดสอบใน public/brand/amulet-*.webp ถูกตัดจาก source deployment ตาม .vercelignore

ค่าจริงอยู่ในไฟล์ .env.*.local ที่ถูก ignore และ encrypted Vercel environment ไม่ใส่ในเอกสารหรือ source repository

ระบบแจ้งเรื่องใช้ migration `202610260006_support_tickets` ต้องรัน migrate deploy และ generate Prisma Client ก่อนเริ่ม server รุ่นนี้ สำรองฐานข้อมูลก่อนอัปเกรด บน Windows หาก generate พบ EPERM ที่ query_engine ให้หยุด dev server ของโครงการชั่วคราว แล้ว generate และเปิดใหม่ การแจ้งเตือนใช้ฐานข้อมูลและกระดิ่งเดิม ไม่ต้องเพิ่ม SMTP หรือบริการภายนอก

## Windows สำหรับพัฒนา

ใช้ PowerShell, Node.js 22.12 ขึ้นไป และ MySQL 8 สร้างฐานข้อมูล `amulet_market` (utf8mb4) และ user ที่มีสิทธิ์เฉพาะฐานนี้ ตั้ง MySQL `default-time-zone=+00:00` (หรือให้ DBA รัน `SET PERSIST time_zone='+00:00';`) ตั้ง `.env` จาก `.env.example` แล้วรันตาม README: `npm.cmd ci`, `npm.cmd run db:generate`, `npm.cmd run db:migrate`, `npm.cmd run db:seed`, `npm.cmd run dev`

workspace นี้ติดตั้ง portable MySQL ไว้แล้ว หลังเปิดเครื่องใหม่ใช้:

```powershell
.\scripts\start-local-mysql.ps1
npm.cmd run dev
```

เว็บไซต์ http://localhost:5173, MySQL loopback3307 บัญชีผู้ดูแลสำหรับเครื่องนี้อยู่ใน `.tools/local-access.json` ซึ่งไม่ถูกส่งเข้า Git หรือ Docker ใช้บัญชีนั้นที่ `/login` แล้วเปิด `/admin` เปลี่ยนรหัสผ่านได้จากข้อมูลส่วนตัว


## Docker Compose และ HTTPS

1. ติดตั้ง Docker Desktop (Linux containers) หรือ Docker Engine + Compose บน Linux
2. สร้าง `.env` แยกสำหรับ deployment ตั้ง NODE_ENV=production, APP_ORIGIN=https://โดเมนของคุณ, SESSION_SECRET แบบสุ่มอย่างน้อย32ตัว, MYSQL_PASSWORD และ MYSQL_ROOT_PASSWORD คนละค่า ใช้ hex เพื่อประกอบ DATABASE_URL ได้ถูกต้อง
3. ตั้ง S3_ACCESS_KEY/S3_SECRET_KEY (อย่างน้อย8ตัวสำหรับ MinIO)
4. `docker compose build` แล้ว `docker compose up -d` ตรวจ `docker compose ps` และ `docker compose logs migrate app` บริการ migrate ต้อง exit0 ก่อน app เริ่ม
5. ใช้ reverse proxy บน host เช่น Caddy รับ HTTPS แล้ว proxy ไป `127.0.0.1:3001` APP_ORIGIN ต้องตรงกับ URL สาธารณะทุกตัว

ตัวอย่าง Caddyfile (แทนโดเมน):

```caddyfile
amulet.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

แอป production เชื่อถือ proxy หนึ่ง hop จึงต้องไม่เปิดพอร์ต3001สาธารณะข้าม proxy; Compose bind เฉพาะ127.0.0.1 และ MySQL ไม่มี public port คุกกี้ production ใช้ Secure/HttpOnly/SameSite=Lax

สร้าง admin โดยส่ง environment ให้คำสั่ง ไม่ใส่รหัสใน source:

```powershell
$env:ADMIN_USERNAME = 'site_admin'
# ใส่รหัสผ่านใน environment ส่วนตัวของเครื่อง
docker compose run --rm -e ADMIN_USERNAME -e ADMIN_PASSWORD app node dist-server/scripts/create-admin.js
Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

สคริปต์ไม่ยกระดับบัญชีเดิมและไม่รีเซ็ตรหัสผ่านเดิม ใช้ user ใหม่ที่ไม่เคยสมัคร

ทดสอบ Docker แบบ HTTP ในเครื่อง: NODE_ENV=development, APP_ORIGIN=http://localhost:3001 จากนั้น `docker compose up -d --build` Compose กำหนด SERVE_STATIC=true ให้ Express serve ไฟล์ build

## S3 / R2

Compose ใช้ MinIO private bucket `amulet-images` และ volume `images` สคริปต์ init-storage รอและสร้าง bucket ถ้ายังไม่มี ไม่มี anonymous read policy

หากใช้ S3 หรือ R2 ให้แทนค่า STORAGE_DRIVER=s3, S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY ใน environment ของ app/migrate ใช้ credential เฉพาะ bucket ที่อ่าน/เขียน object ได้ ไม่เปิด public URL เพราะรูปที่ยังไม่อนุมัติและถูกระงับต้องไม่เข้าถึงได้ ผู้ใช้รับภาพผ่าน API ที่ตรวจสิทธิ์ทุกครั้ง อย่าใส่ CDN public cache หน้า `/api/media` โดยไม่ออกแบบการเพิกถอนสิทธิ์เพิ่ม

## สำรอง MySQL บน Windows

ใช้ mysqldump ที่ตรงกับ MySQL8 สคริปต์อ่าน DATABASE_URL จาก `.env` ส่งรหัสผ่านผ่าน child environment ไม่ใส่ใน command line และไม่เขียนทับไฟล์สำรองเดิม

```powershell
$env:MYSQL_BIN = (Resolve-Path .tools/mysql-8.0.44-winx64/bin).Path
node scripts/database-backup.mjs backup
# หรือระบุไฟล์ใหม่
node scripts/database-backup.mjs backup backups/manual-2026-10-26.sql
```

สำรองแบบ single-transaction สำหรับ InnoDB พร้อม schema/data/foreign keys รวม Prisma migration history การสำรองนี้ไม่มี MySQL accounts/grants ต้องจัดการ credentials แยก เก็บไฟล์สำรองเข้ารหัสและจำกัดผู้เข้าถึง เพราะมี PII/hash/session token hashes

## กู้คืนอย่างปลอดภัย

หยุดแอปที่เขียนข้อมูล สร้างฐานข้อมูลว่างปลายทางและสิทธิ์ แล้วใช้ `.env.restore.local` ชี้ DATABASE_URL ไปปลายทาง ไม่แก้ source environment หลัก

```powershell
$env:ENV_FILE = '.env.restore.local'
$env:MYSQL_BIN = (Resolve-Path .tools/mysql-8.0.44-winx64/bin).Path
$env:CONFIRM_DATABASE = 'amulet_restore'
node scripts/database-backup.mjs restore backups/manual-2026-10-26.sql
Remove-Item Env:CONFIRM_DATABASE, Env:ENV_FILE
```

**Restore จะเขียนทับตารางที่ชื่อชนกัน** สคริปต์จึงตรวจ CONFIRM_DATABASE ต้องตรงฐานข้อมูลจาก URL ตรวจจำนวนตาราง สมาชิก ประกาศ และรูปก่อนสลับ DATABASE_URL ของแอป ทดสอบ login, catalog และ moderation หลัง restore เก็บฐานเดิมไว้จนตรวจเสร็จ

เครื่องพัฒนานี้ได้ทดลอง backup ฐาน `_test` และ restore ลง `amulet_restore_test` แล้ว ดู `output/backup-verification.json` ไม่มีการ restore ทับฐานพัฒนา

## สำรองใน Compose

สร้างไฟล์ใน container แล้ว docker cp ออกเพื่อเลี่ยงปัญหา PowerShell encoding ของ shell redirection:

```powershell
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -u amulet --single-transaction --no-tablespaces --set-gtid-purged=OFF --hex-blob --result-file=/tmp/amulet-backup.sql amulet_market'
New-Item -ItemType Directory -Force backups
$dbContainer = docker compose ps -q db
docker cp "${dbContainer}:/tmp/amulet-backup.sql" backups/amulet-backup.sql
```

กู้คืนเมื่อหยุด app แล้วและได้สำรองฐานเดิม:

```powershell
docker compose stop app
$dbContainer = docker compose ps -q db
docker cp backups/amulet-backup.sql "${dbContainer}:/tmp/amulet-restore.sql"
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u amulet amulet_market < /tmp/amulet-restore.sql'
docker compose up -d app
```

สำรอง object storage คู่กับ DB ในช่วงเดียวกัน: local คัดลอก `uploads/`; MinIO/S3 ใช้ object versioning/replication หรือเครื่องมือของผู้ให้บริการ ห้ามใช้ DB backup เพียงอย่างเดียวแล้วคาดว่าภาพจะกลับมาด้วย

## Migration / Operations

ใช้ `prisma migrate deploy` สำหรับระบบที่มีข้อมูล ห้าม `db push --force-reset` หรือ `migrate reset` บน production ไม่แก้ migration ที่ใช้ไปแล้ว Migration004 เพิ่มค่าจำนวนรูปเริ่มต้นเดิมที่ไม่เกิน 8 ให้เป็น 12 โดยไม่แก้ข้อมูลอื่น

เก็บ secrets ใน environment/secret manager, สำรองทุกวันตามปริมาณข้อมูล, ทดสอบ restore เป็นระยะ, ตรวจ health และ structured logs เก็บ session หมดอายุสำหรับ cleanup ตามนโยบายของผู้ดูแล อย่าลบ uploads ที่ยังมีรูปอ้างอิงจากประกาศ/ร้าน/เนื้อหา

Rate limiter ใช้ memory ต่อ process เหมาะกับ single app instance หาก scale หลาย instance ต้องใช้ shared limiter store และทบทวน proxy topology ก่อน บริการ managed MySQL/S3 ใช้แทนบริการใน Compose ได้

ยังไม่ได้รัน Docker Engine บนเครื่องส่งมอบนี้ ดูข้อจำกัดและรายการที่ทดสอบจริงใน TEST-REPORT.md

## กู้บัญชีโดยไม่ใช้อีเมล

ผู้ใช้ที่ยังเข้าสู่ระบบได้เปลี่ยนรหัสผ่านที่ `/dashboard/profile` โดยกรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร ระบบยกเลิกทุก session และให้เข้าสู่ระบบใหม่

เมื่อผู้ใช้ลืมรหัสผ่าน ให้ติดต่อผู้ดูแลผ่านช่องทางหน้า `/contact` ผู้ดูแลต้องตรวจสอบความเป็นเจ้าของจากช่องทาง/หลักฐานที่มีอยู่ก่อน ไม่รีเซ็ตเพียงเพราะผู้ร้องขอรู้ชื่อผู้ใช้ หากยืนยันไม่ได้ อย่ากู้บัญชีให้

ผู้ดูแลเข้า `/admin/users` ค้นหาชื่อผู้ใช้แล้วกด “รีเซ็ตรหัสผ่าน” กรอกรหัสผ่านของผู้ดูแล รหัสใหม่/ยืนยัน และเหตุผล จากนั้นกด “ยืนยันรีเซ็ตรหัสผ่าน” ผู้ดูแลทั่วไปทำได้เฉพาะบัญชีสมาชิก ผู้ดูแลสูงสุดทำได้กับบัญชีอื่นทุก role การรีเซ็ตยกเลิก session เดิมทุกเครื่อง แต่ไม่ปลดระงับหรือเปลี่ยนสิทธิ์บัญชี เปลี่ยนรหัสของตนเองที่หน้าข้อมูลส่วนตัว ส่วน CLI ด้านล่างยังใช้เป็นทางเลือกสำหรับผู้ดูแลเซิร์ฟเวอร์

คำสั่งด้านล่างใช้ได้เฉพาะผู้ดูแลที่เข้าถึงเซิร์ฟเวอร์และฐานข้อมูลได้ `OPERATOR_USERNAME` ระบุบัญชี SUPER_ADMIN ที่ ACTIVE เพื่อบันทึกผู้ดำเนินการ ไม่ใช่การยืนยันตัวตนสำหรับบริการสาธารณะ ไม่มี API เปิดให้เรียกคำสั่งนี้จากเว็บไซต์

```powershell
$env:OPERATOR_USERNAME = 'site_admin'
$env:TARGET_USERNAME = 'member_name'
$env:RESET_REASON = 'ตรวจสอบความเป็นเจ้าของผ่านช่องทางที่บันทึกไว้แล้ว'
$secretInput = Read-Host 'รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร' -AsSecureString
$env:NEW_PASSWORD = [System.Net.NetworkCredential]::new('', $secretInput).Password
try { npm.cmd run password:reset }
finally { Remove-Item Env:NEW_PASSWORD -ErrorAction SilentlyContinue }
```

สำหรับ Docker แทนคำสั่ง npm ด้วย `docker compose run --rm -e OPERATOR_USERNAME -e TARGET_USERNAME -e RESET_REASON -e NEW_PASSWORD app node dist-server/scripts/reset-password.js` คำสั่งบันทึก audit, แจ้งเตือนสมาชิก และเพิกถอน session ทั้งหมด ส่งรหัสผ่านใหม่ผ่านช่องทางส่วนตัวที่ตรวจสอบแล้ว และให้สมาชิกเปลี่ยนรหัสผ่านทันที

Migration `202610260003_username_auth` ลบอีเมลและตาราง token อีเมลเดิม แต่เก็บชื่อผู้ใช้ รหัสผ่านแบบ hash และข้อมูลประกาศไว้ สำรองฐานข้อมูลก่อน deploy migration นี้ บัญชีเดิมเข้าสู่ระบบด้วยชื่อผู้ใช้เดิมและรหัสผ่านเดิมได้

Migration `202610260005_listing_type` เพิ่มประเภท SALE/SHOW โดยใช้ SALE สำหรับประกาศเดิมทั้งหมด ไม่มีการแก้ราคา รูปภาพ หรือสถานะเดิม ต้อง deploy migration และ regenerate Prisma Client ก่อนเปิดแอปเวอร์ชันนี้
