"use client";
import { Building2, CircleDollarSign, ListFilter, MapPinned, Sparkles, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activeCount, type Filter } from "@/domain/filters";
import { FEATURE_LABEL, FEATURES, PROPERTY_TYPES, TYPE_LABEL } from "@/domain/listing";
import { ChoiceChips, Chip, Field, MinCount, RangeInput, Section, SwitchRow } from "./fields";
import { BairroPicker, DistancePicker, RegionalChips, type Facet } from "./location-pickers";
import { useFilterNav } from "./use-filter-nav";

export type Facets = { bairros: Facet[]; regionais: Facet[]; fontes: string[] };

const SOURCE_NAME: Record<string, string> = { demo: "Demonstração A", "demo-b": "Demonstração B", planilha: "Planilhas", manual: "Cadastro manual" };

function counts(f: Filter) {
  const n = (...v: unknown[]) => v.filter((x) => (Array.isArray(x) ? x.length > 0 : x != null && x !== false && x !== "")).length;
  return {
    fin: n(f.aluguelMin, f.aluguelMax, f.condoMin, f.condoMax, f.iptuMin, f.iptuMax, f.totalMin, f.totalMax, f.m2Max, f.custoCompleto, f.precoMin, f.precoMax, f.precoM2Max, f.rendimentoMin),
    loc: n(f.bairros, f.regionais, f.perto, f.bbox),
    fis: n(f.tipos, f.areaMin, f.areaMax, f.quartosMin, f.quartosMax, f.suitesMin, f.banheirosMin, f.vagasMin),
    car: f.caracteristicas.length,
    add: n(f.recentesDias, f.atualizadosDias, f.reducao, f.anunciante, f.localizacao, f.riscoMax, f.notaMin, f.semInundacao, f.oportunidades, f.favoritos, f.incluirIndisponiveis, f.fontes),
  };
}

