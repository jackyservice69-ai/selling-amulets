import { test, expect } from "@playwright/test";
const origin="http://localhost:5174";

test("publisher contacts managers, both bells open the conversation, replies preserve drafts and managers close the case",async({page,browser},info)=>{
  const suffix=`${info.project.name}_${Date.now()}`;
  const subject=`สอบถามประกาศ ${suffix}`;
  const text="ต้องการให้ผู้ดูแลช่วยตรวจสอบรูปภาพในประกาศของฉัน";
  const registration=await page.request.post("/api/auth/register",{headers:{Origin:origin},data:{username:`support_${suffix}`,password:"Support-e2e-82!",displayName:"ผู้ประกาศทดสอบแจ้งเรื่อง"}});
  expect(registration.status()).toBe(201);
  const staffContext=await browser.newContext({...info.project.use,baseURL:origin});
  const staff=await staffContext.newPage();
  try {
    const login=await staff.request.post("/api/auth/login",{headers:{Origin:origin},data:{username:"e2e_admin",password:"E2E-test-only-admin-593!"}});
    expect(login.status()).toBe(200);
    await staff.goto("/admin/support");
    await expect(staff.getByRole("heading",{name:"รับแจ้งเรื่อง",exact:true})).toBeVisible();
    await page.goto("/dashboard");
    await page.getByRole("link",{name:"แจ้งเรื่องถึงผู้ดูแล",exact:true}).click();
    await page.getByRole("link",{name:"แจ้งเรื่องใหม่",exact:true}).click();
    await page.getByRole("button",{name:"ส่งเรื่องถึงผู้ดูแล",exact:true}).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByLabel("หัวข้อเรื่อง",{exact:true}).fill(subject);
    await page.getByLabel("รายละเอียดเรื่อง",{exact:true}).fill(text);
    await page.getByRole("link",{name:"กลับรายการแจ้งเรื่อง",exact:true}).click();
    await expect(page.getByRole("dialog")).toContainText("ยังมีข้อมูลที่ไม่ได้บันทึก");
    await page.getByRole("button",{name:"อยู่ในหน้านี้",exact:true}).click();
    let fail=true;
    await page.route("**/api/me/support",async route=>{
      if(route.request().method()==="POST" && fail){fail=false;await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"ทดสอบระบบขัดข้อง กรุณาลองอีกครั้ง"})});}
      else await route.continue();
    });
    await page.getByRole("button",{name:"ส่งเรื่องถึงผู้ดูแล",exact:true}).click();
    await expect(page.getByRole("alert")).toContainText("ทดสอบระบบขัดข้อง");
    await expect(page.getByLabel("รายละเอียดเรื่อง",{exact:true})).toHaveValue(text);
    await page.getByRole("button",{name:"ส่งเรื่องถึงผู้ดูแล",exact:true}).click();
    await expect(page).toHaveURL(/\/dashboard\/support\/c[a-z0-9]+$/);
    const id=page.url().split("/").at(-1)!;
    await expect(page.locator(".support-message")).toContainText(text);

    await staff.getByRole("button",{name:/การแจ้งเตือน .* รายการยังไม่อ่าน/}).click();
    const notification=staff.getByRole("dialog").getByRole("link").filter({hasText:subject});
    await expect(notification).toContainText("มีเรื่องแจ้งใหม่จากผู้ประกาศ");
    await notification.click();
    await expect(staff).toHaveURL(new RegExp(`/admin/support/${id}$`));
    await expect(staff.locator(".support-message")).toContainText(text);
    await staff.getByRole("button",{name:"ส่งข้อความตอบกลับ",exact:true}).click();
    await expect(staff.getByRole("alert")).toBeVisible();
    await staff.getByLabel("ข้อความตอบกลับ",{exact:true}).fill("ผู้ดูแลตรวจสอบแล้ว กรุณาส่งรายละเอียดเพิ่มเติมครับ");
    await staff.getByRole("button",{name:"ส่งข้อความตอบกลับ",exact:true}).click();
    await expect(staff.getByLabel("ข้อความตอบกลับ",{exact:true})).toHaveValue("");

    await page.getByRole("button",{name:/การแจ้งเตือน .* รายการยังไม่อ่าน/}).click();
    const answer=page.getByRole("dialog").getByRole("link").filter({hasText:subject});
    await expect(answer).toContainText("ผู้ดูแลตอบกลับเรื่องของคุณ");
    await answer.click();
    await expect(page.locator(".support-message-staff")).toContainText("กรุณาส่งรายละเอียดเพิ่มเติม");
    await page.getByLabel("ข้อความตอบกลับ",{exact:true}).fill("ส่งข้อมูลเพิ่มเติมเรียบร้อยแล้วครับ");
    let conflict=true;
    await page.route(`**/api/me/support/${id}/messages`,async route=>{
      if(conflict){conflict=false;await route.fulfill({status:409,contentType:"application/json",body:JSON.stringify({error:"มีข้อความใหม่ กรุณาโหลดเรื่องล่าสุด"})});}
      else await route.continue();
    });
    await page.getByRole("button",{name:"ส่งข้อความตอบกลับ",exact:true}).click();
    await expect(page.getByRole("alert")).toContainText("โหลดเรื่องล่าสุด");
    await page.getByRole("button",{name:"โหลดเรื่องล่าสุด",exact:true}).click();
    await expect(page.getByLabel("ข้อความตอบกลับ",{exact:true})).toHaveValue("ส่งข้อมูลเพิ่มเติมเรียบร้อยแล้วครับ");
    await page.getByRole("button",{name:"ส่งข้อความตอบกลับ",exact:true}).click();
    await expect(page.getByLabel("ข้อความตอบกลับ",{exact:true})).toHaveValue("");
    await staff.getByRole("button",{name:/การแจ้งเตือน .* รายการยังไม่อ่าน/}).click();
    await staff.getByRole("dialog").getByRole("link").filter({hasText:subject}).first().click();
    await expect(staff.locator(".support-messages")).toContainText("ส่งข้อมูลเพิ่มเติมเรียบร้อยแล้วครับ");
    await staff.getByLabel("ข้อความตอบกลับ",{exact:true}).fill("แก้ไขปัญหาให้เรียบร้อยแล้ว ขอบคุณที่แจ้งเข้ามาครับ");
    await staff.getByLabel("สถานะหลังตอบกลับ",{exact:true}).selectOption("CLOSED");
    await staff.getByRole("button",{name:"ส่งข้อความตอบกลับ",exact:true}).click();
    await expect(staff.locator(".support-status")).toHaveText("ปิดเรื่องแล้ว");
    await staff.screenshot({path:`output/playwright/support-admin-${info.project.name}.png`,fullPage:true});
    await page.getByRole("button",{name:/การแจ้งเตือน .* รายการยังไม่อ่าน/}).click();
    await page.getByRole("dialog").getByRole("link").filter({hasText:subject}).first().click();
    await expect(page.locator(".support-status")).toHaveText("ปิดเรื่องแล้ว");
    await expect(page.locator(".support-messages")).toContainText("แก้ไขปัญหาให้เรียบร้อยแล้ว");
    await page.screenshot({path:`output/playwright/support-member-${info.project.name}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await staff.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await staff.getByRole("link",{name:"กลับรายการแจ้งเรื่อง",exact:true}).click();
    await staff.getByLabel("สถานะเรื่อง",{exact:true}).selectOption("CLOSED");
    await expect(staff.locator(".support-list")).toContainText(subject);
    const notices=await (await page.request.get("/api/me/notifications")).json();
    expect(notices.items.filter((n:{href:string})=>n.href===`/dashboard/support/${id}`).every((n:{readAt:string|null})=>n.readAt)).toBe(true);
  } finally {await staffContext.close();}
});
