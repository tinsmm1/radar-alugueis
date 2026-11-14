import { CsvUpload } from "@/components/admin/csv-upload";
import { ManualForm } from "@/components/admin/manual-form";
import { Section } from "@/components/admin/ui";
import { CSV_COLUMNS } from "@/domain/csv";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Importar" };

export default async function ImportPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  return (
    <>
      <Section
        title="Planilha de anúncios (CSV)"
        description="Para listas recebidas de imobiliárias ou montadas por você. Separador “;” ou “,”, uma linha por anúncio. Importar de novo atualiza os anúncios com o mesmo id e registra mudanças de preço."
      >
        <CsvUpload />
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-primary">Colunas do modelo</summary>
          <p className="mt-2 text-muted-foreground">
            {CSV_COLUMNS.join(" · ")}. Obrigatórias: <b>aluguel</b> e <b>bairro</b>. <i>iptu_periodo</i>: “mensal” ou “anual”. <i>caracteristicas</i>: separadas por “|” (ex.: elevador|piscina). <i>anunciante</i>: “imobiliaria” ou “proprietario”. <i>fotos</i>: links separados por “|”. Só imóveis de Belo Horizonte são aceitos.
          </p>
        </details>
      </Section>
      <Section
        title="Cadastro manual"
        description="Encontrou um imóvel num portal ou numa placa? Cadastre os dados e o link original: ele ganha custo real, análise da localização e entra na deduplicação."
      >
        <ManualForm />
      </Section>
    </>
  );
}
