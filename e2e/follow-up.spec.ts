import { expect, test } from "@playwright/test";

test("evaluation, price target, follow-up on favourites and notifications", async ({ page }) => {
  await page.goto("/?fontes=planilha&modo=aluguel");
  await page.locator("article", { hasText: "Apartamento real de teste" }).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/imovel\/\d+\?modo=aluguel/);
  // Critical evaluation with its parts and an honest note.
  const evaluation = page.locator("#avaliacao");
  await expect(evaluation).toContainText("Pontos fortes");
  await expect(evaluation).toContainText("Pontos de atenção");
  await expect(evaluation).toContainText("Preço frente a parecidos");
  await expect(evaluation).toContainText("Não é avaliação imobiliária");
  // A target above the current price is reached at once.
  await page.getByLabel(/Preço-alvo do custo mensal/).fill("99000");
  await page.getByRole("button", { name: "Acompanhar" }).click();
  await expect(page.getByText("O preço já está no seu alvo")).toBeVisible();
  await expect(page.getByText(/Alvo atual: R\$\s?99\.000/)).toBeVisible();
  // Links to the other tools keep the mode.
  await expect(page.getByRole("link", { name: /Imóveis parecidos até 10% mais caros/ })).toHaveAttribute("href", /modo=aluguel/);
  await page.goto("/favoritos");
  await expect(page.getByText("Preços que você acompanha (1)")).toBeVisible();
  await page.goto("/notificacoes");
  await expect(page.getByText("Preço-alvo atingido").first()).toBeVisible();
  await expect(page.getByText(/seu alvo: R\$\s?99\.000/).first()).toBeVisible();
});

test("best places and offers, best-evaluated opportunities saved as an alert", async ({ page }) => {
  await page.goto("/bairros?modo=aluguel");
  await expect(page.getByText("Melhores locais")).toBeVisible();
  await expect(page.getByText("Melhores ofertas para alugar")).toBeVisible();
  await page.goto("/oportunidades?modo=compra");
  await expect(page.getByRole("link", { name: /Melhores avaliados/ })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Criar alerta para esta categoria" }).click();
  await expect(page.getByRole("dialog")).toContainText("avaliação B ou melhor");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Busca salva")).toBeVisible();
  await page.goto("/buscas");
  await expect(page.getByText(/Comprar · avaliação B ou melhor/).first()).toBeVisible();
});

test("the search follows the remembered mode and sorts by evaluation", async ({ page }) => {
  await page.goto("/?modo=compra");
  // The mode is remembered once the page has hydrated (cookie written by the mode switch).
  await expect(page.locator("html")).toHaveAttribute("data-mode", "compra");
  await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === "radar_modo")?.value).toBe("compra");
  await page.goto("/");
  await expect(page).toHaveURL(/modo=compra/);
  await page.goto("/?modo=compra&ordem=melhor_avaliacao");
  await expect(page.locator("article").first()).toContainText(/[A-E]·\s?\d+/);
  await page.goto("/?modo=aluguel");
});
