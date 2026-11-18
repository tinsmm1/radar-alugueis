import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const HOUSE_TYPES = new Set(["casa", "casa_condominio"]);

/**
 * EV charging is the owner's top priority but rarely appears in listings. The panel states what
 * the listing says; without a mention it gives the likely path, never a promise.
 */
export function EvChargerPanel({ features, type, parking }: { features: readonly string[]; type: string | null; parking: number | null }) {
  const charger = features.includes("carregador_eletrico");
  const prepared = features.includes("preparo_carregador");
  const stated = charger || prepared;
  const house = type != null && HOUSE_TYPES.has(type);
  const text = charger
    ? "O anúncio informa carregador de carro elétrico. Confirme com o anunciante se ele fica na vaga do imóvel, a potência e quem paga a energia."
    : prepared
      ? "O anúncio informa preparo para carregador de carro elétrico (infraestrutura ou previsão). Confirme o que já está instalado e o que falta."
      : house && (parking ?? 0) > 0
        ? "O anúncio não fala em carregador. Casa com garagem própria costuma permitir a instalação, mas depende da rede elétrica do imóvel: peça uma avaliação a um eletricista antes de fechar."
        : house
          ? "O anúncio não fala em carregador nem informa vaga de garagem. Pergunte ao anunciante onde o carro fica e se há ponto de energia por perto."
          : "O anúncio não fala em carregador. Em apartamento, a instalação na vaga depende do condomínio e da capacidade elétrica do prédio: pergunte ao anunciante se o condomínio já tem carregador ou regras para instalar.";
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4 text-sm", stated ? "border-amber-400 bg-amber-50 text-amber-950 ring-2 ring-amber-400/40 dark:bg-amber-950/30 dark:text-amber-100" : "bg-muted/40")}>
      <Zap className={cn("mt-0.5 size-5 shrink-0", stated ? "fill-amber-400 text-amber-600" : "text-muted-foreground")} />
      <div className="space-y-1">
        <p className="font-semibold">{charger ? "Tem carregador de carro elétrico" : prepared ? "Preparado para carregador de carro elétrico" : "Carregador de carro elétrico: não informado"}</p>
        <p className={stated ? "" : "text-muted-foreground"}>{text}</p>
      </div>
    </div>
  );
}
