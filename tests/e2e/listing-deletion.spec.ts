import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const origin = "http://localhost:5174";
test("shops delete their own listings and administrators delete with a reason", async ({ page, browser }, info) => {
  const suffix = `${info.project.name}_${Date.now()}`;
  const signup = await page.request.post("/api/auth/register", { headers: { Origin: origin }, data: {
    username: `delete_${suffix}`, password: "Delete-test-82!", displayName: "ร้านทดสอบลบประกาศ",
  } });
  expect(signup.status()).toBe(201);
  const auth = await signup.json(), headers = { Origin: origin, "X-CSRF-Token": auth.csrf };
  const upload = await page.request.post("/api/uploads", { headers, multipart: {
    image: { name: "amulet.webp", mimeType: "image/webp", buffer: await readFile("public/brand/amulet-1.webp") },
  } });
  expect(upload.status()).toBe(201);
  const image = await upload.json();
  const categories = await (await page.request.get("/api/categories")).json();
  const shop = await (await page.request.get("/api/me/shop")).json();
  expect((await page.request.put("/api/me/shop", { headers, data: { ...shop, active: true } })).status()).toBe(200);
  async function create(title: string) {
    const response = await page.request.post("/api/me/amulets", { headers, data: {
      title, description: "รายละเอียดประกาศสำหรับทดสอบการลบจากหน้าจอจริง",
      categoryId: categories[0].id, priceType: "ASK", imageIds: [image.id],
    } });
    expect(response.status()).toBe(201);
    return response.json();
  }
  const own = await create(`เจ้าของลบ ${suffix}`);
  const managed = await create(`ผู้ดูแลลบ ${suffix}`);
  await page.goto("/dashboard");
  const ownCard = page.locator(".own-item").filter({ hasText: own.title });
  await ownCard.getByRole("button", { name: "ลบประกาศ", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "ลบประกาศ", exact: true });
  await expect(dialog.getByRole("button", { name: "ยกเลิก", exact: true })).toBeFocused();
  await expect(dialog).toContainText(own.title);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(ownCard.getByRole("button", { name: "ลบประกาศ", exact: true })).toBeFocused();
  await expect(ownCard).toBeVisible();
  await ownCard.getByRole("button", { name: "ลบประกาศ", exact: true }).click();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/me/amulets/${own.id}`, async (route) => {
    await pending;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "ทดสอบระบบไม่พร้อม กรุณาลองอีกครั้ง" }) });
  }, { times: 1 });
  await dialog.getByRole("button", { name: "ยืนยันลบประกาศ", exact: true }).click();
  try {
    await expect(dialog.getByRole("button", { name: "ยืนยันลบประกาศ", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "ยกเลิก", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  } finally { release(); }
  await expect(dialog.getByRole("alert")).toContainText("ทดสอบระบบไม่พร้อม");
  await expect(dialog).toContainText(own.title);
  await page.screenshot({ path: `output/playwright/delete-owner-${info.project.name}.png`, fullPage: true });
  await dialog.getByRole("button", { name: "ยืนยันลบประกาศ", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(ownCard).toHaveCount(0);
  expect((await page.request.get(`/api/me/amulets/${own.id}`)).status()).toBe(404);

  const context = await browser.newContext({ ...info.project.use, baseURL: origin });
  try {
    const staff = await context.newPage();
    const login = await staff.request.post("/api/auth/login", { headers: { Origin: origin }, data: { username: "e2e_admin", password: "E2E-test-only-admin-593!" } });
    expect(login.status()).toBe(200);
    const staffHeaders = { Origin: origin, "X-CSRF-Token": (await login.json()).csrf };
    expect((await staff.request.post(`/api/admin/amulets/${managed.id}/status`, { headers: staffHeaders, data: { status: "APPROVED", version: managed.version } })).status()).toBe(200);
    expect((await page.request.get(`/api/amulets/${managed.id}`)).status()).toBe(200);
    await staff.goto(`/admin?q=${encodeURIComponent(managed.title)}`);
    const row = staff.getByRole("row").filter({ hasText: managed.title });
    await row.getByRole("button", { name: "ลบประกาศ", exact: true }).click();
    dialog = staff.getByRole("dialog", { name: "ลบประกาศ", exact: true });
    await expect(dialog.getByRole("button", { name: "ยกเลิก", exact: true })).toBeFocused();
    await dialog.getByRole("button", { name: "ยืนยันลบประกาศ", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog.getByLabel("เหตุผลการลบ", { exact: true }).fill("ลบตามคำขอของเจ้าของร้าน");
    await staff.route(`**/api/admin/amulets/${managed.id}`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "ทดสอบการลองใหม่" }) }), { times: 1 });
    await dialog.getByRole("button", { name: "ยืนยันลบประกาศ", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("ทดสอบการลองใหม่");
    await expect(dialog.getByLabel("เหตุผลการลบ", { exact: true })).toHaveValue("ลบตามคำขอของเจ้าของร้าน");
    await staff.screenshot({ path: `output/playwright/delete-admin-${info.project.name}.png`, fullPage: true });
    await dialog.getByRole("button", { name: "ยืนยันลบประกาศ", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(row).toHaveCount(0);
    expect((await page.request.get(`/api/amulets/${managed.id}`)).status()).toBe(404);
    expect((await (await staff.request.get(`/api/admin/amulets?q=${encodeURIComponent(managed.title)}`)).json()).total).toBe(0);
    const notices = await (await page.request.get("/api/me/notifications")).json();
    expect(notices.items.some((n: { title: string; body: string }) => n.title === "ผู้ดูแลลบประกาศของคุณ" && n.body.includes("ลบตามคำขอของเจ้าของร้าน"))).toBe(true);
    await page.reload();
    await expect(page.locator(".own-item")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
