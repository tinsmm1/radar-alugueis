# Security, data and privacy

## Access

- Single owner. The password is created on the first visit (scrypt, N=16384) or fixed with `APP_PASSWORD` (recovery). Whoever opens a fresh deployment first creates the password: open it right after the first deploy, or set `APP_PASSWORD` beforehand.
- A security variable set to an invalid value fails closed: an invalid `APP_PASSWORD`/`AUTH_SECRET` blocks login with an explanation; an invalid `CRON_SECRET` makes the collection endpoint answer 503. Sessions are HMAC-signed cookies (`httpOnly`, `sameSite=lax`, `secure` in production, 30 days) bound to the password: changing it signs every device out.
- `src/proxy.ts` redirects signed-out visitors (cookie presence only); the session signature is verified by the `(app)` layout **and by every page and `generateMetadata` itself** (partial RSC renders can skip a layout), by API routes (`isAuthenticated()`), and by server actions (`runAction()`). Logout deletes the cookie; a stolen cookie stays valid until it expires (30 days) or the password changes.
- Login attempts: 8 per 15 minutes per client, counted in Postgres (`rate_limits`, key = SHA-256 of the IP; the IP is not stored).
- `/api/cron/collect` requires `Authorization: Bearer <CRON_SECRET>` when set (recommended). Without it, calls can only advance a run or start one at most every 2 h, are capped at 40 per hour, and return no data. `/api/health` returns only the app name and database reachability.

## Input and output

- Every server action and API route validates input with Zod; filters from the URL are parsed field by field and invalid parts are dropped.
- SQL is built with Drizzle and parameterised `sql` templates; `LIKE` input is escaped.
- Uploaded files: CSV parser with a fixed template, VRSync via `fast-xml-parser` (documents declaring `<!ENTITY>` are refused before parsing), GeoJSON via `JSON.parse` with a 20 000-feature cap; uploads are capped at 12 MB, feeds at 25 MB.
- Links stored from sources and from the owner's forms must be `http(s)` (`httpUrl`, `safeUrl`); the CSV export prefixes cells that start with `= + - @` (spreadsheet formula injection).
- Links shown to the user from sources are restricted to `http(s)` (`safeUrl`); photos load with `referrerPolicy="no-referrer"`.
- Security headers: CSP (`default-src 'self'`, images `https:`, connections only to self and OpenFreeMap), `frame-ancestors 'none'`, `nosniff`, strict referrer.

## Outbound requests (SSRF)

Feed URLs are typed by the owner, so every outbound request goes through `safeFetch`: http(s) only, no credentials in the URL, ports 80/443, IPv6 literals refused, literal private/loopback/link-local/CGNAT/multicast IPv4 refused, IPv6 answers that embed an IPv4 (mapped, NAT64, 6to4, compatible) judged by that IPv4, DNS checked **at connect time** (no rebinding window), manual redirects re-validated on every hop (max 5), size and time caps. Integration tests cover loopback names and private ranges.

## Third-party sources

- Portals were assessed before any collector existed (`docs/fontes.md`, `src/server/sources/assessments.ts`). Where terms forbid automated collection or access is blocked, the adapter is a documented placeholder that never contacts the portal.
- Nominatim usage policy: ≤ 1 request/s, identifying User-Agent (optional contact in `GEOCODER_CONTACT`), permanent cache, only Belo Horizonte, ≤ 40 lookups per step.
- OpenStreetMap data (ODbL) is attributed on the map and in every analysis item that uses it.

## Personal data (LGPD)

- Listings can contain the advertiser's name, phone and e-mail. Only the agency/advertiser name is kept: contact fields are removed from the raw payload, and e-mails and phone numbers written inside titles and descriptions are replaced by "[contato removido]" in both raw and normalized data.
- Rate-limit keys use the first `X-Forwarded-For` address, which Vercel sets; on a self-hosted server put a proxy in front that overwrites that header.
- The owner's own data: password hash, notification e-mail and Telegram chat id, favourites, notes, saved searches. Exportable in Administração → Backup.
- No tracking, analytics or third-party scripts.

## Retention

| Data | Kept |
|---|---|
| Raw payloads | Current version of each listing: while the listing exists; older versions: 90 days |
| Collection and source run logs | 180 days |
| Notifications | 365 days |
| Unavailable listings without favourites | 365 days after last seen |
| Rate-limit counters | 1 day |

Applied by the `retencao` stage of every run (`src/server/collect/retention.ts`).

## Backups

Neon keeps point-in-time history (restore window depends on the plan; 6 h on Free, configurable on paid plans). Administração → Backup downloads a JSON export of the owner's data (lists, favourites, notes, saved searches, source configuration) and a CSV of active properties. Listings themselves can be recollected from the sources.

## Security review (13/11/2026)

Independent read-only review with the toolkit's prompt 13 (repository mode), report kept outside the repository. Findings and what was done:

| ID | Finding | Severity | Resolution |
|---|---|---|---|
| F1 | Pages relied on the layout's session check, which partial RSC requests can skip | High (needed validation; a local attempt was redirected) | Every page and `generateMetadata` calls `requireAuth`/`isAuthenticated` itself |
| F2 | SSRF guard accepted IPv6 literals embedding private IPv4 (`[::ffff:127.0.0.1]`, NAT64) | Medium | IPv6 literals refused; embedded IPv4 unwrapped in the DNS-time check; regression tests |
| F3 | Security variables set to invalid values were treated as absent (fail open) | Medium | Fail closed (login blocked / 503) with an explanation |
| F4 | Collection endpoint open without `CRON_SECRET` | Low | Capped at 40 calls/hour; `CRON_SECRET` recommended in the deploy guide |
| F5 | First visitor of a fresh deployment creates the password | Low | Documented (open right after deploy or set `APP_PASSWORD`); by design for a personal app |
| F6 | Post-login redirect accepted `/\t/host` | Low | Control characters and backslashes refused; same-origin check; regression test |
| F7 | CSV export did not neutralise spreadsheet formulas | Low | Prefixed cells; regression test |
| H2 | Contacts written inside descriptions were stored | Hypothesis | E-mails and phones scrubbed from text; regression test |

Hardening done: `http(s)`-only URLs in forms, `<!ENTITY>` refused, `permissions: contents: read` in workflows, `shadcn` moved to development dependencies, zod pinned to 4.6.7 through a pnpm override (advisory in a transitive copy). Remaining: `fast-xml-parser` low advisory (concerns `stopNodes`, not used; the patched release was 10 days old); `script-src 'unsafe-inline'` in the CSP (needed by Next's inline bootstrap without nonces); actions not pinned by commit SHA.
