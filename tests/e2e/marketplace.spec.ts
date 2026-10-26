import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
const origin = "http://localhost:5174";
async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test("catalog responsive layout, keyboard dialog, search and empty state", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "เรื่องราวแห่งศรัทธา",
  );
  await page.getByRole("button", { name: /การแจ้งเตือน/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /การแจ้งเตือน/ }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/playwright/home-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/catalog");
  await page
    .getByLabel("ค้นหารายการ", { exact: true })
    .fill("ไม่พบสินค้านี้แน่นอน-xyz");
  await page
    .locator("main")
    .getByRole("button", { name: "ค้นหา", exact: true })
    .click();
  await expect(page.getByText("ยังไม่มีรายการในส่วนนี้")).toBeVisible();
  await expect(page).toHaveURL(/q=/);
  await page
    .locator("main")
    .getByRole("button", { name: "ล้างคำค้น", exact: true })
    .click();
  await expect(page).not.toHaveURL(/q=/);
  await page.getByLabel("เรียงรายการ").selectOption("price_asc");
  await expect(page).toHaveURL(/sort=price_asc/);
  expect(errors).toEqual([]);
});
test("real member → upload → preview → pending → admin approval → public → favorites", async ({
  page,
  browser,
}, info) => {
  const suffix = `${info.project.name}_${Date.now()}`,
    username = `e2e_${suffix}`,
    password = "E2e928!x",
    title = `พระเครื่องทดสอบ E2E ${suffix}`;
  const showcase = info.project.name === "mobile";
  await page.goto("/register");
  await page.getByLabel("ชื่อที่ใช้แสดง", { exact: true }).fill("นักสะสมทดสอบ");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("short12");
  await page.getByRole("button", { name: "สมัครสมาชิก", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("8 ตัวอักษร");
  await expect(page.getByLabel("ชื่อผู้ใช้", { exact: true })).toHaveValue(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.screenshot({ path: `output/playwright/register-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "สมัครสมาชิก", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/shop");
  await expect(page.getByLabel("ชื่อร้าน", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        window.visualViewport!.width + 1,
    ),
  ).toBe(true);
  await page.getByLabel("ชื่อร้าน", { exact: true }).fill(`ร้าน E2E ${suffix}`);
  await page.getByRole("button", { name: "เพิ่มช่องทาง", exact: true }).click();
  await page.getByLabel("ข้อมูลติดต่อ 1", { exact: true }).fill("@e2epublic");
  await page.getByLabel("เปิดเผย", { exact: true }).check();
  await page
    .getByRole("button", { name: "บันทึกร้านค้า", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "บันทึกร้านค้าแล้ว" }),
  ).toBeVisible();
  await page.goto("/dashboard/new");
  await page
    .getByLabel("รูปภาพพระเครื่อง", { exact: true })
    .setInputFiles(Array.from({ length: 12 }, (_, i) => resolve(`public/brand/amulet-${i % 2 + 1}.webp`)));
  await expect(
    page.getByRole("button", { name: "เลื่อนภาพ 2 ไปก่อนหน้า" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "เลื่อนภาพ 2 ไปก่อนหน้า" }).click();
  await expect(page.locator(".upload-preview")).toHaveCount(12);
  await expect(page.getByLabel("รูปภาพพระเครื่อง", { exact: true })).toBeDisabled();
  const primarySource = await page.locator(".upload-preview img").nth(11).getAttribute("src");
  await page.getByRole("button", { name: "ตั้งภาพ 12 เป็นรูปหลัก", exact: true }).click();
  await expect(page.locator(".upload-preview img").first()).toHaveAttribute("src", primarySource!);
  await page.screenshot({ path: `output/playwright/twelve-images-${info.project.name}.png`, fullPage: true });
  await page.getByLabel("ชื่อพระเครื่อง *", { exact: true }).fill(title);
  await page
    .getByLabel("หมวดหมู่ *", { exact: true })
    .selectOption({ label: "พระสมเด็จ" });
  await page.getByLabel("ราคาแสดงประกาศ (บาท) *", { exact: true }).fill("1234");
  await expect(page.getByLabel("ประเภทประกาศ *", { exact: true })).toHaveValue("SALE");
  await page.getByLabel("ประเภทประกาศ *", { exact: true }).selectOption("SHOW");
  await expect(page.getByLabel("ราคาแสดงประกาศ (บาท) *", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("สถานะราคา", { exact: true })).toHaveCount(0);
  if (!showcase) {
    await page.getByLabel("ประเภทประกาศ *", { exact: true }).selectOption("SALE");
    await expect(page.getByLabel("ราคาแสดงประกาศ (บาท) *", { exact: true })).toHaveValue("1234");
  }
  await page
    .getByLabel("รายละเอียดพระเครื่อง * (อย่างน้อย 20 ตัวอักษร)", {
      exact: true,
    })
    .fill("พระเครื่องสำหรับการทดสอบการประกาศและอนุมัติจริงผ่านหน้าเว็บไซต์");
  await page.getByRole("button", { name: "ดูตัวอย่าง", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(title);
  await expect(page.getByRole("dialog")).toContainText(showcase ? "สำหรับโชว์" : "สำหรับขาย");
  if (showcase) await expect(page.getByRole("dialog")).toContainText("ไม่เปิดขาย");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "ส่งตรวจสอบ", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("รอตรวจสอบ", { exact: true })).toBeVisible();
  const mine = await page.request.get("/api/me/amulets");
  const own = await mine.json();
  const listing = own.items.find((x: { title: string }) => x.title === title);
  expect(listing.status).toBe("PENDING");
  expect(listing.listingType).toBe(showcase ? "SHOW" : "SALE");
  if (showcase) expect(listing.price).toBeNull();
  expect(listing.images).toHaveLength(12);
  expect(primarySource).toContain(listing.images[0].uploadId);
  await page.goto(`/dashboard/edit/${listing.id}`);
  await expect(page.getByLabel("ประเภทประกาศ *", { exact: true })).toHaveValue(showcase ? "SHOW" : "SALE");
  await expect(page.locator(".upload-preview img").first()).toHaveAttribute("src", primarySource!);
  const publicContext = await browser.newContext({ baseURL: origin });
  const publicPage = await publicContext.newPage();
  expect(
    (await publicPage.request.get(`/api/amulets/${listing.id}`)).status(),
  ).toBe(404);
  await login(page, "e2e_admin", "E2E-test-only-admin-593!");
  await page.goto(`/admin?q=${encodeURIComponent(title)}`);
  await page.getByRole("button", { name: "ตรวจสอบ", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(title);
  await expect(
    page.getByRole("dialog").locator(".preview-gallery img"),
  ).toHaveCount(12);
  await page.getByLabel("ผลการตรวจสอบ").selectOption("APPROVED");
  await page
    .getByRole("button", { name: "บันทึกผลการตรวจสอบ", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator("tbody").getByText("เผยแพร่แล้ว", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `output/playwright/admin-${info.project.name}.png`,
    fullPage: true,
  });
  await publicPage.goto(`/amulet/${listing.id}`);
  await expect(publicPage.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(publicPage.locator(".detail-info")).toContainText(showcase ? "สำหรับโชว์" : "สำหรับขาย");
  if (showcase) await expect(publicPage.locator(".detail-price")).toHaveText("ไม่เปิดขาย");
  await publicPage.screenshot({ path: `output/playwright/listing-type-${info.project.name}.png`, fullPage: true });
  expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(publicPage.locator(".detail-image img")).toHaveAttribute("src", primarySource!.split("?")[0]);
  await publicPage.getByRole("button", { name: "ดูภาพที่ 12", exact: true }).click();
  await expect(publicPage.locator(".detail-image img")).toHaveAttribute("alt", `${title} ภาพที่ 12`);
  await expect(
    publicPage.getByText("@e2epublic", { exact: true }),
  ).toBeVisible();
  await publicContext.close();
  await login(page, username, password);
  await page.goto(`/amulet/${listing.id}`);
  await page
    .getByRole("button", { name: "บันทึกรายการโปรด", exact: true })
    .click();
  await page.goto("/dashboard/favorites");
  await expect(page.getByRole("heading", { level: 3 })).toContainText(title);
  await expect(page.locator(".amulet-card")).toContainText(showcase ? "สำหรับโชว์" : "สำหรับขาย");
  await page.goto("/dashboard/notifications");
  await expect(page.locator("main")).toContainText("ประกาศอนุมัติแล้ว");
  await page.getByRole("button", { name: "อ่านทั้งหมด", exact: true }).click();
  await expect(
    page.getByText("0 รายการยังไม่อ่าน", { exact: true }),
  ).toBeVisible();
  await page.goto("/dashboard/referrals");
  await expect(page.getByAltText("QR Code ลิงก์แนะนำเพื่อน")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const memberContext = await browser.newContext({ baseURL: origin });
  const memberPage = await memberContext.newPage();
  await login(memberPage, username, password);
  const memberSession = await (await memberPage.request.get("/api/auth/me")).json();
  const memberShop = await (await memberPage.request.get("/api/me/shop")).json();
  const paused = await memberPage.request.put("/api/me/shop", {
    headers: { Origin: origin, "X-CSRF-Token": memberSession.csrf }, data: { ...memberShop, active: false },
  });
  expect(paused.status()).toBe(200);
  await memberPage.goto("/dashboard");
  await expect(memberPage.getByText("ร้านของคุณยังปิดอยู่", { exact: true })).toBeVisible();
  await expect(memberPage.locator(".own-item .status")).toHaveText("อนุมัติแล้ว");
  await expect(memberPage.getByRole("link", { name: "ดูประกาศ", exact: true })).toHaveCount(0);
  expect((await browser.newPage().then(async p => { try { return (await p.request.get(`${origin}/api/amulets/${listing.id}`)).status(); } finally { await p.close(); } }))).toBe(404);
  await memberPage.screenshot({ path: `output/playwright/shop-closed-warning-${info.project.name}.png`, fullPage: true });
  await memberPage.getByRole("link", { name: "เปิดร้านจากตั้งค่าร้านค้า", exact: true }).click();
  await memberPage.getByLabel("เปิดร้านสาธารณะ (ปิดเพื่อพักร้านและซ่อนประกาศทั้งหมด)", { exact: true }).check();
  await memberPage.getByRole("button", { name: "บันทึกร้านค้า", exact: true }).click();
  await expect(memberPage.getByText("บันทึกร้านค้าแล้ว", { exact: true })).toBeVisible();
  await memberPage.goto("/dashboard");
  await expect(memberPage.getByText("ร้านของคุณยังปิดอยู่", { exact: true })).toHaveCount(0);
  await expect(memberPage.getByRole("link", { name: "ดูประกาศ", exact: true })).toBeVisible();
  expect((await memberPage.request.get(`/api/amulets/${listing.id}`)).status()).toBe(200);
  await login(page, "e2e_admin", "E2E-test-only-admin-593!");
  await page.goto(`/admin/users?q=${username}`);
  const resetButton = page.getByRole("button", { name: "รีเซ็ตรหัสผ่าน", exact: true });
  await resetButton.click();
  await expect(page.getByRole("dialog")).toContainText(username);
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(resetButton).toBeFocused();
  await resetButton.click();
  await page.getByLabel("รหัสผ่านของผู้ดูแล", { exact: true }).fill("wrong-password");
  await page.getByLabel("รหัสผ่านใหม่ของสมาชิก (อย่างน้อย 8 ตัวอักษร)", { exact: true }).fill("New928!x");
  await page.getByLabel("ยืนยันรหัสผ่านใหม่", { exact: true }).fill("New928!x");
  await page.getByLabel("เหตุผลการรีเซ็ต (อย่างน้อย 5 ตัวอักษร)", { exact: true }).fill("ยืนยันเจ้าของบัญชีสำหรับการทดสอบแล้ว");
  await page.getByRole("button", { name: "ยืนยันรีเซ็ตรหัสผ่าน", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("รหัสผ่านของผู้ดูแลไม่ถูกต้อง");
  await expect(page.getByLabel("ยืนยันรหัสผ่านใหม่", { exact: true })).toHaveValue("New928!x");
  await page.getByLabel("รหัสผ่านของผู้ดูแล", { exact: true }).fill("E2E-test-only-admin-593!");
  await page.screenshot({ path: `output/playwright/reset-password-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "ยืนยันรีเซ็ตรหัสผ่าน", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await memberPage.request.get("/api/me/shop")).status()).toBe(401);
  await login(memberPage, username, "New928!x");
  await memberContext.close();
});
test("form failures preserve input; protected admin route denies members; unsaved form is guarded", async ({
  page,
}, info) => {
  const suffix = `guard_${info.project.name}_${Date.now()}`;
  await page.goto("/register");
  await page.getByRole("button", { name: "สมัครสมาชิก", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByLabel("ชื่อที่ใช้แสดง", { exact: true })
    .fill("ทดสอบการแก้ไข");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(suffix);
  await page
    .getByLabel("รหัสผ่าน", { exact: true })
    .fill("E2E-guard-password-45!");
  await page.getByRole("button", { name: "สมัครสมาชิก", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
  );
  await page.goto("/dashboard/new");
  await page
    .getByLabel("ชื่อพระเครื่อง *", { exact: true })
    .fill("ข้อมูลที่ยังไม่บันทึก");
  await page.getByRole("link", { name: "ประกาศของฉัน", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "ยังมีข้อมูลที่ไม่ได้บันทึก",
  );
  await page
    .getByRole("button", { name: "อยู่ในหน้านี้", exact: true })
    .click();
  await expect(
    page.getByLabel("ชื่อพระเครื่อง *", { exact: true }),
  ).toHaveValue("ข้อมูลที่ยังไม่บันทึก");
  await page.getByRole("button", { name: "ส่งตรวจสอบ", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByLabel("ชื่อพระเครื่อง *", { exact: true }),
  ).toHaveValue("ข้อมูลที่ยังไม่บันทึก");
});
test("loading skeleton, server error and retry recover without a page reload", async ({
  page,
}) => {
  let shouldFail = true;
  await page.route("**/api/amulets?**", async (route) => {
    if (shouldFail)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "ทดสอบเซิร์ฟเวอร์ไม่พร้อมใช้งาน" }),
      });
    else await route.continue();
  });
  await page.goto("/catalog?sort=newest");
  await expect(
    page.getByText("โหลดข้อมูลไม่สำเร็จ", { exact: true }),
  ).toBeVisible();
  shouldFail = false;
  await page.getByRole("button", { name: "ลองอีกครั้ง", exact: true }).click();
  await expect(
    page.getByText("โหลดข้อมูลไม่สำเร็จ", { exact: true }),
  ).not.toBeVisible();
  await expect(page.getByLabel("กำลังโหลดข้อมูล")).toHaveCount(0);
});

test("popup announcements rotate, pause, preserve view counts, close as a group and respect reduced motion", async ({ page, browser }, info) => {
  const adminContext = await browser.newContext({ baseURL: origin });
  const staff = await adminContext.newPage();
  const ids: string[] = [];
  await login(staff, "e2e_admin", "E2E-test-only-admin-593!");
  const session = await (await staff.request.get("/api/auth/me")).json();
  const headers = { Origin: origin, "X-CSRF-Token": session.csrf };
  const suffix = `${info.project.name}_${Date.now()}`;
  try {
    const upload = await staff.request.post("/api/uploads", {
      headers, multipart: { image: { name: "popup.webp", mimeType: "image/webp", buffer: await readFile(resolve("public/brand/amulet-1.webp")) } },
    });
    expect(upload.status()).toBe(201);
    const imageId = (await upload.json()).id;
    const startsAt = new Date(Date.now() - 60000).toISOString();
    for (let i = 0; i < 3; i++) {
      const response = await staff.request.post("/api/admin/content/popups", { headers, data: {
        name: `slides_${suffix}_${i}`, title: `ประกาศสไลด์ ${i + 1} ${suffix}`, body: `รายละเอียดประกาศประชาสัมพันธ์รายการที่ ${i + 1}`,
        imageId, buttonText: "เปิดรายการพระเครื่อง", url: "/catalog", active: true,
        startsAt, endsAt: new Date(Date.now() + 3600000).toISOString(), audience: "GUEST", page: "/guide",
        delaySeconds: i === 2 ? 20 : 0, maxViews: 1, oncePerSession: true, intervalHours: 0,
      } });
      expect(response.status()).toBe(201);
      ids.push((await response.json()).id);
    }
    await staff.goto("/admin/content");
    await expect(staff.getByRole("button", { name: "เพิ่มประกาศป๊อปอัป" })).toBeVisible();
    await expect(staff.locator("main")).toContainText(`ประกาศสไลด์ 1 ${suffix}`);
    await expect(staff.locator("main")).toContainText(`ประกาศสไลด์ 2 ${suffix}`);
    const claims: string[] = [];
    page.on("request", req => { if (req.method() === "POST" && /\/popups\/[^/]+\/claim$/.test(req.url())) claims.push(req.url()); });
    await page.clock.install();
    await page.goto("/guide");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`ประกาศสไลด์ 1 ${suffix}`);
    await expect(dialog).toContainText("ประกาศที่ 1 จาก 2");
    await page.mouse.move(0, 0);
    await page.clock.fastForward(5100);
    await expect(dialog).toContainText(`ประกาศสไลด์ 2 ${suffix}`);
    expect(claims).toHaveLength(2);
    await page.getByRole("button", { name: "ประกาศก่อนหน้า", exact: true }).click();
    await expect(dialog).toContainText(`ประกาศสไลด์ 1 ${suffix}`);
    await page.clock.fastForward(6000);
    await expect(dialog).toContainText(`ประกาศสไลด์ 1 ${suffix}`);
    expect(claims).toHaveLength(2);
    await page.screenshot({ path: `output/playwright/popup-slides-${info.project.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "เล่นอัตโนมัติ", exact: true }).click();
    await page.mouse.move(0, 0);
    await page.clock.fastForward(5100);
    await expect(dialog).toContainText(`ประกาศสไลด์ 2 ${suffix}`);
    expect(claims).toHaveLength(2);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page.clock.fastForward(30000);
    await expect(dialog).not.toBeVisible();
    expect(claims).toHaveLength(2);

    await page.context().clearCookies();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/guide");
    await expect(dialog).toContainText(`ประกาศสไลด์ 1 ${suffix}`);
    await expect(page.getByRole("button", { name: "เล่นอัตโนมัติ", exact: true })).toBeVisible();
    await page.clock.fastForward(6000);
    await expect(dialog).toContainText(`ประกาศสไลด์ 1 ${suffix}`);
    await page.getByRole("button", { name: "ไปประกาศที่ 2", exact: true }).click();
    await expect(dialog).toContainText(`ประกาศสไลด์ 2 ${suffix}`);
    await page.getByRole("link", { name: "เปิดรายการพระเครื่อง", exact: true }).click();
    await expect(page).toHaveURL(/\/catalog$/);
    await expect(dialog).not.toBeVisible();

    await page.context().clearCookies();
    let failNext = true;
    await page.route(`**/api/popups/${ids[1]}/claim`, async route => {
      if (failNext) {
        failNext = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "ทดสอบการเชื่อมต่อ" }) });
      } else await route.continue();
    });
    await page.goto("/guide");
    await expect(dialog).toContainText(`ประกาศสไลด์ 1 ${suffix}`);
    await page.getByRole("button", { name: "ประกาศถัดไป", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("โหลดประกาศถัดไปไม่สำเร็จ");
    await expect(dialog).toContainText(`ประกาศสไลด์ 1 ${suffix}`);
    await page.getByRole("button", { name: "ลองอีกครั้ง", exact: true }).click();
    await expect(dialog).toContainText(`ประกาศสไลด์ 2 ${suffix}`);
    await page.keyboard.press("Escape");

    await page.context().clearCookies();
    await page.route(`**/api/popups/${ids[0]}/claim`, route => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "แสดงครบแล้ว" }) }));
    await page.goto("/guide");
    await expect(dialog).toContainText(`ประกาศสไลด์ 2 ${suffix}`);
  } finally {
    for (const id of ids) await staff.request.delete(`/api/admin/content/popups/${id}`, { headers, data: {} });
    await adminContext.close();
  }
});
