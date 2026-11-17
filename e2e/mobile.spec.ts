import { expect, test } from "@playwright/test";

test("phone: no sideways scroll on the main screens and filters open in a sheet", async ({ page }) => {
  for (const path of ["/", "/?vista=mapa", "/guia", "/oportunidades", "/bairros", "/comparar", "/favoritos", "/admin", "/admin/fontes", "/admin/perfil"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await page.goto("/");
  await page.getByRole("button", { name: /Filtros/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
