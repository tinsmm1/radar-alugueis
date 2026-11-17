# Radar Aluguéis BH

## Problem and objective

Finding a home in Belo Horizonte, to rent or to buy, means opening several portals and agency sites, comparing listings that show costs differently (rent alone, rent + condo, IPTU per year or per month), seeing the same home repeated across sources, and having no idea whether the street floods, the slope is steep or the metro is far. Price drops and new listings are missed because nobody checks every source every day. Buyers also lack a quick reading of what a purchase costs up front and per month, and how the price compares with renting a similar home.

Objective: a private, always-updated hub with two modes, **Alugar** (rent) and **Comprar** (buy), that consolidates every listing the owner is allowed to collect, shows the real monthly cost of renting, the asking price and an editable purchase simulation when buying, and gives an honest reading of each location, so the owner can choose a home with data instead of guesswork.

## Audience and roles

One owner (a person or family looking for a home in BH, to rent or to buy). A single password protects everything; the owner is also the administrator (sources, layers, schedule, backups). No multi-user accounts.

## Initial release flows

1. **Choose the mode:** the "Alugar | Comprar" switch in the top bar sets the mode of the whole hub. The mode is kept in the URL (`modo=compra`; renting is the default) and remembered in a cookie between pages; buy mode uses a green-teal accent so the two are easy to tell apart.
2. **Search:** the owner types a neighbourhood, address or region, combines filters and sees the results as a list, a map or both, synced. In rent mode the financial filters are rent, condo, IPTU, known monthly total and cost per m², and the totals show average and lowest rent; in buy mode they are asking price, price per m², minimum estimated gross yield, condo and IPTU, and the totals show average and lowest price, median price per m² and average yield. Sort options differ per mode.
3. **Inspect a property:** gallery, original description, every source with its link and price, price history, possible duplicates, and the location analysis with its risk index. Rent view: known monthly cost with what is missing. Buy view: asking price and price per m², condo and IPTU, estimated rent with the comparables it came from, estimated gross yield, and a purchase simulation (cash needed, SAC or Price financing, buy vs rent in the first month) with editable assumptions. A property offered both ways has a tab to switch between the two views.
4. **Decide:** compare up to five properties side by side (rows follow the mode); compare neighbourhoods and regionais (rent: rent, total and cost per m² medians; buy: price, price per m² and yield medians); see opportunities per mode (rent: price drops, below comparables, fresh listings, lowest cost per m²; buy: below comparables, highest yield, price drops, fresh listings, lowest price per m²).
5. **Follow:** favourite properties in custom lists, save searches (each keeps its mode), receive notifications (in the app, e-mail, Telegram) for new matches, price drops and unavailability. A saved search is notified of price drops only in its own mode.
6. **Operate:** the daily run (06:00 and 18:00, America/Sao_Paulo) collects sources, refreshes layers, locates and analyses properties, detects opportunities in both markets and notifies; the admin panel shows sources, runs, failures, layers, imports, demo data and backups.

## MVP

1. Source adapters: authorized VRSync feeds (scheduled; rentals and sales), CSV upload and manual entry (rent, sale or both), flagged demo data (rentals, sales and both); every portal recorded as pending with its assessment.
2. Normalization (cents, m², types, 18 features, purposes `aluguel`/`compra`, sale price), raw payload kept apart and scrubbed, origin of every listing.
3. Deduplication into properties, keeping all sources and showing the lowest price per mode, without assuming similar listings are the same home.
4. Price history (rent and sale price), drops per mode, and availability lifecycle (possibly unavailable → unavailable → back).
5. Known monthly cost and cost per m² for renting (owner priority); asking price and price per m² for buying.
6. Purchase analysis: acquisition costs (down payment, ITBI, deed and registry), SAC and Price financing, monthly cost of owning, buy vs rent, estimated rent and gross yield, all from editable assumptions.
7. Interactive MapLibre map with clusters, price labels (monthly total or asking price, by mode), risk and urban layers, selection of neighbourhoods and regionais on the map, distance search.
8. Location analysis per property and a location risk index (owner priority), distinguishing mapped risk, susceptibility and historical occurrence.
9. Opportunity detector for both markets (owner priority) and neighbourhood comparison per mode (owner priority).
10. Comparator, favourites with lists, saved searches, notifications by e-mail and Telegram.
11. Admin panel with source monitoring, runs, failures, imports, layers, demo, backup.

## Out of scope

