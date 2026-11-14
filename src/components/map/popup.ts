import { brl } from "@/domain/money";
import { INDEX_LABEL, type RiskIndex } from "@/domain/risk";
import type { MapPoint } from "@/server/search";

/** What the list already knows about a property (richer popup when it is on the current page). */
export type MiniCard = { title: string; neighborhood: string | null; photo: string | null };

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

/** Popup DOM built with textContent only (listing text is untrusted). */
export function popupContent(p: MapPoint, card?: MiniCard): HTMLElement {
  const root = node("div", "w-60 overflow-hidden rounded-xl text-[13px] text-foreground");
  if (card?.photo) {
    const img = node("img", "h-28 w-full object-cover");
    img.src = card.photo;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    root.append(img);
  }
  const body = node("div", "space-y-1 p-3");
  body.append(node("p", "text-base font-semibold", `${brl(p.totalCents ?? p.rentCents)}/mês`));
  if (p.totalCents != null && p.rentCents != null && p.totalCents !== p.rentCents) body.append(node("p", "text-xs text-muted-foreground", `Aluguel ${brl(p.rentCents)}`));
  if (card) {
    body.append(node("p", "line-clamp-2 font-medium", card.title));
    if (card.neighborhood) body.append(node("p", "text-xs text-muted-foreground", card.neighborhood));
  }
  const tags = node("div", "flex flex-wrap gap-1 pt-1");
  tags.append(node("span", "rounded-full bg-muted px-2 py-0.5 text-[11px]", p.risk ? `Risco: ${INDEX_LABEL[p.risk as RiskIndex["level"]] ?? p.risk}` : "Risco: sem análise"));
  if (p.precision !== "exata") tags.append(node("span", "rounded-full bg-muted px-2 py-0.5 text-[11px]", "Local aproximado"));
  if (p.demo) tags.append(node("span", "rounded-full bg-demo/15 px-2 py-0.5 text-[11px] text-demo", "Demonstração (fictício)"));
  body.append(tags);
  const link = node("a", "mt-2 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90", "Ver imóvel");
  link.href = `/imovel/${p.id}`;
  body.append(link);
  root.append(body);
  return root;
}
