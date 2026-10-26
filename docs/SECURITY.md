# สิทธิ์และความปลอดภัย

การปิดสมัครสมาชิกบังคับที่ API ด้วย registrationEnabled: ตรวจเร็วเพื่อลดงาน hash และตรวจซ้ำใน Serializable transaction เพื่อปฏิเสธคำขอที่เปิดฟอร์มหรือเริ่ม hash ค้างไว้ขณะผู้ดูแลปิดรับสมัคร ตั้งค่าได้เฉพาะ SUPER_ADMIN พร้อม CSRF/Origin และ audit เดิม; PUT ที่ไม่มี boolean นี้ถูกปฏิเสธเพื่อไม่ให้ client เก่าเปิดสมัครกลับโดยไม่ตั้งใจ

อัปโหลดตรวจ signature/metadata จริง ไม่อาศัยนามสกุลหรือ MIME จาก client จำกัด 40 ล้านพิกเซลและขนาดต้นฉบับตาม setting, ปฏิเสธไฟล์เสีย/ภาพเคลื่อนไหว/ชนิดอื่นก่อนบันทึก, แปลงและสร้าง thumbnail ให้เสร็จก่อนเขียนไฟล์ ตัด EXIF/GPS และกำหนดเพดานไฟล์ WebP สองขนาด ถ้าเขียน storage/ฐานข้อมูลไม่สำเร็จพยายามลบไฟล์ใหม่; การอ่านภาพยังใช้สิทธิ์เดิม

## เรื่องติดต่อผู้ดูแล

สมาชิกดูและตอบได้เฉพาะ SupportTicket ที่ userId เป็นตนเอง ทุก GET/POST ตรวจเจ้าของฝั่ง server; เรื่องของคนอื่นคืน 404 ADMIN/SUPER_ADMIN เท่านั้นที่รับและตอบเรื่องผ่านเส้นทางผู้ดูแล MODERATOR ไม่มีสิทธิ์อ่านหลังบ้านส่วนนี้ ไม่มี endpoint สาธารณะสำหรับบทสนทนา ข้อมูลผู้ร่วมสนทนาคืนเฉพาะ id และชื่อแสดงผล ไม่คืนรหัสผ่าน ชื่อผู้ใช้ หรือข้อมูลติดต่อ

ตรวจบัญชี ACTIVE และสิทธิ์ผู้ตอบอีกครั้งใน Serializable transaction มี CSRF/Origin, rate limit ต่อผู้ส่ง, validation ความยาว, version กันข้อความชนกัน และ unique (authorId,clientRequestId) กันคำขอซ้ำ ข้อความเป็น plain text ที่ React escape; ไม่รองรับ HTML/ไฟล์แนบ Notifications ส่งเฉพาะผู้ดูแลที่ยัง ACTIVE และผู้แจ้งเรื่องตามทิศทางข้อความ Audit เก็บการตอบ/ปิดเรื่องโดยไม่คัดลอกเนื้อหาส่วนตัวลงประวัติทั่วไป

## ขอบเขตที่บังคับจริง

- Guest เห็นเฉพาะ APPROVED + ร้าน active + บัญชี ACTIVE + หมวด active ไม่มี profile phone หรือ contact ที่ปิดเผยแพร่ใน public API
- MEMBER อ่าน/แก้โปรไฟล์ ร้าน รูป และประกาศของตนเท่านั้น ทุกการส่งประกาศใหม่/แก้ไขสำคัญกลับตรวจสอบ ไม่รับ status/shopId/role จาก client
- MODERATOR ตรวจประกาศ สถิติ และรายงาน; ADMIN เพิ่มสิทธิ์จัดการสมาชิกทั่วไป หมวด เนื้อหา ร้าน/ประกาศแนะนำ; SUPER_ADMIN จัดการ role และตั้งค่าเว็บไซต์
- ห้ามแก้สถานะ/role บัญชีตนเองผ่าน admin API; ADMIN ไม่จัดการบัญชี ADMIN/SUPER_ADMIN; MEMBER เรียก `/admin` ตรงได้403
- ระงับบัญชียกเลิก session และซ่อนร้าน/ประกาศ/รูปทันที พักร้านหรือแก้ประกาศที่อนุมัติแล้วทำให้ public media กลับเป็น404
- รูป storage private; APIตรวจสิทธิ์ทุกครั้ง กำหนด no-store เพื่อไม่เก็บรูปที่อาจถูกถอนการเผยแพร่ ไม่ใช้ URL ของ bucket ให้ผู้ชมข้ามสิทธิ์

## Session / Input

รหัสผ่านอย่างน้อย 8 ตัวอักษร bcrypt cost12 จำกัด72ไบต์เพื่อป้องกัน truncation Sessionสุ่ม256บิต DBเก็บ HMAC SHA256 ของ token พร้อม expiry7วัน ล็อกอินหมุน sessionเดิม Logoutลบ record และ reset/change passwordลบทุก session

