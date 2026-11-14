# Onboarding (developers)

## Run locally

1. Node 22, pnpm 10 and Postgres 16 with PostGIS 3, for example:

   ```bash
   docker run -d --name radar-pg -p 54500:5432 -e POSTGRES_PASSWORD=radar postgis/postgis:16-3.5
   ```
   ```bash
   psql postgres://postgres:radar@127.0.0.1:54500/postgres -c "create database radar_dev"
   ```

2. `cp .env.example .env.local` and set `DATABASE_URL=postgres://postgres:radar@127.0.0.1:54500/radar_dev`.
3. `pnpm install`, `pnpm db:migrate`, `pnpm dev`, then open http://localhost:3700 and create a password (or set `APP_PASSWORD`).
4. **Administração → Visão geral → Executar coleta agora** loads the geographic layers (SGB WFS, 165 OpenFreeMap tiles, 9 regionais; about 1 minute).
5. **Administração → Demonstração** loads flagged fictitious listings (rentals, sales and both), or upload a CSV / add a VRSync feed.
6. Use the **Alugar | Comprar** switch in the top bar, or add `?modo=compra` to a URL, to see buy mode.

Several servers can share the checkout with separate build folders:

```bash
NEXT_DIST_DIR=.next-b pnpm exec next dev -p 3712
```

## Tests

| Suite | How |
|---|---|
| Unit | `pnpm test`: pure domain (cost, purchase maths, parsers, dedup, lifecycle, filters, opportunities, risk), auth crypto, env, logger, pool |
| Integration | `TEST_DATABASE_URL=postgres://postgres:radar@127.0.0.1:54500/radar_it pnpm test:integration`: the schema is reset; real PostGIS; network calls are mocked except the SSRF checks; the pipeline suite covers sale price drops notifying buy-mode searches only |
| E2E | `pnpm build`, then `pnpm test:e2e`: creates/migrates `radar_e2e`, seeds fixtures, starts the build on port 3800 |

## Common changes

- **New source adapter:** add it to `ADAPTERS` in `src/server/sources/registry.ts` returning `Collected` (normalized listings, scrubbed raws, `fullSnapshot`). Normalize with the helpers in `src/domain/listing.ts` and `src/domain/money.ts`, validate with `normalizedListingSchema`, add a fixture and unit test under `src/domain/`. Re-check the source's terms first and record it in `docs/fontes.md`.
- **New filter:** `filterSchema` and the `LISTS`/`NUMBERS`/`FLAGS`/`STRINGS` arrays in `src/domain/filters.ts`, `whereFor` in `src/server/search.ts`, the panel in `src/components/search/`. A financial filter belongs to one mode: apply it only in that branch of `whereFor`, put it in `RentFinance` or `BuyFinance` in `filter-panel.tsx`, and add it to the list `withMode` (`src/lib/mode.ts`) clears when switching modes. New sorts go in `SORTS` and `SORTS_BY_MODE`. The integration test "every filter field runs as valid SQL" must include it.
- **Mode-aware feature:** read the mode with `currentMode(searchParams.modo)` (`src/server/mode.ts`) in server pages, filter properties by `for_rent`/`for_sale`, and use the columns of that mode (`rent_cents`/`total_cents`/`drop_bp`/`opportunity` or `sale_price_cents`/`sale_price_m2_cents`/`sale_drop_bp`/`sale_opportunity`/`gross_yield_bp`). If the page should keep the mode in its links, add it to `MODE_PAGES` in `src/components/shell/nav.tsx`.
- **Purchase assumptions:** defaults and formulas live in `src/domain/purchase.ts` (`DEFAULT_ASSUMPTIONS`, `ASSUMPTION_NOTE`), tested in `purchase.test.ts`. Keep the note accurate if a default changes; the simulator never stores what the owner types.
- **Evaluation weights:** `src/domain/evaluation.ts` (`evaluate`, `placeScore`), tested in `evaluation.test.ts`; the parts must add up to 100 and every pro/con is a sentence the owner can check on the page. Stored by `refreshOpportunities`; run a collection (or an upload) to recompute.
- **New analysis item:** facts in `src/server/geo/analyze.ts` (`LocationFacts` in `src/domain/risk.ts`), text and level in `analysisItems`, points in `riskIndex`, a unit test. Never present missing data as low risk.
- **New layer:** catalogue in `src/domain/layers.ts`, loader in `src/server/geo/`, TTL in `LAYER_TTL_DAYS` (`src/server/collect/run.ts`).
- **Schema:** edit `src/db/schema/*`, run `pnpm db:generate`, review the SQL in `drizzle/`, commit it. Spatial columns use the custom `pointGeometry`/`anyGeometry` types (SRID 4326).
