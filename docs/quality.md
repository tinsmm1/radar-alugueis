# Quality

## Commands

| Command | What it checks |
|---|---|
| `pnpm lint` | ESLint, toolkit `next-app` profile: official Next/TypeScript presets, 350-line limit, no `console`, data boundary (no `@/db` in UI), Drizzle update/delete guards |
| `pnpm lint:typed` | Typed async rules (`no-floating-promises`, `no-misused-promises`) |
| `pnpm lint:rules` | Self-check of the local ESLint rules (`scripts/verify-quality-rules.mjs`) |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` |
| `pnpm test` | Unit (pure domain, auth crypto, env, logger, pool, security regressions) |
| `pnpm test:integration` | Real PostGIS (`TEST_DATABASE_URL`): collection pipeline, failures and retries, lifecycle, deduplication across sources, price history and notifications, every filter as SQL, PostGIS analysis, GeoJSON import, demo flagging/removal, SSRF guards, CSV export |
| `pnpm test:e2e` | Browser against the production build with its own `radar_e2e` database: login, combined filters, known cost, map canvas, risk layer API, anonymous 401s, property page (source link, analysis), favourite and compare, CSV import → partial cost, sources and layers panels, phone layout |
| `pnpm build` | Production build (28 routes) |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, typed lint, rule self-check, unit tests, integration tests against a PostGIS service container, and the build.

## Pre-publication review (13/11/2026)

Two parallel agents audited the release: one walked every page in both modes at 1440 px and 390 px against the original specification; one read the pipeline and notification code for correctness. Findings fixed, each with a test where testable:

| Finding | Fix | Test |
|---|---|---|
| Telegram digest cut at 3 900 characters could break the HTML and block delivery | Whole-item chunks under the limit, marked per chunk | integration `follow-up` |
| A later condo/IPTU change erased a rent drop (and a rent change a sale drop) | Drop = last two distinct values of that price | integration `follow-up` |
| Cron answered "busy" when simply no run was due | `withRunLock` returns a distinct `BUSY` | integration `follow-up` |
| Merged properties left ghost favourites | Favourites and watches move; the emptied property is deleted | integration `follow-up` |
| "Para alugar" tab kept the buy view (cookie) | Explicit `modo` in every mode-dependent link | E2E |
| A rental that starts being sold never reached buy searches; a second agency's copy was "new" | "novo" per mode from property state changes | integration `follow-up` |
| Favourite drops merged across modes and shown with the rent price | Per-mode notification, mode in payload, price of that mode | integration `follow-up` |
| Favourite changes ignored sale drops | Both modes listed | — |
| One missed sale listing took the property out of buy mode | Offer per mode at that mode's best status | — |
| Search ignored the remembered mode | `/` without `modo` follows the cookie (redirect) | E2E `follow-up` |
| Times shown in UTC on the property page | `America/Sao_Paulo` everywhere | — |
| Dead ends: property page, opportunities, bairro links | Related links, similar homes, alerts from opportunity tabs, bairro → search with mode | E2E `follow-up` |
| Saved searches hard to reach on phone; icon-only button | Links on Favoritos; accessible name | — |
| Texts ("Dados de conforme o setor", buy-mode demo note, "Toque no cabeçalho", truncated hint) | Rewritten | — |

New in the same review: the critical evaluation per mode, the place grade and the "best places / best offers" rankings, the price target, the best-evaluated opportunity tab, the evaluation sort and filter, and links between all tools.

## Results (13/11/2026)

| Check | Result |
|---|---|
| Unit tests | 85 passing (includes purchase maths and the evaluation/place grades) |
| Integration tests (PostGIS 3.5) | 20 passing (adds drops surviving other cost changes, "novo" per mode, price targets, merges without ghosts, stored evaluations, Telegram chunks, run lock) |
| E2E (Playwright, production build) | 18 passing (login setup + 8 rent flows + 6 buy-mode flows + 3 follow-up flows: evaluation, price target reached and listed, best places/offers, opportunity alert, remembered mode) |
| lint / lint:typed / lint:rules / typecheck / build | ok |
| Manual pass over all main pages in both modes, desktop 1440 px and phone 390 px | no console errors, no horizontal overflow (one found in the new rankings on phone and fixed) |
| `pnpm audit --prod` | 1 low (`fast-xml-parser`, `stopNodes`, not used by the app) |
| Toolkit `check-eslint` (disposable copy) | PASS |
| Toolkit harness evaluation, "boundary fix" case | baseline 5 pass / 2 fail → 7 / 0 after a fresh agent's fix (see `docs/setup.md`) |
| Security review (toolkit prompt 13, independent agent) | 7 findings + 1 hypothesis; all addressed with regression tests where testable (`docs/security.md`) |
| Local links and anchors of the project's Markdown | all resolve (inline check over `README*.md`, `PRODUCT.md`, `AGENTS.md`, `docs/*.md`) |

The toolkit's `validate-docs.mjs` validates the **toolkit's own** repository (its root is fixed to the script's folder), so it is not evidence about this project; the project's links were checked separately as listed above.

## Live data used in development

- **SGB/CPRM WFS:** 1 337 flood, 1 470 landslide and 53 flash-flood susceptibility polygons and 140 risk sectors inside the BH bounding box.
- **OpenFreeMap (OSM):** 165 z14 tiles in ~19 s, giving 9 247 urban features (3 998 main-road segments, 792 open and 454 canalized watercourses, 121 hospitals, 327 supermarkets, 217 pharmacies, 29 metro stations, 2 007 parks…) and 669 neighbourhood points.
- **Nominatim:** the 9 regionais (331 km² in total, matching BH's area).
- **Spot checks of the analysis:** Vilarinho falls in medium flood susceptibility next to the Vilarinho metro station; Av. Prudente de Morais shows the canalized Córrego do Leitão within 10 m and high flood susceptibility nearby; Savassi shows no flood susceptibility (with the "absence of record" note).

## Buy mode (added 13/11/2026)

The hub's second product (Comprar) reuses the pipeline: listings carry `purposes` and a sale price, properties keep separate per-mode aggregates, opportunities run for both markets, and the rent estimate behind the gross yield comes from rental comparables (bairro → regional → whole regional, ≥ 5). Two problems found while checking it in the browser and fixed: the buy accent did not apply (a layered CSS rule loses to unlayered `:root` tokens; now unlayered and more specific), and the simulator's three columns wrapped amounts at laptop widths (now two columns with no wrapping). A parallel agent wrote the buy E2E suite against an isolated build folder; another updated the documentation from the code.

## Bugs found by tests and live data, then fixed

- Unavailable listings left their property's status stale (integration test).
- Neighbourhood points lost their regional depending on layer load order; three regionais matched an office building instead of the boundary (live data).
- The "low" susceptibility class, which covers most of BH, read as "moderate" and coloured the whole map (live data): it is now "low per the source consulted" and nearly transparent on the map.
- The risk index used "low inside" when a high class was 10 m away (live data): the strongest reading counts.
- MapLibre's worker failed to load under Turbopack (agent B): explicit worker URL in `src/lib/maplibre.ts`.
- Floating promises in the map component (typed lint).

## Reusable security review

Run the toolkit's prompt 13 ("Review this project's security", `docs/prompts/13-security-review.md`, toolkit revision `7ef68dd`) in repository mode with a private report outside the repository; for a change, use diff mode with the installed `differential-review` skill. Update it by re-reading the prompt at the toolkit's current revision.