- Scraping portals whose terms forbid it or that block automated access (VivaReal, ZAP, OLX, QuintoAndar, Imovelweb, Chaves na Mão, Netimóveis). They stay pending until an official API or an authorized feed exists.
- Multi-user accounts and public publishing of collected listings.
- Image similarity for deduplication (listings are grouped by address, numbers, coordinates, prices and text).
- Crime statistics by neighbourhood: no official open data at that granularity was reachable; the app never labels neighbourhoods as safe or dangerous.
- Bank offers, credit analysis, official tax calculation (ITBI, notary fees), property appraisal and price forecasts. The purchase simulation is an estimate from editable assumptions, not a quote.
- Net yield (taxes, vacancy, management fees and maintenance are not deducted).

## Requirements

- Language pt-BR, currency R$ (integer cents), areas in m², city Belo Horizonte.
- Known monthly cost (rent) = rent + condo + IPTU per month (annual ÷ 12) + known recurring fees; unknown values are never zero and make the cost *parcial*.
- Buy mode: asking price and price per m²; condo and IPTU shown as "não informado" when unknown, never zero.
- Purchase simulation defaults (all editable on the property page): down payment 20 %, effective interest 11 % a year, 30 years, ITBI 3 % (Belo Horizonte rate, to be confirmed with the city), deed and registry 1.5 %, return on invested cash 10 % a year, upkeep 0.5 % of the price a year. The page states that it is a simulation, not a bank offer or an official tax calculation (`ASSUMPTION_NOTE`).
- Estimated rent for a property for sale = median rent per m² of comparable active rentals × area (same bairro, type group and bedroom band; then the regional; then every rental in the regional), with at least 5 comparables. The page tells the user which scope was used and how many comparables. Gross yield = estimated rent × 12 ÷ asking price; no deductions.
- Never present demo data as real; flag it on every screen; compare demo only with demo.
- Never invent geographic information; say when data is missing; absence of a record is never "no risk".
- Responsive (phone to desktop), accessible labels, light professional design (blue accent for renting, green-teal for buying, white, grey).
- Security: validation, error handling, logs, secrets in environment variables, access control, protection against malicious queries (SSRF, injection), rate limiting, retention policy, LGPD (no personal data beyond what is needed), respect for sources' terms.

## Constraints and technical decisions

- Next.js 16.4 (App Router), React 19.3, TypeScript strict, Tailwind 4, shadcn/ui, pnpm 10, Node 22; created with `create-next-app` and the Vibe Coding Toolkit (`docs/setup.md`).
- Postgres with PostGIS through Drizzle ORM (Neon in production); MapLibre GL with OpenFreeMap tiles; collectors in TypeScript (one runtime) rather than Python.
- One `properties` table serves both modes: flags `for_rent`/`for_sale` and separate columns per mode (prices, drops, opportunity signals and scores), so a home offered both ways is one property with two views.
- Purchase maths is pure domain code (`src/domain/purchase.ts`), shared by the server and the client-side simulator.
- Free tiers: Vercel Hobby, Neon Free, GitHub Actions (scheduler), OpenFreeMap, Nominatim (≤ 1 request/s), SGB WFS, AWS Terrain Tiles.
- Serverless limits: the daily run is staged and resumable over HTTP (≈ 50 s per call).

## Assumptions and pending decisions

- **Reversible assumption:** the owner can get authorized VRSync feeds from agencies or export spreadsheets; until then the app runs on uploads, manual entries and demo data.
- **Reversible assumption:** PBH layers (Urbel risk areas, flood map, Defesa Civil critical points) are imported by the owner as GeoJSON, since PBH servers refuse server access (HTTP 403 on 13/11/2026).
- **Reversible assumption:** the purchase defaults above (rates, ITBI 3 %, registry 1.5 %) are reasonable starting points for BH; the owner edits them per simulation, and they are not stored.
- **Reversible assumption:** a gross yield of 6 % a year or more (`HIGH_YIELD_BP`) is "alto rendimento" for residential sales in BH.
- **Pending external decision:** partnerships with portals (QuintoAndar, Grupo OLX) — only the owner can request them.

## Acceptance criteria

Product:

1. Searching with several combined filters works.
2. The known monthly cost is correct, partial when a component is unknown, with IPTU per year divided by 12.
3. Properties appear on an interactive map synced with the list.
4. Risk layers can be switched on and off on the map.
5. Every listing shows its original source.
6. Duplicate listings are identified and grouped.
7. Price history is stored.
8. The daily update is configured (06:00 and 18:00 BRT) and documented.
9. The system detects and records collection failures; one failing source does not stop the others.
10. Data persists across restarts.

