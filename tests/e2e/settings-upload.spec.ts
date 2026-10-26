import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
const origin="http://localhost:5174";

test("registration switch persists, blocks stale signup, reopens, and both listing and popup uploads are optimized",async({page,browser},info)=>{
  const staffContext=await browser.newContext({...info.project.use,baseURL:origin});
  const visitorContext=await browser.newContext({...info.project.use,baseURL:origin});
  const staff=await staffContext.newPage(),visitor=await visitorContext.newPage();
  const login=await staff.request.post("/api/auth/login",{headers:{Origin:origin},data:{username:"e2e_admin",password:"E2E-test-only-admin-593!"}});
  expect(login.status()).toBe(200);
  const {csrf}=await login.json();
  const headers={Origin:origin,"X-CSRF-Token":csrf};
  const settings=await (await staff.request.get("/api/settings")).json();
  const suffix=`${info.project.name}_${Date.now()}`;
  let popupId="";
  async function fillSignup(){
    await page.getByLabel("ชื่อที่ใช้แสดง",{exact:true}).fill("ทดสอบการเปิดรับสมาชิก");
    await page.getByLabel("ชื่อผู้ใช้",{exact:true}).fill(`switch_${suffix}`);
    await page.getByLabel("รหัสผ่าน",{exact:true}).fill("Switch-e2e-82!");
  }
  async function saveSettings(){
    const response=staff.waitForResponse(r=>r.url().endsWith("/api/admin/settings") && r.request().method()==="PUT");
    await staff.getByRole("button",{name:"บันทึกการตั้งค่า",exact:true}).click();
    expect((await response).status()).toBe(200);
  }
  try {
    await staff.request.put("/api/admin/settings",{headers,data:{...settings,registrationEnabled:true}});
    await staff.goto("/admin/settings");
    await expect(staff.getByRole("switch",{name:"เปิดรับสมัครสมาชิก"})).toBeChecked();
    await page.goto("/register");await fillSignup();
    await staff.getByRole("switch",{name:"เปิดรับสมัครสมาชิก"}).uncheck();await saveSettings();
    await staff.reload();await expect(staff.getByRole("switch",{name:"เปิดรับสมัครสมาชิก"})).not.toBeChecked();
    await staff.getByRole("switch",{name:"เปิดรับสมัครสมาชิก"}).scrollIntoViewIfNeeded();
    await staff.screenshot({path:`output/playwright/registration-switch-${info.project.name}.png`});
    await visitor.goto("/register");
    await expect(visitor.getByRole("heading",{name:"ปิดรับสมัครสมาชิกชั่วคราว",exact:true})).toBeVisible();
    await expect(visitor.getByLabel("ชื่อผู้ใช้",{exact:true})).toHaveCount(0);
    await visitor.screenshot({path:`output/playwright/registration-closed-${info.project.name}.png`,fullPage:true});
    await page.getByRole("button",{name:"สมัครสมาชิก",exact:true}).click();
    await expect(page.getByRole("heading",{name:"ปิดรับสมัครสมาชิกชั่วคราว",exact:true})).toBeVisible();
    const existing=await visitor.request.post("/api/auth/login",{headers:{Origin:origin},data:{username:"e2e_admin",password:"E2E-test-only-admin-593!"}});
    expect(existing.status()).toBe(200);
    await staff.getByRole("switch",{name:"เปิดรับสมัครสมาชิก"}).check();await saveSettings();
    await page.goto("/register");await fillSignup();
    await page.getByRole("button",{name:"สมัครสมาชิก",exact:true}).click();await expect(page).toHaveURL(/\/dashboard$/);

    const input=await sharp(await readFile(resolve("public/brand/amulet-1.webp"))).resize({width:2200}).png().toBuffer();
    const file={name:"large-amulet.png",mimeType:"image/png",buffer:input};
    await page.goto("/dashboard/new");
    const uploadResponse=page.waitForResponse(r=>r.url().endsWith("/api/uploads") && r.request().method()==="POST");
    await page.getByLabel("รูปภาพพระเครื่อง",{exact:true}).setInputFiles(file);
    const upload=await (await uploadResponse).json();
    expect(upload.optimization.format).toBe("webp");expect(upload.optimization.imageBytes).toBeLessThanOrEqual(1024*1024);expect(upload.optimization.imageBytes).toBeLessThan(input.length);
    await expect(page.locator(".upload-preview")).toHaveCount(1);
    await page.getByLabel("ชื่อพระเครื่อง *",{exact:true}).fill(`บีบอัดรูป ${suffix}`);
    await page.getByLabel("หมวดหมู่ *",{exact:true}).selectOption({label:"พระสมเด็จ"});
    await page.getByLabel("ประเภทประกาศ *",{exact:true}).selectOption("SHOW");
    await page.getByLabel("รายละเอียดพระเครื่อง * (อย่างน้อย 20 ตัวอักษร)",{exact:true}).fill("ทดสอบระบบบีบอัดรูปก่อนบันทึกและแนบภาพที่แปลงแล้วกับประกาศจริง");
    await page.getByRole("button",{name:"บันทึกแบบร่าง",exact:true}).click();await expect(page).toHaveURL(/\/dashboard$/);
    const listing=await (await page.request.get("/api/me/amulets")).json();
    expect(listing.items[0].images[0].uploadId).toBe(upload.id);
    const stored=await page.request.get(`/api/media/${upload.id}`);
    expect((await sharp(await stored.body()).metadata()).format).toBe("webp");

    await staff.goto("/admin/content");await staff.getByRole("button",{name:"เพิ่มประกาศป๊อปอัป",exact:true}).click();
    const dialog=staff.getByRole("dialog");
    await dialog.getByLabel("ชื่อรายการสำหรับผู้ดูแล",{exact:true}).fill(`compressed_${suffix}`);
    await dialog.getByLabel("หัวข้อ",{exact:true}).fill(`ภาพประชาสัมพันธ์ ${suffix}`);
    await dialog.getByLabel("รายละเอียด",{exact:true}).fill("ภาพนี้ผ่านการย่อขนาดและบีบอัดก่อนบันทึก");
    const popupUploadResponse=staff.waitForResponse(r=>r.url().endsWith("/api/uploads") && r.request().method()==="POST");
    await dialog.getByLabel("ภาพประชาสัมพันธ์",{exact:true}).setInputFiles(file);
    const popupUpload=await (await popupUploadResponse).json();
    expect(popupUpload.optimization.format).toBe("webp");expect(popupUpload.optimization.imageBytes).toBeLessThanOrEqual(1024*1024);expect(popupUpload.optimization.thumbnailBytes).toBeLessThanOrEqual(150*1024);
    await expect(dialog.locator(".upload-preview")).toHaveCount(1);
    const saved=staff.waitForResponse(r=>r.url().endsWith("/api/admin/content/popups") && r.request().method()==="POST");
    await dialog.getByRole("button",{name:"บันทึกเนื้อหา",exact:true}).click();
    const popup=await (await saved).json();popupId=popup.id;expect(popup.imageId).toBe(popupUpload.id);
    await expect(dialog).not.toBeVisible();
  } finally {
    await staff.request.put("/api/admin/settings",{headers,data:settings});
    if(popupId)await staff.request.delete(`/api/admin/content/popups/${popupId}`,{headers,data:{}});
    await staffContext.close();await visitorContext.close();
  }
});
