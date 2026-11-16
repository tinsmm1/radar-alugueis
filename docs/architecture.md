# Architecture

The app is a hub with two modes over the same data: **Alugar** (rent, `modo=aluguel`, default) and **Comprar** (buy, `modo=compra`). Collection, deduplication, location analysis and the map are shared; prices, filters, sorts, opportunities, neighbourhood statistics and price-drop alerts are computed per mode.

## Overview

```text
            06:00 / 18:00 BRT                                   owner (browser)
GitHub Actions ──POST /api/cron/collect──┐                          │
Vercel Cron (backup) ────────────────────┤                          ▼
                                         ▼                 Next.js App Router (Vercel, gru1)
                               runStep(): resumable run      ├─ pages: busca, imóvel, comparar,
                               ├─ fontes  (adapters)         │  bairros, oportunidades, favoritos,
                               ├─ camadas (SGB, OSM, regionais) buscas, notificações, admin
                               ├─ geocodificar (Nominatim)   ├─ /api/mapa, /api/camadas/[key]
                               ├─ analisar (PostGIS + relevo)└─ server actions (runAction + zod)
                               ├─ oportunidades (aluguel + compra)      │
                               ├─ notificar (e-mail, Telegram)          │
                               └─ retenção                              ▼
                                         └──────────────► Postgres + PostGIS (Neon)
```

## Modules

| Path | Responsibility |
|---|---|
| `src/domain/` | Pure logic shared by client and server: listing model, features and modes (`listing.ts`: `MODES`, `purposes`, `salePriceCents`), money parsing/formatting (`money.ts`), known monthly cost (`cost.ts`), purchase analysis (`purchase.ts`), VRSync parser (`vrsync.ts`), CSV template parser (`csv.ts`), deduplication scoring and grouping (`dedup.ts`), availability lifecycle (`lifecycle.ts`), filters, URL state and sorts per mode (`filters.ts`), opportunity detector and comparables (`opportunity.ts`), critical evaluation of an offer and place grade of a neighbourhood (`evaluation.ts`), layer catalogue (`layers.ts`), location analysis and risk index (`risk.ts`), geometry helpers (`geo.ts`), demo generator (`demo.ts`). |
| `src/db/schema/` | Drizzle tables (`listings.ts`: sources, raw payloads, listings, properties, price history, possible duplicates, runs; `geo.ts`: geolocations, risk areas, urban features, areas, layers; `user.ts`: settings, favourites, lists, price watches, saved searches, notifications, rate limits). |
| `src/server/sources/` | Adapter registry (`vrsync`, `planilha`, `manual`, `demo`, `portal`) and the recorded portal assessments. |
| `src/server/collect/` | `ingest.ts` (raw → normalized → history → availability, one transaction per source), `properties.ts` (dedup groups → property aggregates, one canonical offer per mode), `source-run.ts` (retries, failure isolation), `run.ts` (staged, resumable run), `opportunities.ts` (both markets, rent estimate and yield for sales), `retention.ts`, `demo.ts`. |
| `src/server/geo/` | `sgb.ts` (WFS), `osm.ts` (OpenFreeMap vector tiles, resumable), `regionais.ts` (Nominatim polygons), `terrain.ts` (slope from Terrarium tiles), `geocode.ts`, `analyze.ts` (PostGIS facts), `imports.ts` (owner GeoJSON). |
| `src/server/notify/` | Notification events: "novo" when a property starts being offered in a mode, drops per mode, unavailability/return of followed properties (favourites or price watches), price targets (`checkPriceTargets`); delivery (e-mail digest, Telegram in whole-item chunks under its size limit). |
| `src/server/mode.ts`, `src/lib/mode.ts` | Current mode: the URL `modo` first, then the `radar_modo` cookie, then rent; `withMode` builds the same URL in the other mode, dropping the financial filters and sort of the old one. |
| `src/server/queries/` | Page queries: `opportunities.ts` (tabs per mode), `neighborhoods.ts` (bairro and regional medians per mode), `compare.ts`, `property.ts` (detail, similar properties), `personal.ts`, `watches.ts`, `admin.ts`. |
| `src/server/search.ts` | Every filter as SQL (`whereFor`), sorts (`orderFor`), list/map/stats/facets queries and saved-search matching, all by mode. |
| `src/server/http.ts` | The only outbound HTTP client (SSRF guard, caps, User-Agent). |
| `src/app/` | Pages and routes; `(app)` requires a session (`requireAuth`), `src/proxy.ts` redirects signed-out visitors. |
| `src/components/` | `ui/` (shadcn), `shell/`, `property/` (shared card and badges), feature folders per page. |