Buy mode:

11. The "Alugar | Comprar" switch changes search, map, opportunities, neighbourhoods and comparison; the mode survives navigation and a shared link with `modo=compra` opens in buy mode.
12. Buy-mode search shows only properties for sale, filters by price, price per m² and minimum gross yield, and sorts by price, price per m² and yield.
13. VRSync feeds, CSV and manual entry accept sales and rent-and-sale listings; a property offered both ways appears in both modes and its page switches between the two views.
14. Sale price drops are stored in the price history, flagged on the property and notified to buy-mode saved searches only.
15. The purchase simulation computes cash needed (down payment, ITBI, registry), SAC and Price financing and buy vs rent from editable assumptions, and says it is a simulation, not a bank offer or official tax calculation.
16. The estimated rent and gross yield come from at least 5 comparable rentals, the page names the scope used, and a property without enough comparables shows "Sem comparáveis" instead of a number.
17. Buy-mode opportunities list below-comparables, high-yield, price-drop, fresh and lowest-price-per-m² properties; demo sales are compared only with demo data.

Critical analysis and follow-up:

18. Every offer has an evaluation per mode (grade A–E, 0–100) built from explained parts (price against comparables, running cost or yield, location risk, services, the home and its data), with strengths and points of attention; missing data scores neutral and lowers the confidence. Search sorts and filters by it.
19. The neighbourhoods page ranks the best places (risk and services, independent of price) and the best offers of the mode.
20. The owner can follow a property's price with an optional target per mode; drops of followed properties and a reached target are notified once (again only on a further fall), in the app and by e-mail/Telegram.
21. Tools link to each other keeping the mode: property → similar homes, its neighbourhood, comparator, alert for similar homes; neighbourhoods → search; opportunity tabs → search or alert.

Decision guide and commute:

22. Administração → Perfil e trabalho stores up to 4 workplaces (address or coordinates, mode, departure and return times, days, weight), the maximum acceptable commute, the value of an hour, car and transit costs, income, savings and the grade weights.
23. Every active located property gets ida and volta door-to-door times at those times: TomTom historic traffic when `TOMTOM_API_KEY` is set (car, bike, walk), otherwise a model calibrated with public BH figures (always for buses); each time shows its method and a range.
24. With workplaces, the grade gains a "Tempo até o trabalho" part and follows the owner's weights; search sorts by "Mais perto do trabalho" and filters by maximum commute; geographic risk still never enters the grade.
25. The property page shows the real monthly cost of living there (housing + transport + time), a negotiation plan (opening, target, ceiling) with its reasons, whether it fits the household budget and a due-diligence checklist.
26. The decision guide compares regionais and bairros (price per m² spread, commute, yield, good offers, flood share), marks the price × commute Pareto frontier and lists the best offers within the owner's limits.
27. The grade shrinks the price effect when there are few comparables, flags prices ≥ 35% below the median as suspicious (capped, lower confidence), compares the condo fee per m², keeps the commute part neutral for a property without location, and shows what pulled the grade up and down.
28. Saving the profile recomputes commutes and grades automatically; each run notifies new real offers that fit the profile (grade, commute limit, budget) once per property and mode, at most 10 per run and mode.
29. TomTom requests go first to properties without a commute and to the best-graded offers; the run stops calling TomTom once the daily budget is used; model trips are upgraded later without holding the run.

Technical: lint, typed lint, rule self-check, typecheck, unit, PostGIS integration and E2E tests pass; the toolkit checks recorded in `docs/quality.md` pass.

## Decision guide (2026-11)

The owner asked for a complete guide to the best rent and purchase opportunities: deep comparisons between properties and regions, best positions, peak-hour traffic to the workplace configured in the admin with departure and return times, and grades built on explained analyses. Implemented as the profile (`settings.profile`), the `deslocamento` stage, the personalised grade, negotiation and affordability on the property page, and the `/guia` page. Methodology in `docs/analises.md`.

## Next delivery

Connect the first real agency feeds (VRSync, rentals and sales) and the owner's PBH GeoJSON layers; then tune deduplication thresholds, the risk index weights and the rent-estimate comparables with real data.

## Maintenance

Update this document when the objective, scope, constraints or acceptance criteria change. Detailed technical decisions and evidence belong in docs/architecture.md and docs/setup.md. The generated file is named PRODUCT.md.
