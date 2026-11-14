import Link from "next/link";
import { FlaskConical, PartyPopper } from "lucide-react";
import { FilterPanel } from "@/components/search/filter-panel";
import { SearchBox } from "@/components/search/search-box";
import { StatsBar } from "@/components/search/stats-bar";
import { Toolbar } from "@/components/search/toolbar";
import { Workspace } from "@/components/search/workspace";
import { filterFromParams } from "@/domain/filters";
import { updateInfo } from "@/server/dashboard";
import { favoriteIds } from "@/server/favorites";
import { facets, searchProperties } from "@/server/search";
import { requireAuth } from "@/auth/session";
import { redirect } from "next/navigation";
import { currentMode } from "@/server/mode";

export const metadata = { title: "Buscar imóveis" };

function toParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v != null ? [v] : []) p.append(k, x);
  return p;
}

export default async function SearchPage({ searchParams }: PageProps<"/">) {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const sp = await searchParams;
  const params = toParams(sp);
  // A search URL without "modo" follows the remembered mode (cookie), made explicit in the URL so
  // the filters on the client read the same mode as the server.
  if (!params.has("modo") && (await currentMode()) === "compra") {
    params.set("modo", "compra");
    redirect(`/?${params.toString()}`);
  }
  const filter = filterFromParams(params);
  const page = Math.max(1, Math.min(500, Number(params.get("pagina")) || 1));
  const [{ items, stats, pages }, fac, update] = await Promise.all([searchProperties(filter, page), facets(filter.modo), updateInfo()]);
  const fav = await favoriteIds(items.map((i) => i.id));
  const welcome = params.get("bem-vindo") === "1";
  const demo = items.some((i) => i.isDemo) || fac.fontes.some((k) => k.startsWith("demo"));
  const empty = stats.total === 0 && fac.bairros.length === 0;

  return (
    <div className="flex">
      <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[300px] shrink-0 overflow-y-auto border-r bg-card px-4 pt-3 pb-10 xl:block" aria-label="Filtros">
        <FilterPanel facets={fac} />
      </aside>
      <div className="min-w-0 flex-1">
        <div className="space-y-3 border-b bg-gradient-to-b from-accent/50 to-background px-4 pt-4 pb-3 lg:px-6">
          {welcome && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-card p-3 text-sm">
              <PartyPopper className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                Senha criada. Para começar, conecte um feed autorizado de imobiliária, envie uma planilha ou carregue os dados de demonstração em{" "}
                <Link href="/admin" className="font-medium text-primary hover:underline">
                  Administração
                </Link>
                .
              </p>
            </div>
          )}
          {demo && params.get("vista") !== "mapa" && (
            <div className="flex items-start gap-2 rounded-xl border border-demo/30 bg-demo/8 px-3 py-2 text-xs text-foreground/80">
              <FlaskConical className="mt-px size-3.5 shrink-0 text-demo" />
              <p>
                Há <strong>dados de demonstração</strong> nesta base: são anúncios fictícios, marcados com o selo &ldquo;Demonstração&rdquo;, só para mostrar a interface. Remova-os em{" "}
                <Link href="/admin" className="font-medium text-demo hover:underline">
                  Administração
                </Link>{" "}
                quando conectar fontes reais.
              </p>
            </div>
          )}
          <SearchBox bairros={fac.bairros} regionais={fac.regionais} />
          <StatsBar stats={stats} update={update} mode={filter.modo} className={params.get("vista") === "mapa" ? "max-md:hidden" : undefined} />
          <Toolbar total={stats.total} facets={fac} />
        </div>
        {empty ? (
          <div className="mx-auto max-w-xl px-4 py-16 text-center">
            <p className="text-lg font-semibold">Ainda não há imóveis na base</p>
            <p className="mt-2 text-sm text-muted-foreground">
              O Radar só mostra anúncios de fontes autorizadas: feeds VRSync de imobiliárias, planilhas e cadastros manuais. Os grandes portais não permitem coleta automática (detalhes em Administração → Fontes).
            </p>
            <Link href="/admin" className="mt-5 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Conectar fontes
            </Link>
          </div>
        ) : (
          <Workspace items={items} favorites={[...fav]} total={stats.total} pages={pages} />
        )}
      </div>
    </div>
  );
}