## Data model

- **sources** → **listings** (one advertisement per source; unique `source_id + external_id`; `purposes` is `{aluguel}`, `{compra}` or both, with `rent_cents` and/or `sale_price_cents`) → **properties** (a group of listings that probably describe the same home).
- **listings_raw** keeps each distinct payload (hash), scrubbed of contact data; `listings.raw_id` points to the current one. Normalized and raw data are separate, and every listing keeps its source.
- **price_history** has the first price and each change (rent, condo, IPTU, total, sale price).
- **possible_duplicates** stores similar pairs that were not merged.
- **properties** carries the aggregate for search. Rent: `for_rent`, lowest active rent and its costs, `cost_status`, cost per m², initial rent, last drop (`drop_bp`, `dropped_at`), `opportunity`/`opportunity_score`. Buy: `for_sale`, lowest active asking price (`sale_price_cents`), `sale_price_m2_cents`, `initial_sale_price_cents`, `sale_drop_bp`/`sale_dropped_at`, estimated rent (`est_rent_cents`), gross yield (`gross_yield_bp`), `sale_opportunity`/`sale_opportunity_score`. Shared: location (`geom` Point 4326, precision, origin), regional, availability, analysis facts (`analysis` JSON), `risk_score`/`risk_level`/`flood_level`, `is_demo`. Condo and IPTU come from the rent offer when there is one, otherwise from the sale offer. Migration `drizzle/0002_compra.sql` added the buy columns and marked existing properties with a rent as `for_rent`.
- **properties** also stores the critical evaluation per mode (`rent_eval`/`rent_eval_score`, `sale_eval`/`sale_eval_score`, migration `0003_avaliacao.sql`).
- **price_watches**: one per property and mode, with the price when following started, an optional target and the price of the last target notification. Watches and favourites move to the surviving property when two merge; the merged-away property then keeps nothing and is deleted.
- **risk_areas**, **urban_features**, **areas** are PostGIS layers with GiST indexes; **layers** is the catalogue (source, date, count, status, cursor for resumable loads).
- **collection_runs** / **source_runs** are the monitoring record.

## Collection run

`runStep(trigger, budget)` advances the open run (or opens one if none started in the last 2 h; the admin button may always start one) through `fontes → camadas → geocodificar → analisar → oportunidades → notificar → retencao → concluido`, persisting the stage after each step, under a Postgres advisory lock. The scheduler calls it again while the response says `more: true`. A run older than 6 h is closed as failed.

