import { test, expect } from "@playwright/test";

test("opening an amulet image repeatedly keeps the detail, gallery and shop available", async ({ page }, info) => {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (/\/api\/(amulets\/[^/?]+|shops\/[^/?]+|media\/)/.test(response.url()) && response.status() >= 400)
      failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  const response = await page.request.get("/api/amulets?limit=48");
  expect(response.status()).toBe(200);
  const catalog = await response.json();
  const listing = catalog.items.find((a: { images: unknown[] }) => a.images.length > 0);
  expect(listing).toBeDefined();
  for (let visit = 0; visit < 3; visit++) {
    await page.goto(`/catalog?q=${encodeURIComponent(listing.title)}`);
    await page.locator(".amulet-card").getByRole("link", { name: `ดู ${listing.title}`, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/amulet/${listing.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: listing.title, exact: true })).toBeVisible();
    const image = page.locator(".detail-image img");
    for (let i = 0; i < Math.min(3, listing.images.length); i++) {
      await page.getByRole("button", { name: `ดูภาพที่ ${i + 1}`, exact: true }).click();
      await expect(image).toHaveAttribute("src", `/api/media/${listing.images[i].uploadId}`);
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
    await page.locator(".seller-heading").click();
    await expect(page).toHaveURL(new RegExp(`/shop/${listing.shop.slug}$`));
    await expect(page.locator(".shop-profile h1")).toHaveText(listing.shop.name);
  }
  await page.goto(`/amulet/${listing.id}`);
  await expect(page.getByRole("heading", { level: 1, name: listing.title, exact: true })).toBeVisible();
  await expect.poll(() => page.locator(".detail-image img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(failures).toEqual([]);
  await page.screenshot({ path: `output/playwright/repeat-detail-${info.project.name}.png`, fullPage: true });
});
