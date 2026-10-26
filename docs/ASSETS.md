# ภาพ ฟอนต์ และแหล่งที่มา

ภาพประกอบเป็นภาพที่สร้างด้วย imagegen ในงานนี้ เพื่อสาธิตหน้าตาพระเครื่อง ไม่มีการรับรองว่าเป็นวัตถุจริง ใช้คำว่า “ตัวอย่าง” ใน seed และข้อความภาพประกอบบนหน้าเว็บ

| ไฟล์ | แนวทาง prompt ที่ใช้ |
|---|---|
| `public/brand/hero.webp`, `hero.png`, `amulet-1.webp` | ภาพผลิตภัณฑ์พระสมเด็จเนื้อผงสีงาช้างในกรอบทอง บนแท่นวอลนัท ฉากสีน้ำตาล แสงพิพิธภัณฑ์ ภาพจัตุรัส ไม่มีตัวหนังสือ |
| `public/brand/amulet-2.webp` | เหรียญพระเนื้อทองแดงผิวเก่า ภาพระยะใกล้ แสงนุ่ม ฉากเรียบ ให้เห็นเนื้อวัสดุ ไม่มีข้อความกำกับ |
| `public/brand/amulet-3.webp` | พระรูปหล่อขนาดเล็กเนื้อสัมฤทธิ์ บนพื้นเรียบโทนครีม ภาพสะสมเชิงผลิตภัณฑ์ แสงนุ่ม ไม่มีตัวหนังสือ |
| `public/brand/amulet-4.webp` | พระเครื่องเนื้อดินสีน้ำตาล ผิวธรรมชาติ ภาพจัตุรัส ฉากเรียบ แสงสตูดิโอ ไม่มีข้อความ |

ตารางเป็นคำอธิบายสาระของ prompt ไม่ใช่ transcriptคำต่อคำ ต้นฉบับที่เครื่องนี้อยู่ใน `C:/Users/ADMIN/.codex/generated_images/01a17773-eec7-7fc0-bc1d-898533638efc/`:

- exec-78413178-700c-460d-b838-f5ed41ab5870.png (hero)
- exec-395c9151-9dc9-4469-ae84-aecc16616cc1.png (medal)
- exec-0d1cafe0-241d-497a-b210-0852b732cd75.png (statue)
- exec-a240aecf-1d24-4b2a-b7f7-b7ed6b1a8174.png (clay)

ใช้ Sharp ลดขนาด/บีบอัดWebPสำหรับหน้าเว็บและseed ภาพจริงของสมาชิกต้องเป็นไฟล์ที่ผู้ลงประกาศมีสิทธิ์ใช้ โลโก้ `mark.svg` เป็นvectorเรียบง่ายที่วาดสำหรับโครงการนี้ ไม่อ้างว่าเป็นตราวัดหรือองค์กร

Sarabun400/500/600/700 และ Noto Serif Thai ให้บริการจาก `public/fonts/` ภายในเว็บไซต์ พร้อม SIL Open Font Licenseในโฟลเดอร์เดียวกัน แหล่ง [Google Fonts Sarabun](https://github.com/google/fonts/tree/main/ofl/sarabun), [Noto Serif Thai](https://github.com/google/fonts/tree/main/ofl/notoserifthai) ไม่มีrequestไปGoogle Fontsระหว่างใช้งาน

Iconsใช้Lucide React packageและสัญลักษณ์หมวดแบบตัวอักษร ไม่โหลดภาพสินค้าเว็บภายนอก
