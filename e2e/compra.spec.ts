import { expect, test, type Locator, type Page } from "@playwright/test";

/** "R$ 1.234.567" → 1234567 (whole reais; the UI rounds to reais). */
const reais = (text: string) => Number(text.replace(/[^\d]/g, ""));
/** "8,33% a.a." → 8.33 */
const pct = (text: string) => Number(text.replace(/\./g, "").replace(",", "."));

/** Yield of a buy-mode card, read from its "Aluguel est. … · X% a.a." line. */
async function cardYield(card: Locator): Promise<number> {
  const line = await card.locator("p", { hasText: "Aluguel est." }).innerText();
  const m = line.match(/([\d.,]+)%\s*a\.a\./);
  expect(m, line).not.toBeNull();
  return pct(m![1]);
}

/** Value cell of a row of the purchase simulator. */
const simValue = (page: Page, label: string) => page.locator("#simulacao div.justify-between", { hasText: label }).locator("span.tabular-nums");

/** Opens the first property in buy mode found through the search UI and returns its id. */
async function openFirstForSale(page: Page, cardFilter?: string): Promise<string> {
  await page.goto("/?modo=compra");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "compra");
  const card = cardFilter ? page.locator("article", { hasText: cardFilter }).first() : page.locator("article").first();
  await card.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/imovel\/\d+/);
  return page.url().match(/\/imovel\/(\d+)/)![1];
}