Cookie HttpOnly, SameSite=Lax, Secureใน production ตรวจ Originทุก write และ CSRF token สำหรับบัญชีล็อกอิน CORSกำหนด originเดียว ไม่มี wildcardกับ credential ไม่มีอีเมลหรือ token อีเมลในระบบ ไม่มี password-reset endpoint สำหรับผู้เยี่ยมชม

หน้ารีเซ็ตรหัสผ่านใน `/admin/users` ตรวจ role ฝั่ง server: ADMIN ทำได้เฉพาะ MEMBER; SUPER_ADMIN ทำได้กับบัญชีอื่นทุก role; ไม่รีเซ็ตตนเองผ่านเส้นทางผู้ดูแล ต้องกรอกรหัสผ่านปัจจุบันของผู้ดูแล รหัสใหม่อย่างน้อย 8 ตัวอักษร ช่องยืนยันตรงกัน และเหตุผลอย่างน้อย 5 ตัวอักษร จำกัด 10 คำขอต่อผู้ดูแลต่อ 15 นาที ตรวจสิทธิ์ซ้ำใน transaction แบบ Serializable แล้วเปลี่ยน hash, ลบทุก session ของเป้าหมาย, บันทึก audit และ notification ใน transaction เดียว ไม่คืนหรือบันทึกรหัสผ่านลง audit ไม่เปลี่ยน role/status ของเป้าหมาย

Zod validate payload, Prisma parameterized queries, React escapeข้อความ ไม่มี dangerouslySetInnerHTML สำหรับเนื้อหาสมาชิก URLอนุญาต HTTPS หรือ internal pathที่ไม่เป็น protocol-relative; contact linkต้องHTTPS มี Helmet/CSP จำกัด script/font/imgแหล่งที่มา รูปตรวจเนื้อจริงด้วยSharp จำกัด15MBสูงสุดและ40ล้านพิกเซล ตัดmetadata ทำWebPใหม่ ไม่รับSVG/ภาพเคลื่อนไหว

จำกัด credential attempts50ครั้ง/15นาทีต่อIP, APIทั่วไป300ครั้ง/นาทีต่อบัญชีที่ตรวจsessionแล้วหรือIPผู้เยี่ยมชม เปลี่ยนค่าโดยทบทวนการใช้งานจริง; การตรวจsessionไม่ใช่ความพยายามล็อกอิน

## ความสอดคล้องของข้อมูล

สร้าง/แก้ประกาศใช้ transaction และ version; moderationสถานะ+history+notification+auditในtransactionเดียว; notification eventKey unique; referralCode uniqueและreferredId unique; favorite compound unique ป้องกันกดซ้ำ; view/popup unique keysและtransaction ป้องกันนับซ้ำตามcookie/sessionที่กำหนด

Referralsนับเมื่อสมัครสมาชิก (REGISTRATION) เท่านั้น ข้อมูลผู้ถูกแนะนำแสดงเฉพาะ username/status/วันที่ ไม่มีเงินหรือผลตอบแทน

## Logging และการดูแล

Errorกลางคืนข้อความไทย ไม่ส่งstacktraceหรือรายละเอียดSQL ผู้ใช้ไม่มีpassword/tokenในDTO; logs errorเก็บชื่อชนิดและevent code ไม่เก็บrequest bodyหรือquery URLพร้อมข้อมูลส่วนตัว Auditบันทึกผู้ดำเนินการ/เป้าหมาย/เหตุผลการอนุมัติ ระงับ และเปลี่ยนสิทธิ์

ไม่ hard-deleteสมาชิก/ประกาศจากหน้าใช้งาน ใช้สถานะปิด/ระงับเพื่อเก็บประวัติ เนื้อหาประชาสัมพันธ์ลบได้หลังยืนยันในmodal หมวดปิดใช้งานได้

การล้างcookieทำให้ visitorใหม่ได้ ระบบนับviewและpopupไม่ใช่เครื่องมือป้องกันการโกงระดับอุปกรณ์ ชื่อผู้ใช้ไม่ได้เป็นการยืนยันตัวบุคคลหรือการรับรองความแท้ของพระเครื่อง

ยังต้องกำหนด retention, ผู้ดูแลเนื้อหา, backupนอกเครื่อง, HTTPS/domain และ shared rate storeก่อนเปิดหลายinstance ไม่มีการอ้างว่าผ่าน penetration testหรือรับรองกฎหมาย ตัวอย่างข้อความความเป็นส่วนตัวอธิบายพฤติกรรมระบบ ผู้ติดตั้งควรแทนข้อมูลผู้ดูแลและช่องทางติดต่อให้ถูกต้อง
