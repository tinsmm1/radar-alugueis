import { expect, test } from "@playwright/test";

test("property page: source link, cost breakdown, history, location analysis; favourite and compare", async ({ page }) => {
  await page.goto("/?fontes=planilha");
  await page.locator("article", { hasText: "Apartamento real de teste" }).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/imovel\/\d+/);
  await expect(page.getByRole("heading", { name: /Apartamento real de teste/ })).toBeVisible();
  // Source and original link (criterion 5).
  await expect(page.locator('a[href="https://example.com/anuncio/e2e-1"]').first()).toBeVisible();
  await expect(page.getByText("Custo mensal total conhecido")).toBeVisible();
  await expect(page.getByText("Histórico de preços")).toBeVisible();
  // Location analysis with measured facts and sources (no invented data).
  const analysis = page.locator("#analise");
  await expect(analysis).toContainText("Estação Teste");
  await expect(analysis).toContainText("Fonte");
  await expect(analysis).toContainText("ausência de registro");
  await page.getByRole("button", { name: "Favoritar" }).first().click();
  await expect(page.getByText("Salvo em Favoritos")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar ao comparador" }).first().click();
  await page.goto("/favoritos");
  await expect(page.locator("article", { hasText: "Apartamento real de teste" })).toBeVisible();
  await page.goto("/comparar");
  await expect(page.getByText("Apartamento real de teste").first()).toBeVisible();
});

test("opportunities, neighbourhoods and notifications pages load with data", async ({ page }) => {
  await page.goto("/oportunidades");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/bairros");
  await expect(page.getByText("Bairro Teste", { exact: false }).first()).toBeVisible();
  await page.goto("/notificacoes");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
