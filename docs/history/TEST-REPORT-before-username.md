> รายงานก่อนเปลี่ยนเป็น Username วันที่ 26 ตุลาคม 2026 ผลทดสอบอีเมลในเอกสารนี้ไม่ใช่พฤติกรรมปัจจุบัน

# รายงานผลทดสอบจริง

วันที่ 26 ตุลาคม 2026 (Asia/Bangkok) บน Windows, Node.js26.10.0, MySQL8.0.44 portable, Prisma6.19.3 ใช้ฐานพัฒนา `amulet_market` และฐานทดสอบแยก `amulet_market_test` ไม่ mock Prisma หรือฐานข้อมูล

## ผลการรัน

| รายการ | ผลจริง / หลักฐาน |
|---|---|
| Prisma generate | ผ่าน; เคยพบ DLLถูกdev serverใช้งาน จึงหยุดserverก่อนgenerateแล้วเปิดใหม่ |
| Migration deploy | ผ่านทั้งฐานพัฒนาและทดสอบ migration001 +002; 27ตารางรวมmigration history |
| Seed | ผ่าน หมวด/role/permission/settings; opt-in demoสร้าง12ประกาศ3ร้านในฐานพัฒนาเท่านั้น |
| Typecheck | `npm run typecheck` ผ่านทั้งfrontend/backend |
| Lint | `npm run lint` ผ่าน ไม่มีการปิดกฎsourceเพื่อให้ผ่าน; excludeเฉพาะbuild/generated reports/tools |
| Integration | **34/34 ผ่าน**, ไม่มีskip; รอบล่าสุด17:23น. ใช้5.85วินาที ดู `output/test-results.json` |
| Browser E2E | **8/8 ผ่าน**, ไม่มีskip/retry/flaky; desktop1440×1000 และPixel7Chromium ใช้ประมาณ39วินาที ดู `output/playwright/results.json` และHTML report |
| Build | `npm run build` ผ่าน TypeScript + Viteproduction assets + compiledExpress; ไม่มีchunk-size warning |
| Dependency audit | `npm audit` พบ0ช่องโหว่ ณการตรวจ ดู `output/npm-audit.json` |
| Compiled server | เปิดcompiledExpress3003ชั่วคราว ทดสอบhealth, staticroot, asset และSPA route fallback ผ่าน; ปิดหลังทดสอบ ดู `output/release-smoke.json` |
| Backup / restore | สำรองฐานทดสอบแล้วrestoreลง `amulet_restore_test` ครบ27ตาราง จำนวนusers/amuletsตรงต้นฉบับ ดู `output/backup-verification.json` |
| Email | Integrationส่งNodemailerไปSMTP receiver1026จริง ทดสอบtokenรีเซ็ตและยืนยันใช้ครั้งเดียว; หน้าprofileส่งเข้าMailpit1025สำเร็จ ดู `output/local-preview-verification.json` |
| Responsive visual | ตรวจpreview desktop1440, tablet768 และPixel7; ภาพ `output/playwright/preview-*.png` |
| Native controls | ตรวจnativeanchorของButton asChild, ปุ่มปิดRadixDialog/คืนfocus, textarea computed resize:none ในbrowserจริง ดู `output/ui-runtime.json` |
| Compose syntax | parseYAMLผ่าน; **ยังไม่ได้docker compose build/up** เพราะเครื่องนี้ไม่มีDockerCLI/Engine |

## เกณฑ์ตรวจรับตาม PRODUCT.md

1. สมัคร/ล็อกอิน: integrationตรวจbcrypt, cookie, sessionrotation, wrongpassword; E2Eสมัครและใช้บัญชีจริง
2–5. สร้างประกาศ→PENDING→ซ่อนสาธารณะ→อนุมัติแล้วเผยแพร่: ตรวจDB/API/media และbrowserครบขั้นตอน
6. ปฏิเสธต้องมีเหตุผล สมาชิกอ่านได้; แก้และส่งใหม่พร้อมversion
7–8. IDOR/foreignimage/role escalation/adminAPIถูกป้องกันทั้งbackendและrouteguard
9–10. Notification unreadตรงDB; ผู้รับอื่นอ่านแทนไม่ได้; อ่านทั้งหมดแล้วDBเปลี่ยน
11. Referralcodeไม่ซ้ำ ป้องกันตนเอง/ปลอม/นับซ้ำ; ยอดตามVERIFICATIONเพิ่มหลังยืนยันจริง
12. Popupตรวจเวลา กลุ่ม หน้า และจำนวนครั้ง/session; claimซ้ำถูกปฏิเสธ
13. SVG/ไฟล์ปลอมเป็นJPGถูกปฏิเสธ; PNGถูกแปลงWebP; unattached/privateimageไม่เผยแพร่
14. ค้นชื่อ/วัด/เกจิ กรองราคา/หมวด เรียงและpagination; empty/retryในbrowser
15. Contactที่ปิดเผยแพร่และข้อมูลprofileส่วนตัวไม่ออกpublicAPI; maliciousURLถูกปฏิเสธ
16. ระงับบัญชียกเลิกsession/ห้ามlogin/ซ่อนประกาศและภาพ; พักร้านซ่อนข้อมูล; เจ้าของปิดประกาศที่ถูกระงับเพื่อหลบตรวจไม่ได้
17–19. Migration,seed,frontend/backendbuild,typecheck,lint,testรันผ่านจริงตามตาราง
20. E2Eบนdesktop/mobile และvisualpreviewtablet; แก้ปัญหาsidebarยาวเกินviewportที่พบจากการทดสอบแล้ว

