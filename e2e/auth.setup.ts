import { expect, test as setup } from "@playwright/test";
import { E2E_PASSWORD } from "../playwright.config";

setup("login with the owner password", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.fill("#password", "senha-errada");
  await page.click("button[type=submit]");
  await expect(page.getByText("Senha incorreta.")).toBeVisible();
  await page.fill("#password", E2E_PASSWORD);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/$/);
  await page.context().storageState({ path: "e2e/.auth.json" });
});
