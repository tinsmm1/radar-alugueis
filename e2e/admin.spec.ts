import { expect, test } from "@playwright/test";

test("sources: portals pending with their assessment; CSV import appears in the search", async ({ page }) => {
  await page.goto("/admin/fontes");
  await expect(page.getByText("QuintoAndar").first()).toBeVisible();
  await expect(page.getByText("Bloqueado pelos termos").first()).toBeVisible();
  await expect(page.getByText("Pendente").first()).toBeVisible();
  await page.goto("/admin/importar");
  const csv = "id;link;titulo;tipo;aluguel;condominio;iptu;iptu_periodo;outras_taxas;area_m2;quartos;suites;banheiros;vagas;caracteristicas;anunciante;anunciante_nome;fotos;rua;numero;bairro;cidade;cep;latitude;longitude;descricao\n" +
    "csv-1;https://example.com/csv-1;Kitnet importada por planilha;kitnet;1.300;250;;;;30;1;0;1;0;mobiliado;proprietario;;;Rua Planilha;10;Bairro Teste 03;Belo Horizonte;;-19.955;-43.94;Teste\n";
  await page.getByLabel("Planilha CSV").setInputFiles({ name: "anuncios.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await page.getByRole("button", { name: /Importar|Enviar/ }).first().click();
  await expect(page.getByText(/1 anúncios? importados?/)).toBeVisible({ timeout: 30_000 });
  await page.goto("/?q=kitnet%20importada");
  const card = page.locator("article", { hasText: "Kitnet importada por planilha" });
  await expect(card).toBeVisible();
  // Condo known, IPTU unknown → partial cost, never zero.
  await expect(card).toContainText("Custo parcial");
  await expect(card).toContainText("IPTU não inf.");
});

test("runs and layers are monitored", async ({ page }) => {
  await page.goto("/admin/camadas");
  await expect(page.getByText("Fixture de teste E2E").first()).toBeVisible();
  await page.goto("/admin/execucoes");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
