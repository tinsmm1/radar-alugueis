# Setup evidence

## Vibe Coding Toolkit

- **Source:** `soumatheusgomes/vibe-coding-toolkit`, revision `7ef68dd` (latest on 13/11/2026), local copy outside the application.
- **Flow:** prompt 11 (new Next.js project), from scratch:
  1. `PRODUCT.md` from `templates/product.md.template`;
  2. `create-next-app@16.4.6` (App Router, TypeScript, Tailwind, ESLint, `src/`, `@/*`, pnpm, no React Compiler, no Cache Components, no agent feedback);
  3. core dependencies (Drizzle + pg, Zod, server-only, Pino, clsx/tailwind-merge, Vitest, `@next/env`);
  4. `templates/next/` copied (keeping `.env.example`);
  5. ESLint `next-app` profile with the whole `eslint-rules/` folder, `scripts/verify-quality-rules.mjs` and the focused typed profile;
  6. local skills; the nine manifest documents; `.graphifyignore`.
- **Deliberate adaptations (13/11/2026):**
  - Pool `connectionTimeoutMillis` 10 s and `idleTimeoutMillis` 5 s, plus `attachDatabasePool` on Vercel (Neon cold starts; frozen serverless instances). The template test was updated to assert these values.
  - `getDatabaseUrl()` also accepts `POSTGRES_URL` (created by the Vercel/Neon integration).
  - Migrations via `scripts/migrate.mjs` (Drizzle migrator, skips without a database), run by `vercel-build`.
  - `distDir` from `NEXT_DIST_DIR`, so several local servers can share the checkout; their folders are ignored by ESLint and Git.
  - Node 22 (installed runtime) with `@types/node@22`. Vitest 4.1.12 and `@playwright/test` 1.63.0 match the stable channel and the preinstalled browser; libraries newer than two weeks were not adopted.
- **shadcn/ui:** adopted (radix base, "nova" preset, `components.json`), so the `shadcn` skill is installed.

## Skills

Installed in `.claude/skills` with `npx skills add … --agent claude-code` and locked in `skills-lock.json`:

| Skill | Source | Why |
|---|---|---|
| vercel-react-best-practices, vercel-composition-patterns, web-design-guidelines, writing-guidelines, vercel-react-view-transitions, vercel-optimize, deploy-to-vercel, vercel-cli-with-tokens | vercel-labs/agent-skills | Web catalogue |
| find-skills | vercel-labs/skills | Catalogue |
| next-dev-loop, next-bundle-optimizer | vercel/next.js | Compatible Next.js 16 |
| supabase-postgres-best-practices | supabase/agent-skills | PostgreSQL (Neon + PostGIS) |
| differential-review | trailofbits/skills | Security-sensitive changes |
| shadcn | shadcn/ui | Adopted UI system |

Not installed, with reasons: `gh-fix-ci` (Codex-only in the catalogue; this client is Claude Code), `vercel-react-native-skills` (no native app), Sentry MCP (no chosen service or organisation).

## Toolkit scripts and prompts run on this project

| Script / prompt | Result |
|---|---|
| `check-eslint.mjs` (disposable copy with `@eslint/js`, `eslint-plugin-import-x`, `eslint-import-resolver-typescript`) | PASS (rules, advanced profile, typed lint). A first run failed only because the `/` route did not exist yet (rule `no-html-link-for-pages` needs it); passed once the page existed. |
| `verify-quality-rules` (`pnpm lint:rules`) | ok |
| Harness evaluation (prompt 14, "boundary fix" case, `validate-harness.mjs` sha256 prefix `14220a750afbcf22`) | Baseline 5 pass / 2 fail. A fresh general-purpose agent fixed `access.mjs`; the coordinator re-ran the evaluator: 7 / 0, only `access.mjs` changed, `AGENTS.md` and `local-notes.txt` byte-identical. Observation: the agent briefly wrote a check script one level outside the fixture, deleted it and reported it itself. |
| "Worker/resource conflict" behaviour (observed during the build) | Three parallel UI agents each used their own dev port and build folder (`NEXT_DIST_DIR`) and agreed file ownership; destructive admin actions were tested on a disposable database. No conflicting writes were observed. |
| Security review (prompt 13, repository mode, independent read-only agent) | 7 findings + 1 hypothesis, private report outside the repository; fixes in `docs/security.md`. |
| `validate-docs.mjs` | Not applicable: it validates the toolkit repository itself (root fixed to its folder). The project's Markdown links were checked with an inline script (all resolve). |
| `validate-next.mjs` | Not run: needs Node 24 and fresh npm installs of a scaffold; this environment runs Node 22. |

## Plugins and integrations

Ponytail, Caveman, Superpowers, RTK, Context7 and Graphify are not installed in this cloud session's client. Their agreements are followed in `AGENTS.md` (smallest complete change, concise conversation, current official documentation from `node_modules/next/dist/docs/` and the libraries' sources). `.graphifyignore` is present for when Graphify is available. No hooks, Git protections or MCP servers were added.

## Memory

Canonical project knowledge lives in `AGENTS.md` (commands, hard rules, map of documents), loaded by Claude Code through `CLAUDE.md` (`@AGENTS.md`) and by other clients directly. Freshness: update `AGENTS.md` and the relevant `docs/` file in the same change as code, commands or decisions. Retrieval check: the independent security reviewer started in a fresh context from `AGENTS.md`, `PRODUCT.md` and `docs/` and applied the documented rules in its findings. The three UI agents were forks that inherited the coordinator's context, so they are not evidence of retrieval; a client restart was not tested.
