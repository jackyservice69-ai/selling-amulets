# selling-amulets — ตลาดพระเครื่อง

รูปอัปโหลดใหม่ทุกช่อง รวมประกาศและป๊อปอัป จะย่อ/บีบอัดเป็น WebP ก่อนบันทึก (รูปหลักไม่เกิน 1600px/1 MiB และรูปย่อไม่เกิน 600px/150 KiB) ผู้ดูแลสูงสุดเปิด–ปิดรับสมาชิกใหม่ได้ที่ **ตั้งค่าเว็บไซต์ → เปิดรับสมัครสมาชิก → บันทึกการตั้งค่า** สมาชิกเดิมยังเข้าสู่ระบบได้เมื่อปิดรับสมัคร

ระบบแจ้งเรื่อง: สมาชิกเปิดเมนู **แจ้งเรื่องถึงผู้ดูแล → แจ้งเรื่องใหม่** เพื่อส่งคำถามหรือปัญหาและติดตามบทสนทนา ผู้ดูแล/ผู้ดูแลสูงสุดเปิด **หลังบ้าน → รับแจ้งเรื่อง** เพื่อตอบกลับหรือปิดเรื่อง กระดิ่งทั้งสองฝ่ายมีลิงก์เข้าเรื่องโดยตรง สมาชิกส่งข้อความเพิ่มเติมเพื่อเปิดเรื่องที่ปิดแล้วได้ การติดตั้งเพิ่มใช้ migration 006 ตามขั้นตอน `npm run db:migrate` และ `npm run db:generate`

เว็บไซต์ตลาดประกาศพระเครื่องภาษาไทย ใช้ React + TypeScript + Vite, Tailwind CSS, shared shadcn-style/Radix components, Express, Prisma และ MySQL 8 ข้อมูลประกาศ การแจ้งเตือน รายการโปรด และการตั้งค่าบันทึกลงฐานข้อมูลจริง

ไม่มีระบบสั่งซื้อ ชำระเงิน กระเป๋าเงิน หรือค่าคอมมิชชัน ผู้สนใจติดต่อร้านโดยตรง การอนุมัติประกาศเป็นการตรวจความเหมาะสม ไม่ใช่การรับรองความแท้

## เริ่มใช้งานบน Windows / PowerShell

ต้องมี Node.js 22.12 ขึ้นไป, MySQL 8 และ npm (รวมมากับ Node.js) สำหรับ Docker ใช้ Docker Desktop ที่เปิด Linux containers

