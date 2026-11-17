<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Radar Aluguéis BH

Private real-estate hub for Belo Horizonte with two modes, **Alugar** (rent, `modo=aluguel`, the default) and **Comprar** (buy, `modo=compra`): authorized listing sources (rentals and sales) consolidated daily, known monthly cost for renting, asking price and an editable purchase simulation for buying, deduplication, price history, MapLibre map with risk and urban layers, location analysis, opportunities and neighbourhood comparison per mode, notifications. Scope and acceptance criteria: `PRODUCT.md`. Owner guide (pt-BR): `README.md`, `docs/deploy.md`.

## Stack

| Area | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router, `src/proxy.ts`), React 19.3, TypeScript strict |
| UI | Tailwind 4, shadcn/ui (radix, `components.json`), lucide-react, sonner |
| Map | MapLibre GL 6 with OpenFreeMap (OSM) vector tiles |
| Data | Postgres + PostGIS 3.5 (Neon in production), Drizzle ORM + `pg`, SQL migrations in `drizzle/` |
| Geodata | SGB/CPRM WFS (susceptibility, risk sectors), OpenFreeMap tiles (OSM features), Nominatim (geocoding, regionais), AWS Terrain Tiles (slope), owner GeoJSON imports (PBH/Defesa Civil) |
| Validation, logs | Zod 4, Pino |
| Notifications | Resend or SMTP (nodemailer), Telegram Bot API |
| Tests | Vitest 4 (unit + PostGIS integration), Playwright |
| Tooling | pnpm 10, Node 22 |

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on port 3700 (`DATABASE_URL` in `.env.local`, a PostGIS database) |
| `pnpm lint` / `pnpm lint:typed` / `pnpm lint:rules` | ESLint (toolkit `next-app` profile), typed async rules, rule self-check |
| `pnpm typecheck` | `next typegen` + `tsc` |
| `pnpm test` | Unit tests (`src/**/*.test.ts`, pure domain, no network) |
| `pnpm test:integration` | PostGIS tests via `TEST_DATABASE_URL` (the schema is reset; local or CI only) |
| `pnpm test:e2e` | Playwright against the production build (`radar_e2e` database, port 3800) |
| `pnpm build` / `pnpm check` | Build / all gates |
| `pnpm db:generate` / `pnpm db:migrate` | SQL from `src/db/schema` / apply (`vercel-build` migrates before building) |

Several local servers can run side by side with `NEXT_DIST_DIR=.next-x pnpm exec next dev -p <port>`.

## Hard rules

- **350 lines per file** (`quality/max-lines`); split components and modules.
- **No `console.*`** in `src/`; use `@/lib/logger`.
- **Data boundary:** no `@/db` in `.tsx` under `app/` or `components/`; queries live in `src/server/**`. Every API route checks `isAuthenticated()` except `/api/health` and `/api/cron/collect` (bearer `CRON_SECRET`).
- **Server actions** go through `runAction` + `parse` (`src/server/actions/run-action.ts`); only `ActionError` (and the documented `*Error` classes of imports/demo) reach the user verbatim.
- **Money in integer cents**, discounts in basis points; unknown values stay `null`, never 0. Known monthly cost = rent + condo + IPTU/12 (annual) + known fees, `parcial` when something is missing (`src/domain/cost.ts`).
- **Two modes, one property:** a listing has `purposes` (`aluguel`, `compra` or both) and `sale_price_cents`; a property has `for_rent`/`for_sale` and separate columns per mode (rent: `rent_cents`, `total_cents`, `drop_bp`, `opportunity`…; buy: `sale_price_cents`, `sale_price_m2_cents`, `sale_drop_bp`, `est_rent_cents`, `gross_yield_bp`, `sale_opportunity`…). Anything that filters, sorts, ranks or notifies must take the mode (`Filter.modo`, `currentMode()` in `src/server/mode.ts`) and read the columns of that mode. The URL `modo` wins over the `radar_modo` cookie.
- **Buy figures are estimates:** purchase maths lives in `src/domain/purchase.ts` with editable `DEFAULT_ASSUMPTIONS` and `ASSUMPTION_NOTE` (simulation, not a bank offer or official tax calculation; ITBI 3 % is the BH assumption). Estimated rent and gross yield come from ≥ 5 comparable rentals (`comparableMedian`) and the scope used is shown to the user; yields are gross. Never present these as quotes or appraisals.
- **Evaluation and follow-up:** the offer grade lives in `src/domain/evaluation.ts` (parts, pros, cons, `EVALUATION_NOTE`) and is stored per mode by the `oportunidades` stage (`rent_eval*`, `sale_eval*`). Unknown inputs must stay neutral and lower the confidence, never raise a grade; it is never presented as an appraisal. Price watches (`price_watches`, one per property and mode) and favourites are "followed" properties for notifications; `checkPriceTargets` notifies once per price reached. Links between pages carry `modo` explicitly (`searchHref`, `?modo=` on property links).
- **Profile and commute:** the owner's decision profile (workplaces with ida/volta times, days, mode, weight; commute costs; finances; grade weights) lives in `settings.profile` and is parsed by `parseProfile` (`src/domain/profile.ts`, defaults on anything invalid). Commutes (`src/domain/commute.ts`) are computed by the `deslocamento` stage (`src/server/commute/refresh.ts`): TomTom Routing with `departAt` when `TOMTOM_API_KEY` is set (car, bike, walk; daily budget counter), otherwise the BH-calibrated model; buses always use the model. Trips are cached in `commute_trips` by signature; the summary goes to `properties.commute`/`commute_minutes`. Every commute shown says its method and is a range. With located workplaces the grade gets a `deslocamento` part and uses the profile weights; without them the classic 50/15/25/10 applies. Negotiation (`negotiation.ts`), affordability (`affordability.ts`) and region comparison (`regions.ts`) are pure and labelled as estimates; geographic risk never enters any grade.
- **`src/domain/**` is pure** (no I/O) and unit-tested; client and server share it.
- **Sources:** official APIs, authorized feeds (VRSync), owner uploads, manual entries and, by explicit owner decision, Apify task datasets (`apify` adapter, `APIFY_TOKEN`, mapper in `src/domain/apify.ts`; opt-in per source with a risk confirmation). The app itself never scrapes portals nor bypasses CAPTCHAs/blocks. Portal assessments live in `src/server/sources/assessments.ts` and must be re-checked before any portal adapter is written.
- **Outbound HTTP** only through `safeFetch` (`src/server/http.ts`): SSRF guard per hop and at connect time, size cap, timeout, identifying User-Agent. Nominatim ≤ 1 request/s with cache.
- **Geography:** never invent data; distinguish mapped risk, susceptibility and historical occurrence; absence of a record is never "no risk" (`NO_RECORD_NOTE`); missing layers are reported as "sem dados".
- **Demo data** is flagged (`is_demo`, "[DEMONSTRAÇÃO]" title, `DemoBadge`), compared only with itself, and removable in one action. Never present it as real.
- **Privacy (LGPD):** raw payloads are scrubbed of contact data (only the agency name stays); IPs are hashed in rate limits; retention in `src/server/collect/retention.ts`.
- **Language:** UI in Brazilian Portuguese; code, comments and technical docs in English; `README.md`, `docs/deploy.md`, `docs/fontes.md` and `docs/analises.md` in pt-BR.

## Map of the code

`docs/architecture.md` (modules and flows), `docs/design.md` (visual system), `docs/security.md` (threats, sources, LGPD), `docs/onboarding.md`, `docs/quality.md`, `docs/setup.md` (toolkit evidence), `docs/deploy.md`, `docs/fontes.md` (sources integrated and pending).