- **Sources:** each scheduled source (feeds; portal rows are skipped with their reason) is collected with up to 3 attempts (2 s, 8 s backoff). A failure is recorded in `source_runs`, increments `consecutive_failures`, creates a "fonte com falha" notification, and the run goes on. The run ends `ok`, `partial` (some sources failed) or `failed`.
- **Availability:** a listing missing from a full snapshot becomes *possivelmente indisponível*; after 2 consecutive misses spanning 36 h it becomes *indisponível*; it returns to *disponível* if it reappears. A snapshot that lost more than half of the active listings is treated as truncated and marks nothing.
- **Deduplication:** listings are compared inside blocks (neighbourhood + bedrooms). Hard differences (bedrooms, area > 15 %, incompatible type, different number on the same street, > 400 m apart) exclude a match; address, coordinates, area, rent, rooms, text and features add evidence. Score ≥ 0.70 groups listings into one property; 0.45–0.70 is recorded as a possible duplicate and never merged. A similar sale price adds evidence too. Favourites follow merged properties.
- **Canonical offers:** each property picks the cheapest active rent offer and the cheapest active sale offer separately (`properties.ts`); a home listed for rent by one agency and for sale by another is one property, visible in both modes.
- **Price drops:** ingestion emits a `baixa_preco` event per mode (`mode: aluguel | compra`) when the rent or the sale price falls. Saved searches are notified only of drops in their own `modo`; followed properties (favourites or price watches) get one notification per mode with the mode in the payload. The stored drop compares the last two *distinct* values of that price, so a later change of another cost (condo, IPTU) does not erase it.
- **New offers:** "novo" comes from `refreshProperties`, which reports properties that started being offered in a mode (a new home, or a rental that is now also for sale). A second agency advertising a known home is not news. Each mode picks its offer from that mode's listings at their best status, so a sale listing missed once does not take the property out of buy mode while its rental is active.
- **Price targets:** after each source and in the `notificar` stage, a watch whose current price (known monthly total, else rent; or the asking price) is at or below its target creates one `preco_alvo` notification; it fires again only if the price falls further. Setting a new target re-arms it.
- **Layers:** refreshed when stale (SGB 90 days, OSM 30, regionais 180). The OSM load is resumable (165 tiles at z14) and the analysis waits for it to finish.
- **Geocoding:** Nominatim, structured street search bounded to BH, fallback to the neighbourhood centre (from OSM points, no request), cached forever (failures too), ≤ 40 per step, 1.1 s apart.
- **Opportunities (`oportunidades` stage):** recomputed for both markets, demo compared only with demo. Rent: known cost per m² ≥ 15 % below the median of ≥ 5 comparables (same bairro, else regional; same type group and bedroom band), drops ≥ 1 % in 30 days, listings first seen in the last 48 h. Buy: the same signals on the asking price per m² and sale drops, plus `alto_rendimento` when the gross yield is ≥ 6 % a year (`HIGH_YIELD_BP = 600`). The estimated rent of a sale is the median rent per m² of comparable active rentals × area (`comparableMedian`: bairro → regional → `regional_todos`, any type, ≥ 5 values); it is stored with its scope and count in `sale_opportunity.rentEstimate`, and `gross_yield_bp` = estimated rent × 12 ÷ price. Signals and estimates are cleared when a property stops being active or offered in that mode. The same stage stores the **evaluation** of each offer (`src/domain/evaluation.ts`): price per m² against the comparable median (50), running-cost clarity or yield (15), services within walking distance (25), the home and its data (10); the geographic risk index is stored as `riskNote` and shown apart, never counted in the grade; unknown parts score neutral and lower the confidence. Uploads (CSV, manual entry) refresh this stage immediately.
- **Analysis:** per located property: flood/landslide/flash-flood susceptibility (inside class and nearest high class), mapped/historical areas within 300 m, nearest of 14 urban kinds (KNN), slope (Horn on ~27 m terrain cells). Facts are stored; items and the index are computed by `src/domain/risk.ts`.

## Key decisions

| Decision | Reason |
|---|---|
| TypeScript collectors, not Python | One runtime and deploy target (Vercel); the work is I/O, parsing and SQL. |
| Staged run over HTTP | Fits serverless limits without a separate worker; GitHub Actions gives free scheduling and visible failures. |
| OpenFreeMap tiles for OSM features | Overpass and other OSM APIs refused this environment's IPs; the vector tiles are free, keyless, and the same data the map shows. |
| SGB susceptibility as the official baseline | Reachable WFS covering Belo Horizonte; PBH services block server access, so their layers are imported by the owner. |
| Properties table as the search unit | Filters, map and stats work on deduplicated homes with the lowest price, while every listing stays linked. |
| One table, two sets of mode columns | A home offered for rent and for sale stays one property with one location analysis; queries pick columns by `modo` instead of joining two tables. |
| Mode in the URL, cookie as memory | Links are shareable and server-rendered pages know the mode without client state; the cookie only restores the last choice when the URL has none. |
| Purchase maths in `src/domain/purchase.ts` | Pure and unit-tested; the property page simulator recalculates on the client as the owner edits assumptions, nothing is stored. Defaults (20 % down, 11 % a year, 30 years, ITBI 3 %, registry 1.5 %, 10 % return on cash, 0.5 % upkeep) are assumptions, labelled as a simulation (`ASSUMPTION_NOTE`), not a bank offer or official tax calculation. |
| Evaluation as explained parts, not a black box | The owner sees why a home scores well or badly (pros, cons, points per part) and how much data backs it; missing data never improves a grade. |
| Rent estimate from collected rentals | No external valuation service; the estimate is only as good as the rentals collected, so it requires ≥ 5 comparables, names its scope on the page and yields are gross. |
