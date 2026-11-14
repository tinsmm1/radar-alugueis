# Design

## Direction

A modern SaaS search product rather than an admin dashboard: light background, white cards with subtle borders, one product colour per mode (blue for Alugar, green-teal for Comprar), generous map area, and dense but calm information. Search and comparison come first; administration stays behind the gear icon.

## Tokens (`src/app/globals.css`)

| Token | Use |
|---|---|
| `--primary` (blue, oklch 0.546 0.215 263 ≈ #2563eb) | actions, selection, clusters, links (rent mode) |
| `--primary`, `--ring`, `--accent`, `--chart-1` under `[data-mode="compra"]` (green-teal, hue 168: primary oklch 0.53 0.13 168) | the same roles in buy mode; only the hue changes, the rest of the system is shared |
| `--background` (cool off-white) / `--card` (white) | page / surfaces |
| `--muted`, `--accent`, `--border` | secondary text, hover/selected nav, hairlines |
| `--risk-low`, `--risk-moderate`, `--risk-attention`, `--risk-high` | location risk index and analysis items (green → amber → orange → red) |
| `--positive`, `--opportunity` | services nearby, price drops, opportunity signals |
| `--demo` (violet) | the "Demonstração" badge and banners: demo data is always visibly different |

Typography: Geist (sans) via `next/font`. Radius 0.75 rem. shadcn/ui (radix, "nova" preset) provides the primitives in `src/components/ui/`.

## Modes

- **Switch:** `components/shell/mode-switch.tsx` renders "Alugar | Comprar" (key and building icons) as a `radiogroup` next to the logo in the top bar, on every screen size. Choosing a mode navigates to the same page with `modo=compra` (or without `modo` for rent), dropping the other mode's financial filters, sort and page number (`withMode` in `src/lib/mode.ts`), and stores the choice in the `radar_modo` cookie.
- **Accent:** the `(app)` layout sets `data-mode` on its wrapper from the server-side mode, and the switch also sets it on `<html>` so dialogs, sheets and popovers rendered in portals follow it. The `html[data-mode="compra"], div[data-mode="compra"]` rule in `globals.css` overrides the accent tokens; risk, opportunity, positive and demo colours do not change.
- **Navigation:** in buy mode the links to Buscar, Oportunidades, Bairros and Comparar carry `?modo=compra`; Favoritos, Buscas salvas, Notificações and Administração are shared.
- **What changes per mode:**

| Surface | Alugar | Comprar |
|---|---|---|
| Card (`PropertyCardView`) | Known monthly total with "/mês" and cost per m²; rent, condo and IPTU line; `CostStatusBadge` | Asking price and price per m²; condo and IPTU line, plus estimated rent and gross yield ("% a.a.") when known; no cost-status badge |
| Card badges | Rent drop, rent opportunity signals, "Também à venda" when offered both ways | Sale drop, sale opportunity signals (including "Alto rendimento"), "Também para alugar" |
| Filter panel | Rent, condo, IPTU, monthly total, cost per m², "custo completo" | Asking price, price per m² (max), minimum gross yield, condo, IPTU, "condomínio e IPTU informados" |
| Stats bar | Average rent, lowest rent (hint: lowest total) | Average price (hint: median price per m²), lowest price (hint: average yield) |
| Sorts | Total, rent, cost per m² | Price, price per m², estimated yield |
| Map pins | Monthly total | Asking price (compact, e.g. "R$ 450 mil") |
| Property page | Cost breakdown in the sidebar | `PurchasePanel` in the sidebar (price, price per m², condo, IPTU, estimated rent, gross yield, and the comparables behind the estimate) and a "Simulação de compra" section (`FinancingSimulator`); price history charts the asking price |
| Oportunidades | Abaixo dos comparáveis, Preço reduzido, Recém-publicados, Menor custo por m² | Abaixo dos comparáveis, Maior rendimento, Preço reduzido, Recém-publicados, Menor preço por m² |
| Bairros | Median rent, total and cost per m²; share with partial cost | Median price, price per m² and gross yield; share without condo or IPTU |
| Comparar | Monthly total, rent, cost per m² | Asking price, price per m², estimated rent, gross yield |

A card or property page always shows a deal the property actually offers: in buy mode a rent-only property shows its rent view, and vice versa. A property offered both ways has a "Para alugar · … / À venda · …" tab on its page.

- **Honesty in buy mode:** the simulator shows its editable assumptions (down payment, interest, term, ITBI, registry, return on cash, upkeep) and a SAC / Price toggle, and ends with `ASSUMPTION_NOTE` ("Simulação com suposições editáveis … Não é proposta de banco nem cálculo oficial de impostos."). The purchase panel says the estimated rent is the median of N comparables of a named scope and "uma referência de mercado, não uma avaliação"; without comparables it shows "Sem comparáveis". The yield filter and tab explain that the yield is gross.

## Shared components

- `components/shell/`: logo (radar rings around a house), top navigation (desktop) and bottom bar (phone), bell with unread count, admin gear.
- `components/property/`: `PropertyCardView` (takes `mode`; photo, price block of the mode as above, title, neighbourhood and regional, area/rooms/bathrooms/parking, features, badges, sources, last check), badges (`RiskBadge`, `DemoBadge`, `CostStatusBadge`, `DropBadge`, `OpportunityBadges`, `PrecisionBadge`, `SourceBadges`), `FavoriteButton`, `CompareButton`.
- `components/search/`, `components/map/`: filter panel (5 groups, URL state, financial group per mode), stats bar, list/split/map views, MapLibre map.
- `components/detail/` (including `purchase-panel.tsx` and `financing-simulator.tsx`), `compare/`, `neighborhoods/`, `charts/`, `admin/`, `personal/`: page-specific pieces.

## Map

- Base: OpenFreeMap "positron" (light, low-contrast streets so data stands out), OSM attribution always visible.
- Properties: GeoJSON source with clustering; price pills drawn on canvas (monthly total when renting, asking price when buying). The pill border is the risk level, a dashed border marks an approximate location, a violet fill marks demo data.
- Overlays: susceptibility by class (darker = higher; the low classes, which cover most of the city, are nearly transparent so the medium and high classes read clearly), waterways (open solid, canalized dashed), main roads, railway, metro/BRT, services, parks, regional outlines, bairro points (select mode). A legend explains each active layer and its source.
- List and map are synced: hover highlights, click selects and scrolls.

## Phone

Bottom bar with five destinations; filters in a bottom sheet; a floating "Mapa" button; the map takes the full width; wide tables scroll inside their own container. No page scrolls sideways at 390 px (checked by E2E).

## Accessibility

Buttons and toggles carry labels (`aria-label`, `aria-pressed`), focus rings come from the shadcn primitives, colour is never the only signal (risk badges carry the level name; demo badges carry text; the mode is named in the switch, not only shown by the accent; the switch uses `role="radio"` with `aria-checked`), and the analysis items include text descriptions and distances.

## Language

Interface in Brazilian Portuguese, with R$ and m² formatted by `src/domain/money.ts` (`Intl` pt-BR).