/** Every filter of the product, grouped; changes go straight to the URL (and the results). */
export function FilterPanel({ facets, inSheet }: { facets: Facets; inSheet?: boolean }) {
  const { filter: f, update, toggle, clear, pending } = useFilterNav();
  const c = counts(f);
  const total = activeCount(f) + (f.bbox ? 1 : 0);
  return (
    <div className="text-sm" aria-busy={pending}>
      <div className="flex items-center justify-between pb-1">
        <p className={inSheet ? "text-xs text-muted-foreground" : "flex items-center gap-2 font-semibold"}>
          {inSheet ? (
            `${total} critério${total === 1 ? "" : "s"} ativo${total === 1 ? "" : "s"}`
          ) : (
            <>
              <SlidersHorizontal className="size-4 text-primary" /> Filtros
              {total > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 text-primary-foreground">{total}</span>}
            </>
          )}
        </p>
        {total > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} className="h-7 px-2 text-xs text-muted-foreground">
            Limpar tudo
          </Button>
        )}
      </div>

      <Section title="Financeiro" icon={<CircleDollarSign className="size-4" />} active={c.fin}>
        {f.modo === "compra" ? <BuyFinance /> : <RentFinance />}
      </Section>

      <Section title="Localização" icon={<MapPinned className="size-4" />} active={c.loc}>
        <Field label="Bairros" hint="Também dá para escolher bairros clicando no mapa (Camadas → Selecionar bairros).">
          <BairroPicker options={facets.bairros} selected={f.bairros} onToggle={(b) => toggle("bairros", b)} onClear={() => update({ bairros: [] })} />
        </Field>
        <Field label="Regional">
          <RegionalChips options={facets.regionais} selected={f.regionais} onToggle={(r) => toggle("regionais", r)} />
        </Field>
        <Field label="Distância de um endereço">
          <DistancePicker perto={f.perto} pertoNome={f.pertoNome} raioKm={f.raioKm} onChange={(v) => update(v)} />
        </Field>
        {f.bbox && (
          <div className="flex items-center justify-between rounded-lg border bg-accent/50 px-2.5 py-1.5 text-xs">
            <span>Somente a área visível do mapa</span>
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => update({ bbox: undefined })}>
              remover
            </button>
          </div>
        )}
      </Section>

      <Section title="Imóvel" icon={<Building2 className="size-4" />} active={c.fis}>
        <Field label="Tipo">
          <div className="flex flex-wrap gap-1.5">
            {PROPERTY_TYPES.map((t) => (
              <Chip key={t} on={f.tipos.includes(t)} onClick={() => toggle("tipos", t)}>
                {TYPE_LABEL[t]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Área privativa (m²)">
          <RangeInput idPrefix="area" suffix="m²" min={f.areaMin} max={f.areaMax} onChange={(a, b) => update({ areaMin: a, areaMax: b })} />
        </Field>
        <Field label="Quartos">
          <div className="space-y-2">
            <MinCount value={f.quartosMin} onChange={(v) => update({ quartosMin: v })} />
            <ChoiceChips value={f.quartosMax} options={[[1, "até 1"], [2, "até 2"], [3, "até 3"]]} onChange={(v) => update({ quartosMax: v })} />
          </div>
        </Field>
        <Field label="Suítes">
          <MinCount value={f.suitesMin} onChange={(v) => update({ suitesMin: v })} />
        </Field>
        <Field label="Banheiros">
          <MinCount value={f.banheirosMin} onChange={(v) => update({ banheirosMin: v })} />
        </Field>
        <Field label="Vagas de garagem">
          <MinCount value={f.vagasMin} onChange={(v) => update({ vagasMin: v })} />
        </Field>
      </Section>

      <Section title="Características" icon={<Sparkles className="size-4" />} active={c.car} defaultOpen={false}>
        <p className="text-[11px] text-muted-foreground">Mostra imóveis com todas as selecionadas.</p>
        <div className="flex flex-wrap gap-1.5">
          {FEATURES.map((k) => (
            <Chip key={k} on={f.caracteristicas.includes(k)} onClick={() => toggle("caracteristicas", k)}>
              {FEATURE_LABEL[k]}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Mais filtros" icon={<ListFilter className="size-4" />} active={c.add} defaultOpen={false}>
        <Field label="Anunciados recentemente">
          <ChoiceChips value={f.recentesDias} options={[[1, "24 h"], [3, "3 dias"], [7, "7 dias"], [30, "30 dias"]]} onChange={(v) => update({ recentesDias: v })} />
        </Field>
        <Field label="Anúncio atualizado">
          <ChoiceChips value={f.atualizadosDias} options={[[1, "24 h"], [3, "3 dias"], [7, "7 dias"]]} onChange={(v) => update({ atualizadosDias: v })} />
        </Field>
        <Field label="Anunciante">
          <ChoiceChips value={f.anunciante} options={[["proprietario", "Direto com proprietário"], ["imobiliaria", "Imobiliárias"]]} onChange={(v) => update({ anunciante: v })} />
        </Field>
        <Field label="Localização do imóvel">
          <ChoiceChips value={f.localizacao} options={[["confirmada", "Endereço confirmado"], ["aproximada", "Aproximada"]]} onChange={(v) => update({ localizacao: v })} />
        </Field>
        <Field label="Índice de risco da localização (máximo)" hint="Resumo das bases consultadas; não substitui avaliação técnica.">
          <ChoiceChips value={f.riscoMax} options={[["baixo", "Baixo"], ["moderado", "Até moderado"], ["atencao", "Até atenção"]]} onChange={(v) => update({ riscoMax: v })} />
        </Field>
        <Field label="Avaliação do Radar (mínima)" hint="Nota que compara preço, risco, serviços e dados com imóveis parecidos.">
          <ChoiceChips value={f.notaMin} options={[["A", "A · Excelente"], ["B", "B ou melhor"], ["C", "C ou melhor"]]} onChange={(v) => update({ notaMin: v })} />
        </Field>
        <SwitchRow id="sem-inundacao" label="Fora de suscetibilidade a inundação" hint="Segundo a carta do SGB/IPT. Só imóveis já analisados." checked={f.semInundacao} onChange={(v) => update({ semInundacao: v })} />
        <SwitchRow id="reducao" label="Com redução de preço" hint="Reduções nos últimos 60 dias." checked={f.reducao} onChange={(v) => update({ reducao: v })} />
        <SwitchRow id="oportunidades" label="Só oportunidades" hint="Redução, abaixo dos comparáveis ou recém-publicado." checked={f.oportunidades} onChange={(v) => update({ oportunidades: v })} />
        <SwitchRow id="favoritos" label="Só favoritos" checked={f.favoritos} onChange={(v) => update({ favoritos: v })} />
        <SwitchRow id="indisponiveis" label="Incluir indisponíveis" hint="Anúncios que saíram das fontes." checked={f.incluirIndisponiveis} onChange={(v) => update({ incluirIndisponiveis: v })} />
        {facets.fontes.length > 0 && (
          <Field label="Fontes">
            <div className="flex flex-wrap gap-1.5">
              {facets.fontes.map((k) => (
                <Chip key={k} on={f.fontes.includes(k)} onClick={() => toggle("fontes", k)}>
                  {SOURCE_NAME[k] ?? k.replace(/^feed-/, "").replace(/-/g, " ")}
                </Chip>
              ))}
            </div>
          </Field>
        )}
      </Section>
    </div>
  );
}

/** Rent mode: rent, condo, IPTU, known monthly total, total per m². */
function RentFinance() {
  const { filter: f, update } = useFilterNav();
  return (
    <>
      <Field label="Aluguel (R$/mês)">
        <RangeInput idPrefix="aluguel" prefix="R$" min={f.aluguelMin} max={f.aluguelMax} onChange={(a, b) => update({ aluguelMin: a, aluguelMax: b })} />
      </Field>
      <Field label="Condomínio (R$/mês)">
        <RangeInput idPrefix="condo" prefix="R$" min={f.condoMin} max={f.condoMax} onChange={(a, b) => update({ condoMin: a, condoMax: b })} />
      </Field>
      <Field label="IPTU (R$/mês)" hint="IPTU anual é dividido por 12.">
        <RangeInput idPrefix="iptu" prefix="R$" min={f.iptuMin} max={f.iptuMax} onChange={(a, b) => update({ iptuMin: a, iptuMax: b })} />
      </Field>
      <Field label="Custo mensal total (R$)" hint="Aluguel + condomínio + IPTU/mês + taxas conhecidas.">
        <RangeInput idPrefix="total" prefix="R$" min={f.totalMin} max={f.totalMax} onChange={(a, b) => update({ totalMin: a, totalMax: b })} />
      </Field>
      <Field label="Custo total por m² (máximo)">
        <RangeInput idPrefix="m2" prefix="R$" single="max" max={f.m2Max} onChange={(_a, b) => update({ m2Max: b })} />
      </Field>
      <SwitchRow id="custo-completo" label="Só custo completo" hint="Esconde anúncios sem condomínio ou IPTU informado." checked={f.custoCompleto} onChange={(v) => update({ custoCompleto: v })} />
    </>
  );
}

/** Buy mode: asking price, price per m², estimated gross yield, condo and IPTU. */
function BuyFinance() {
  const { filter: f, update } = useFilterNav();
  return (
    <>
      <Field label="Preço de venda (R$)">
        <RangeInput idPrefix="preco" prefix="R$" min={f.precoMin} max={f.precoMax} onChange={(a, b) => update({ precoMin: a, precoMax: b })} />
      </Field>
      <Field label="Preço por m² (máximo)">
        <RangeInput idPrefix="precom2" prefix="R$" single="max" max={f.precoM2Max} onChange={(_a, b) => update({ precoM2Max: b })} />
      </Field>
      <Field label="Rendimento bruto mínimo (% ao ano)" hint="Aluguel estimado × 12 ÷ preço. O aluguel vem da mediana por m² de imóveis comparáveis para alugar.">
        <RangeInput idPrefix="rend" suffix="% a.a." single="min" min={f.rendimentoMin} step={0.1} onChange={(a) => update({ rendimentoMin: a })} />
      </Field>
      <Field label="Condomínio (R$/mês)">
        <RangeInput idPrefix="condo" prefix="R$" min={f.condoMin} max={f.condoMax} onChange={(a, b) => update({ condoMin: a, condoMax: b })} />
      </Field>
      <Field label="IPTU (R$/mês)" hint="IPTU anual é dividido por 12.">
        <RangeInput idPrefix="iptu" prefix="R$" min={f.iptuMin} max={f.iptuMax} onChange={(a, b) => update({ iptuMin: a, iptuMax: b })} />
      </Field>
      <SwitchRow id="custo-completo" label="Condomínio e IPTU informados" hint="Esconde anúncios sem esses custos de manutenção." checked={f.custoCompleto} onChange={(v) => update({ custoCompleto: v })} />
    </>
  );
}