test("mode switch: header toggles URL, data-mode, stats and filters, and back", async ({ page }) => {
  await page.goto("/");
  const modes = page.getByRole("radiogroup", { name: "Modo do radar" });
  await expect(modes.getByRole("radio", { name: "Alugar" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Aluguel (R$/mês)", { exact: true })).toBeVisible();
  await expect(page.getByText("Aluguel médio", { exact: true })).toBeVisible();

  await modes.getByRole("radio", { name: "Comprar" }).click();
  await expect(page).toHaveURL(/[?&]modo=compra/);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "compra");
  await expect(modes.getByRole("radio", { name: "Comprar" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Preço médio", { exact: true })).toBeVisible();
  await expect(page.getByText("Menor preço", { exact: true }).first()).toBeVisible();
  for (const label of ["Preço de venda (R$)", "Preço por m² (máximo)", "Rendimento bruto mínimo (% ao ano)"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("Aluguel (R$/mês)", { exact: true })).toHaveCount(0);
  expect((await page.context().cookies()).find((c) => c.name === "radar_modo")?.value).toBe("compra");
  // Buy sorts in the sort select.
  await page.getByRole("combobox", { name: "Ordenar por" }).click();
  for (const label of ["Menor preço", "Menor preço por m²", "Maior rendimento estimado"]) {
    await expect(page.getByRole("option", { name: label, exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");

  await modes.getByRole("radio", { name: "Alugar" }).click();
  await expect(page).not.toHaveURL(/modo=compra/);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "aluguel");
  await expect(page.getByText("Aluguel (R$/mês)", { exact: true })).toBeVisible();
  await expect(page.getByText("Custo mensal total (R$)", { exact: true })).toBeVisible();
  await expect(page.getByText("Aluguel médio", { exact: true })).toBeVisible();
  await expect(page.getByText("Preço de venda (R$)", { exact: true })).toHaveCount(0);
});

test("buy search: price cap, minimum yield and highest-yield sort from the URL", async ({ page }) => {
  await page.goto("/?modo=compra&precoMax=1500000&rendimentoMin=5.5&ordem=maior_rendimento");
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  expect(n).toBeGreaterThan(1);
  const yields: number[] = [];
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    // Sale price as the headline, never a monthly rent.
    const headline = await card.locator("p.text-lg").innerText();
    expect(headline).not.toContain("/mês");
    const price = reais(headline);
    expect(price).toBeGreaterThan(0);
    expect(price).toBeLessThanOrEqual(1_500_000);
    const y = await cardYield(card);
    expect(y).toBeGreaterThanOrEqual(5.5);
    yields.push(y);
  }
  expect(yields).toEqual([...yields].sort((a, b) => b - a));
});

test("property buy view: simulator reacts to the down payment and to SAC vs Price", async ({ page }) => {
  await openFirstForSale(page);
  await expect(page.getByText("Preço de venda", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Rendimento bruto estimado", { exact: true })).toBeVisible();
  const sim = page.locator("#simulacao");
  await expect(sim.getByRole("heading", { name: "Simulação de compra" })).toBeVisible();
  await expect(sim.getByText("Comprar ou alugar? (1º mês)")).toBeVisible();
  for (const label of ["Entrada", "Juros do financiamento", "Prazo"]) await expect(sim.getByLabel(label, { exact: true })).toBeVisible();

  const upfront = simValue(page, "Total à vista");
  const beforeText = await upfront.innerText();
  const before = reais(beforeText);
  expect(before).toBeGreaterThan(0);
  await sim.getByLabel("Entrada", { exact: true }).fill("40");
  await expect(upfront).not.toHaveText(beforeText);
  expect(reais(await upfront.innerText())).toBeGreaterThan(before);

  // SAC (default): payments fall, last < first.
  const first = simValue(page, "Primeira parcela");
  const last = simValue(page, "Última parcela");
  expect(reais(await last.innerText())).toBeLessThan(reais(await first.innerText()));
  // Price: equal payments.
  await sim.locator("button", { hasText: /^Price$/ }).click();
  await expect(sim.getByRole("heading", { name: "Financiamento (Price)" })).toBeVisible();
  expect(reais(await last.innerText())).toBe(reais(await first.innerText()));
  await sim.locator("button", { hasText: /^SAC$/ }).click();
  await expect(sim.getByRole("heading", { name: "Financiamento (SAC)" })).toBeVisible();
  expect(reais(await last.innerText())).toBeLessThan(reais(await first.innerText()));
});

test("property offered both ways: tabs switch between sale and rent views", async ({ page }) => {
  const id = await openFirstForSale(page, "Também para alugar");
  const tabs = page.getByRole("tablist", { name: "Ver este imóvel como" });
  await expect(tabs.getByRole("tab", { name: /^Para alugar · / })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /^À venda · / })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#simulacao")).toBeVisible();

  await tabs.getByRole("tab", { name: /^Para alugar · / }).click();
  await expect(page).toHaveURL(new RegExp(`/imovel/${id}`));
  await expect(page.getByText("Custo mensal total conhecido")).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /^Para alugar · / })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#simulacao")).toHaveCount(0);

  await tabs.getByRole("tab", { name: /^À venda · / }).click();
  await expect(page).toHaveURL(new RegExp(`/imovel/${id}\\?modo=compra`));
  await expect(page.locator("#simulacao")).toBeVisible();
});

test("buy mode on opportunities, neighbourhoods and compare", async ({ page }) => {
  await page.goto("/oportunidades?modo=compra");
  await page.getByRole("navigation", { name: "Tipos de oportunidade" }).getByRole("link", { name: /Maior rendimento/ }).click();
  await expect(page).toHaveURL(/tab=rendimento/);
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.getByText(/#1 · [\d.,]+% a\.a\./)).toBeVisible();

  await page.goto("/bairros?modo=compra");
  await expect(page.locator('th[title="Preço por m² (mediana)"]')).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Rend\./ })).toBeVisible();

  const id = await openFirstForSale(page);
  await page.goto(`/comparar?modo=compra&ids=${id}`);
  await expect(page.getByText("Preço de venda", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Rendimento bruto estimado", { exact: true }).first()).toBeVisible();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  test("buy mode: no sideways scroll and buy filters in the sheet", async ({ page }) => {
    await page.goto("/?modo=compra");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: /Filtros/ }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Preço de venda (R$)", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Rendimento bruto mínimo (% ao ano)", { exact: true })).toBeVisible();
  });
});