```powershell
Set-Location C:\Users\ADMIN\Desktop\selling-amulets
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

แก้ `.env` โดยตั้ง `DATABASE_URL` เป็นฐานข้อมูลของคุณ และสร้าง `SESSION_SECRET` แบบสุ่ม:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

ใส่ผลลัพธ์ใน `.env` โดยไม่ commit ไฟล์นี้ ฐานข้อมูลต้องสร้างไว้ก่อน เช่น `amulet_market` ใช้ `utf8mb4` และเวลาของฐานข้อมูลเป็น UTC

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

เปิด [เว็บไซต์ในเครื่อง](http://localhost:5173) โดย API ทำงานที่พอร์ต 3001 Vite proxy `/api` ไปยัง API ทำให้คุกกี้ทำงานบน origin เดียวกัน ค่า `APP_ORIGIN` ต้องตรงกับ URL ที่เปิดจริง รวม scheme และ port

Seed ปกติสร้างสิทธิ์ หมวดหมู่ การตั้งค่า และข่าวต้อนรับ **ไม่สร้างประกาศสาธิตหรือรหัสผ่านแอดมิน** หากต้องการข้อมูลสาธิต:

```powershell
$env:SEED_DEMO = 'true'
npm.cmd run db:seed
Remove-Item Env:SEED_DEMO
```

ข้อมูลสาธิตมีคำว่า “ตัวอย่าง” และใช้ภาพสร้างด้วย AI ไม่มีสินค้าที่เสนอขายจริง บัญชีร้านสาธิตมีรหัสผ่านสุ่มที่ไม่ถูกส่งออก การรัน Seed ซ้ำไม่เขียนทับข้อมูลร้านหรือการตั้งค่าที่แก้แล้ว

## สถานะเครื่องที่ใช้พัฒนา

มี MySQL 8.0.44 แบบ portable อยู่ใน `.tools/mysql-8.0.44-winx64` ข้อมูลอยู่ใน `.tools/mysql-data` เปิดเฉพาะ `127.0.0.1:3307` ตั้งรหัสผ่านแล้วและแอปใช้บัญชี `amulet` แยกจาก root ค่าการเชื่อมต่ออยู่ใน `.env` และฐานข้อมูลทดสอบแยกใน `.env.test.local` ทั้งหมดถูกละเว้นจาก Git

หากเปิดเครื่องใหม่และ MySQL ยังไม่ทำงาน:

```powershell
.\scripts\start-local-mysql.ps1
npm.cmd run dev
```

การติดตั้ง portable นี้มีไว้เพื่อทดสอบใน workspace ปัจจุบัน ใช้ Docker Compose หรือ MySQL ที่ดูแลโดยผู้ติดตั้งสำหรับระบบจริง

## สร้างผู้ดูแลระบบสูงสุด

ตั้ง `ADMIN_USERNAME` และ `ADMIN_PASSWORD` ใน `.env` (รหัสผ่านอย่างน้อย 8 ตัวอักษร ไม่เกิน 72 ไบต์) แล้วรัน:

```powershell
npm.cmd run admin:create
```

บัญชีผู้ดูแลที่สร้างไว้ในเครื่องนี้อ่านได้จาก `.tools/local-access.json` (ไม่รวมใน source/แพ็กเกจ deployment)

เข้าสู่ระบบที่ `/login` และเปิด `/admin` สคริปต์จะปฏิเสธชื่อผู้ใช้ที่มีบัญชีอยู่แล้ว ไม่ยกระดับสิทธิ์บัญชีเดิมโดยเงียบ ๆ จากนั้นลบ `ADMIN_PASSWORD` ออกจาก `.env` ได้ บัญชีทั่วไปสร้างผ่านหน้า `/register`

## หน้าหลักและการทำงาน

| เส้นทาง | การใช้งาน |
|---|---|
| `/`, `/catalog` | รายการใหม่ แนะนำ ยอดเข้าชม ค้นหาชื่อ/วัด/เกจิ/ร้าน กรองราคาและหมวดหมู่ แบ่งหน้า |
| `/amulet/:id` | แกลเลอรี รายละเอียด ติดต่อร้าน บันทึกโปรด และรายงานประกาศ |
| `/shops`, `/shop/:slug` | ร้านสาธารณะและประกาศที่อนุมัติแล้ว |
| `/dashboard` | สถานะประกาศ เหตุผลที่ไม่อนุมัติ ปิดประกาศ และยอดเข้าชม |
| `/dashboard/new`, `/dashboard/edit/:id` | อัปโหลด เรียงภาพ เลือกภาพหลัก เก็บร่าง ดูตัวอย่าง ส่งตรวจสอบ |
| `/dashboard/shop` | ชื่อร้าน โลโก้ ภาพปก พักร้าน ช่องทางติดต่อ การเปิดเผยและลำดับ |
| `/dashboard/profile` | โปรไฟล์ ชื่อผู้ใช้ รูปส่วนตัว และเปลี่ยนรหัสผ่าน |
| `/dashboard/referrals` | รหัส/ลิงก์แนะนำ QR Code แชร์ รายการผู้สมัคร และยอดผู้สมัครผ่านลิงก์แนะนำ |
| `/dashboard/notifications`, `/dashboard/favorites` | การแจ้งเตือนและรายการโปรด |
| `/admin` | สถิติรายวัน/เดือน ตรวจประกาศ อนุมัติ ปฏิเสธ ระงับ คืนสถานะ ปักหมุด |
| `/admin/users`, `/admin/reports` | จัดการสมาชิกและตรวจรายงาน |
| `/admin/categories`, `/admin/content` | หมวดหมู่ย่อย ป๊อปอัป แบนเนอร์ ข่าวสาร และเวลาแสดง |
| `/admin/settings`, `/admin/audit` | การตั้งค่าเว็บไซต์และประวัติการดำเนินการ |

## บัญชีและรูปภาพ

- สมัครและเข้าสู่ระบบด้วย Username + Password อย่างน้อย 8 ตัวอักษร ไม่เก็บอีเมล ไม่มี Google/Gmail login และไม่ต้องตั้ง SMTP
- ลืมรหัสผ่านให้ติดต่อผู้ดูแล: ผู้ดูแลหรือผู้ดูแลสูงสุดเปิด `/admin/users` แล้วกด “รีเซ็ตรหัสผ่าน” หลังยืนยันเจ้าของบัญชี ผู้ดูแลทั่วไปทำได้เฉพาะบัญชี MEMBER; บัญชีเจ้าหน้าที่ให้ผู้ดูแลสูงสุดดำเนินการ ดู [คู่มือกู้บัญชี](docs/DEPLOYMENT.md#กู้บัญชีโดยไม่ใช้อีเมล)
- ประกาศรองรับสูงสุด 12 รูปตามค่าเริ่มต้น เลือก “ตั้งเป็นรูปหลัก” ใต้รูปที่ต้องการ ระบบบันทึกรูปนั้นเป็นภาพแรกและเก็บลำดับรูปอื่นไว้
- หน้าเพิ่ม/แก้ไขประกาศเลือก “สำหรับขาย” หรือ “สำหรับโชว์” ได้ แบบโชว์ไม่เก็บหรือแสดงราคา และแสดง “ไม่เปิดขาย” บนการ์ด/หน้ารายละเอียด ประกาศเดิมเป็นแบบขาย การเปลี่ยนประเภทต้องผ่านการตรวจสอบใหม่
- ป๊อปอัปหลายประกาศ: เปิด `/admin/content` → “ป๊อปอัป” → “เพิ่มประกาศป๊อปอัป” เพิ่มทีละรายการและเปิดใช้งาน รายการที่ตรงวันเวลา/หน้า/กลุ่มผู้ชมจะรวมเป็นสไลด์อัตโนมัติทุก 5 วินาที พร้อมปุ่มก่อนหน้า/ถัดไป จุดเลือกประกาศ และปุ่มหยุด การปิดจะปิดทั้งชุดของหน้าเดิม
- `STORAGE_DRIVER=local` ใช้โฟลเดอร์ `uploads/` สำหรับพัฒนา
- `STORAGE_DRIVER=s3` รองรับ MinIO, S3 และ Cloudflare R2 ใช้ bucket แบบ private ตั้งตัวแปร S3 ตาม `.env.example`
- รูปภาพถูกตรวจด้วย Sharp จากเนื้อไฟล์จริง รับ JPEG/PNG/WebP ภาพนิ่ง สร้าง WebP ขนาดเต็มไม่เกิน 1600px และ thumbnail 600px ตัด metadata ออก
- ดาวน์โหลดรูปผ่าน `/api/media/:id` ซึ่งตรวจสิทธิ์ทุกครั้ง ไม่มีการเปิดโฟลเดอร์ uploads แบบ static ไม่มี public bucket ที่ข้ามสถานะประกาศได้

## ติดตั้งด้วย Docker Compose

ดูรายละเอียด production/HTTPS ใน [คู่มือติดตั้ง](docs/DEPLOYMENT.md) ก่อนเปิดสาธารณะ สร้าง `.env` และตั้ง `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `SESSION_SECRET`, `APP_ORIGIN` ใช้รหัสผ่านฐานข้อมูลเป็นตัวอักษร/ตัวเลขหรือ hex เพื่อไม่ต้อง escape URL

