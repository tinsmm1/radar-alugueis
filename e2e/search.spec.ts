import { expect, test } from "@playwright/test";

test("dashboard: totals, combined filters in the URL, demo flagged, list and map views", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("imóveis encontrados")).toBeVisible();
  await expect(page.getByText("Novos em 24 h", { exact: false })).toBeVisible();
  await expect(page.getByText("Demonstração").first()).toBeVisible();
  // Several combined filters (criterion 1): bairro + bedrooms + total cost + feature.
  await page.goto("/?bairros=Bairro%20Teste%2008&quartosMin=2&totalMax=4000&caracteristicas=elevador&fontes=planilha");
  await expect(page.getByText("1 imóvel encontrado").or(page.getByText("1 imóveis encontrados"))).toBeVisible();
  const card = page.locator("article", { hasText: "Apartamento real de teste" });
  await expect(card).toBeVisible();
  // Known monthly cost (criterion 2): 2.800 + 600 + 1.200/12 = 3.500.
  await expect(card).toContainText("R$ 3.500");
  await expect(card).toContainText("IPTU R$ 100/mês");
  // Map view renders the MapLibre canvas (criterion 3).
  await page.goto("/?vista=mapa");
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
});

test("risk layers can be fetched for the map and unknown layers are refused", async ({ page }) => {
  // Same-origin fetch from the signed-in page (the session cookie is Secure in production).
  await page.goto("/");
  const get = (path: string) => page.evaluate(async (p) => { const r = await fetch(p); return { status: r.status, body: r.ok ? await r.json() : null }; }, path);
  const ok = await get("/api/camadas/sgb_inundacao");
  expect(ok.status).toBe(200);
  expect(ok.body.type).toBe("FeatureCollection");
  expect(ok.body.features.length).toBeGreaterThan(0);
  expect((await get("/api/camadas/nao-existe")).status).toBe(404);
  expect((await get("/api/camadas/sgb_inundacao?bbox=1,2,3")).status).toBe(400);
});

test("anonymous visitors get 401 from the data APIs and the login page", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  for (const path of ["/api/mapa", "/api/camadas/sgb_inundacao", "/api/geocode?q=savassi", "/api/export?tipo=json"]) {
    expect((await page.request.get(path)).status(), path).toBe(401);
  }
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  expect((await page.request.get("/api/health")).status()).toBe(200);
  await ctx.close();
});