เพิ่มเติม: favoriteidempotent, approvalretryไม่แจ้งซ้ำ, report/audit, newsCRUD/pagination, bannerเวลาแสดง, SMTPresetexpiry/sessionrevocation, CSRF/origin, credentialratelimit, อ่านsessionไม่กินโควตาล็อกอิน, UTCของMySQL

## ปัญหาที่พบและแก้ระหว่างทดสอบ

- Authlimiterเคยนับ GETsession ทำให้ผู้ใช้ปกติถูกจำกัด: จำกัดเฉพาะcredentialwritesและมีregressiontest
- IPเดียวกันของหลายบัญชีกินAPIquotaร่วมกัน: เปลี่ยนkeyเป็นบัญชีที่ผ่านsessionverificationแล้ว หรือIPสำหรับguest; credentiallimiterยังคงต่อIP และมีtest429
- เมนูสมาชิกบนมือถือขยายเอกสารเป็น814pxทั้งที่viewport412px: จำกัดwidth/max-widthของsidebarและให้เมนูเลื่อนภายใน; เพิ่มassertviewportก่อนกรอกฟอร์ม
- ปิดdialogโดยไม่มีRadixTriggerทำให้focusกลับไปskiplink: เก็บopenerและคืนfocusชัดเจน; E2EตรวจfocusหลังEscape
- `.env` developmentทำให้Viteใช้Reactdevelopmentในbuild: แยกbuild-webscriptบังคับproduction ลดJSเริ่มต้นและแบ่งmoduleสมาชิก/admin
- Vitewatchเข้าโฟลเดอร์portablebinaryแล้วติดWindowslock: ละเว้นruntime/tools/uploads/generatedreportsจากwatch

## Static design audit: ขอบเขตของผล

`designmd lint DESIGN.md` มี0errors และ3warningsเรื่องcustomforeground/muted/accent tokenไม่ได้อ้างผ่านcomponentfrontmatter ทั้งสามค่าใช้จริงผ่านCSSvariablesตามmappingในDESIGN.md

`audit_project.py --mode strict` ยังรายงาน21รายการใน `output/premium-audit.json` จึง **ไม่อ้างว่าคำสั่งstaticauditผ่าน** ตรวจsourceและruntimeแล้วเป็นข้อจำกัดparserดังนี้:

- 13รายการมอง `<Button asChild><Link…>` เป็นliteralbuttonไร้handler แต่sharedButtonใช้RadixSlotแล้วrenderเป็นnativeanchorที่มีhrefจริง
- 1รายการปุ่มปิดภายในDialogPrimitive.Closeได้รับhandlerจากRadix มีruntimeทดสอบปิดและคืนfocus
- 7รายการมองshared`<Textarea>` เป็นliteraltextareaแล้วไม่เห็นclassที่caller; ownerในui.tsxใส่resize-noneและruntimecomputedCSSเป็นnoneจริง

เก็บผลดิบไว้โดยไม่แก้auditor/ปิดกฎ ใช้browser evidenceประกอบการทบทวน ไม่ใช้staticcheckerแทนการทดสอบworkflow

## ส่วนที่ยังไม่ได้ทดสอบจริง

- Dockerimagebuild/containerstartup, MinIO/S3/R2networkpath, SMTPส่งสู่อีเมลภายนอก และHTTPSบนโดเมนจริง ยังไม่ได้รันในenvironmentนี้
- ไม่ได้ทำloadtestขนาดใหญ่, multi-instance sharedlimiter, externalpenetrationtest, Safari/Firefoxหรืออุปกรณ์จริงครบทุกแบบ
- คำสั่งComposebackup/restoreในคู่มือเป็นขั้นตอนสำหรับdeployment; ที่รันจริงรอบนี้คือMySQLCLIบนWindowsด้วยสคริปต์database-backup

ระบบเปิดทดลองในเครื่องได้ มีsource/schema/migrations/seed/envexample/Compose/tests/คู่มือครบ การเปิดบริการสาธารณะต้องตั้งdomain/HTTPS/SMTP/storage/secretsของผู้ติดตั้งและตรวจdeploymentเพิ่มเติมตามคู่มือ