```powershell
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail 100 app
```

บริการ `migrate` รอฐานข้อมูลพร้อม รัน migration, seed และสร้าง private bucket ก่อนเริ่มแอป ข้อมูล MySQL และ MinIO เก็บใน named volumes เปิดแอปบน loopback พอร์ต 3001 สำหรับ reverse proxy

ทดสอบ Docker ในเครื่องแบบ HTTP ให้ตั้ง `NODE_ENV=development`, `APP_ORIGIN=http://localhost:3001` แล้วใช้ `docker compose up -d` ไฟล์ build ยังให้ Express serve หน้าเว็บได้โดยตั้ง `SERVE_STATIC=true` (ดูตัวอย่าง environment)

## ตรวจสอบคุณภาพ

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd audit
```

ก่อนทดสอบสร้าง `.env.test.local` จาก `.env.test.example` โดยใช้ฐานข้อมูลแยกที่ชื่อจบด้วย `_test` แล้วรัน:

```powershell
node scripts/test-prepare.mjs
npx.cmd playwright install chromium
```

Integration tests ใช้ MySQL จริง การเปลี่ยนรหัสผ่านและคำสั่งกู้บัญชีในเครื่อง ไม่ mock Prisma ส่วน Playwright เปิดแอปทดสอบแยกที่พอร์ต 3002/5174 ใช้ฐานข้อมูล `_test` เดียวกันและบัญชี fixture เฉพาะทดสอบ ห้ามชี้ test environment ไปยังฐานข้อมูลจริง

ผลการรันและข้อจำกัดที่ตรวจพบอยู่ใน [รายงานทดสอบ](docs/TEST-REPORT.md) รายงาน JSON อยู่ใน `output/test-results.json` และ `output/playwright/results.json` ภาพหน้าจออยู่ใน `output/playwright/`

## โครงสร้างและเอกสาร

```text
src/                  React pages, shared UI, API client, CSS tokens
server/               Express routes, validation, security, listing services, storage
prisma/               MySQL schema, migrations, idempotent seed
scripts/              Admin creation, storage initialization, test server, backups
tests/                Vitest + Supertest integration and Playwright E2E
public/               Local fonts, logo, illustrative demo images
docs/                 API, deployment, security, actual test report
```

- [ข้อกำหนดต้นฉบับ](PRODUCT.md)
- [API Documentation](docs/API.md)
- [การติดตั้ง สำรองและกู้คืน](docs/DEPLOYMENT.md)
- [สิทธิ์ ความปลอดภัย และขอบเขตระบบ](docs/SECURITY.md)
- [ที่มาของภาพและฟอนต์](docs/ASSETS.md)
- [แนวทางออกแบบ](DESIGN.md) และ [พฤติกรรม UI](UX-CONTRACT.md)

## การดูแล Dependencies

ใช้ `package-lock.json` และ `npm ci` เพื่อให้ติดตั้งเวอร์ชันเดียวกัน Prisma Client/CLI ตรึงคู่กันที่ 6.19.3 สำหรับ MySQL schema นี้ ส่วน `deepmerge-ts` override เป็น 8.0.0 เพื่อแก้ช่องโหว่ใน dependency ของ Prisma CLI โดยตรวจ generate/migrate/build จริงแล้ว อัปเดตผ่าน branch แยกและรันชุดทดสอบทั้งระบบก่อนใช้งาน
