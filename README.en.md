<a id="top"></a>

<p align="center">
  <a href="README.md">Português</a> · <b>English</b> · <a href="README.es.md">Español</a>
</p>

<p align="center">
  <img src="docs/assets/readme/hero-en.svg" alt="Radar Aluguéis BH: choose your rental with data, not in the dark. Map of Belo Horizonte with prices, a flood susceptibility area and a location analysis card." width="1600" />
</p>

<h1 align="center">Radar Aluguéis BH</h1>

<p align="center">
  <b>Real-estate intelligence for renting or buying in Belo Horizonte.</b><br />
  One hub with two products, <b>Alugar</b> (Rent) and <b>Comprar</b> (Buy): listings from authorized sources consolidated <b>every day at 06:00 and 18:00</b>, duplicates grouped,<br />
  <b>real monthly cost</b> for renting, <b>purchase and yield simulation</b> for buying, a map with <b>risk layers</b>, <b>location analysis</b>, <b>opportunities</b> and <b>neighborhood comparison</b>.
</p>

<p align="center">
  <a href="#tour"><b>SEE THE APP →</b></a>
  &nbsp;·&nbsp; <a href="#comprar">BUY</a>
  &nbsp;·&nbsp; <a href="#mapa">MAP AND RISK</a>
  &nbsp;·&nbsp; <a href="#analise">ANALYSIS</a>
  &nbsp;·&nbsp; <a href="#fontes">SOURCES</a>
  &nbsp;·&nbsp; <a href="#como-funciona">HOW IT WORKS</a>
  &nbsp;·&nbsp; <a href="#publicar">DEPLOY</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-0b0d0e?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-1d4ed8?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-strict-1d4ed8?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostGIS-Neon-2563eb?logo=postgresql&logoColor=white" alt="Postgres + PostGIS" />
  <img src="https://img.shields.io/badge/mapa-MapLibre%20·%20OpenStreetMap-0b0d0e?logo=maplibre&logoColor=white" alt="MapLibre and OpenStreetMap" />
  <img src="https://img.shields.io/badge/UI-shadcn%2Fui-0b0d0e" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/tests-85%20unit%20·%2020%20integration%20·%2018%20E2E-15803d" alt="Tests" />
</p>

<p align="center">
  <b>2 modes</b> · <b>30+ filters</b> · <b>3.000</b> official susceptibility areas · <b>9.000+</b> urban features from OSM · <b>14</b> distance types per property · <b>free</b> to deploy
</p>

> **About the data in the images.** The portals (Viva Real, ZAP, OLX, QuintoAndar, Imovelweb, Chaves na Mão, Netimóveis) do not allow automated collection, so the images use the app's **demo data**. These are fictitious listings, marked with the purple "Demonstração" (Demo) badge on every screen and removable with one click. The geographic layers are **real**: SGB/IPT, OpenStreetMap and SRTM elevation. See [what is integrated and what is pending (in Portuguese)](docs/fontes.md). The app interface is in Brazilian Portuguese; UI labels below are kept in Portuguese with an English gloss.

---

<a id="tour"></a>

## 00 / The app in one minute

<p align="center">
  <img src="docs/assets/readme/showcase.png" alt="Radar Aluguéis BH on a computer (map of BH with prices and the flood layer) and on a phone (location analysis with risk index 43, Atenção)." width="1600" />
</p>

<p align="center">
  <img src="docs/assets/readme/tour.gif" alt="Animation: search split into list and map, filtering by the Centro-Sul regional, opening a property and scrolling to the location analysis." width="1100" />
</p>

| Screen | What it shows |
|---|---|
| **Alugar ⇄ Comprar** (Rent ⇄ Buy) | Switch at the top that changes the whole app: filters, totals, cards, map, sort orders, property page, opportunities, neighborhoods and comparison follow the mode (blue for renting, green for buying). |
| **Buscar** (Search) | Search box for neighborhood, address or area; totals (properties, average rent, lowest price, average area, new in 24 h, last update); synced list and map; **Lista / Dividido / Mapa** (List / Split / Map) views. |
| **Imóvel** (Property) | Gallery, original description, full details, **known monthly cost** item by item, cost per m², every source with a link, price history, possible duplicates and the **location analysis**. |
| **Oportunidades** (Opportunities) | Price drops, **below comparables** (same neighborhood, type and bedroom range), newly listed, a **cost per m²** ranking and, in Comprar mode, **highest yield**. |
| **Bairros** (Neighborhoods) | Median cost, supply, infrastructure within 1 km, transit and share of properties in susceptible areas, for each neighborhood and regional. |
| **Comparar** (Compare) | Up to 5 properties side by side, with the best value in each row highlighted. |
| **Favoritos, Buscas salvas, Notificações** (Favorites, Saved searches, Notifications) | Your own lists with notes; searches that alert you to new properties and price drops; alerts in the app, by email and on Telegram. |
| **Administração** (Admin) | Sources and their status, runs and failures, spreadsheet import, manual entry, geographic layers, demo data, notifications, backup and password. |

---

## 01 / On a computer

<table>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-busca.png" alt="Search with filters in the sidebar, totals, cards and map." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-imovel.png" alt="Property page with known monthly cost and map." /></td>
  </tr>
  <tr>
    <td align="center"><b>Buscar</b> · filters, totals, list and map</td>
    <td align="center"><b>Imóvel</b> · real cost and every source</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-comparar.png" alt="Comparison of four properties with the best value in each row in green." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-oportunidades.png" alt="Opportunity detector with properties below comparables." /></td>
  </tr>
  <tr>
    <td align="center"><b>Comparar</b> · the best in each row in green</td>
    <td align="center"><b>Oportunidades</b> · below comparables, price drops, new</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-bairros.png" alt="Neighborhood comparison table." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-favoritos.png" alt="Favorites in lists with notes." /></td>
  </tr>
  <tr>
    <td align="center"><b>Bairros</b> · cost, supply, infrastructure and risk</td>
    <td align="center"><b>Favoritos</b> · lists, notes and changes</td>
  </tr>
</table>

## 02 / On a phone

<p align="center">
  <img src="docs/assets/readme/phones.png" alt="Phone screens: search, map with layers, property, location analysis and filters." width="1600" />
</p>

<table>
  <tr>
    <td width="34%" align="center"><img src="docs/assets/readme/mobile.gif" alt="Phone animation: list, filters, map and analysis of a property." width="300" /></td>
    <td width="66%">
      <b>Made for searching on the street.</b><br /><br />
      • Bottom bar with Buscar, Oportunidades, Bairros, Comparar and Favoritos.<br />
      • Filters in a sheet that slides up from the bottom, with the total updated on every change.<br />
      • Floating <i>Mapa</i> (Map) button; the map fills the screen, with layers and legend.<br />
      • <i>Perto de mim</i> (Near me) searches within a radius of where you are.<br />
      • No screen scrolls sideways (tested at 390 px).
    </td>
  </tr>
</table>

---

<a id="comprar"></a>

## 03 / Comprar: price per m², simulation and yield

<p align="center">
  <img src="docs/assets/readme/desktop-compra-simulacao.png" alt="Property in Comprar mode: sale price, price per m², estimated rent, gross yield and purchase simulation with down payment, ITBI, SAC financing and a buy-versus-rent comparison." width="1100" />
</p>

In **Comprar** mode, Radar becomes a different product on the same data:

- **Price and price per m²**, condo fee and IPTU, price drops and sale price history.
- **Purchase simulation** with editable assumptions:
  - down payment, interest rate, term, BH ITBI transfer tax (3%), deed and registration;
  - **SAC or Price** financing, with first and last installment, total interest and cash needed up front.
- **Buy or rent?** The installment plus condo fee, IPTU and maintenance is compared with the rent of an equivalent property. The app also shows the return lost on the cash paid up front and how many years of rent the price represents.
- **Estimated rent and gross yield:** the median rent per m² of comparable properties **for rent**, from the same neighborhood, the regional or the whole regional. The screen states which of these scopes was used.
- **Buying opportunities:** price per m² below comparables for sale, **highest yield**, price drops and new listings.
- **Bairros:** median price, price per m² and yield by neighborhood and regional.

<table>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-compra-busca.png" alt="Search in Comprar mode with sale price, price per m², estimated rent and yield on the cards." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-compra-rendimento.png" alt="Buying opportunities: ranking by highest estimated yield." /></td>
  </tr>
  <tr>
    <td align="center"><b>Comprar</b> · price, R$/m² and yield on the cards</td>
    <td align="center"><b>Maior rendimento</b> (Highest yield) · ranking with estimated rent</td>
  </tr>
  <tr>
    <td width="50%" colspan="2"><img src="docs/assets/readme/desktop-compra-bairros.png" alt="Neighborhood comparison in Comprar mode: median price, price per m² and yield." /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><b>Bairros in Comprar mode</b> · median price, R$/m², yield, infrastructure and risk</td>
  </tr>
</table>

> The simulation **is not a bank offer or an official tax calculation**. The default values (20% down payment, 11% a year interest, 30 years, 3% ITBI, 1,5% notary fees) are assumptions you change on screen. The yield is **gross**: it does not deduct taxes, vacancy or costs.

---

<a id="mapa"></a>

## 04 / Interactive map and risk layers

<p align="center">
  <img src="docs/assets/readme/camadas.gif" alt="Animation: on the map of BH, the flood, landslide and river layers are turned on one by one and the map zooms in." width="1100" />
</p>

<p align="center">
  <img src="docs/assets/readme/desktop-mapa.png" alt="Map of Belo Horizonte with property prices, flood susceptibility, rivers and streams and metro stations." width="1100" />
</p>

- **Price markers**, clustered when many are close together. A colored border shows the risk index, a dashed border an approximate location, a lilac background demo data.
- **Toggleable layers:**
  - risk: flooding, landslide, flash flood, areas imported from PBH/Defesa Civil (city hall/civil defense);
  - water: rivers and streams, open or channeled;
  - surroundings: high-traffic avenues, railways, metro and BRT stations, hospitals, supermarkets and pharmacies, parks;
  - boundaries: regionais (city districts).
- **Select neighborhoods on the map** with a tap. **Buscar nesta área** (Search this area) limits the search to what is visible, and **distance from an address** draws the radius.
- The list and the map are linked: hovering over a card highlights its marker, and tapping a marker opens its card.

<a id="analise"></a>

## 05 / Location analysis and risk index

<p align="center">
  <img src="docs/assets/readme/desktop-analise.png" alt="Location analysis: index 43, Atenção; landslide, flash flood and slope items with rating, description, distance, source, date and link." width="1100" />
</p>

Every located property gets an analysis with the **rating, description, distance, source, date and link** of each item:

| Topic | Data consulted | Example |
|---|---|---|
| Flooding and waterlogging | Susceptibility Charts from **SGB/CPRM and IPT** (2014) | "High susceptibility area 50 m away" |
| Landslide and flash flood | Same official charts | "Inside a basin susceptible to flash floods" |
| Watercourses | OpenStreetMap (open and **channeled**) | "Córrego do Leitão (channeled) 10 m away" |
| Slope | SRTM elevation (~30 m) | "Steep slope (≥ 30%)" |
| Surroundings | Avenues, railway, Pampulha Airport, industrial areas | "High-traffic avenue 40 m away" |
| Services | Metro and BRT, hospitals, supermarkets, pharmacies, parks, schools | "Vilarinho station 50 m away" |
| Mapped risk and incidents | PBH/Urbel and Defesa Civil layers you import | "Inside risk area R4" |

The **risk index (0–100)** sums everything up as *Baixo* (Low), *Moderado* (Moderate), *Atenção* (Caution) or *Alto* (High) and shows what weighed in. Confidence drops when the location is approximate. The app **distinguishes officially mapped risk, susceptibility and historical incidents**, warns when a dataset is missing and **never** says a place is risk-free just because the dataset consulted has no record. It is a summary and **does not replace an inspection or a technical assessment**.

## 06 / Alugar: real cost, cost per m² and opportunities

- **Known monthly cost** = rent + condo fee + monthly IPTU (annual ÷ 12) + recurring fees provided. A value the source did not provide **does not become zero**: the cost is shown as *parcial* (partial), with what is missing.
- **Cost per m²** = known monthly cost ÷ private area. Useful for comparing different neighborhoods and sizes.
- **Opportunities:**
  - **price drop**, with the date and percentage;
  - **below comparables**, when the cost per m² is at least 15% below the median of 5 or more properties in the same neighborhood (or regional), of the same type and bedroom range;
  - **newly listed**.

### Critical evaluation, best places and price follow-up

<p align="center">
  <img src="docs/assets/readme/avaliacao.png" alt="Avaliação do Radar de um imóvel para alugar: nota A, 91 de 100, com as partes da nota, os pontos fortes e os pontos de atenção." width="900" />
</p>

<p align="center">
  <img src="docs/assets/readme/melhores-bairros.png" alt="Rankings da página de bairros: melhores locais (risco e serviços) e melhores ofertas para alugar." width="1100" />
</p>

- **Radar evaluation (grade A to E, 0–100), per mode:** price against similar homes (40 points), clarity of the monthly cost when renting or estimated yield when buying (10), location risk (25), services and transport nearby (15), the home and its data (10). Each property lists its strengths and points of attention. Missing data scores neutral and lowers the confidence; it is an automatic grade, not an appraisal.
- **Best places and best offers:** the neighbourhoods page opens with two rankings (place: risk and services; offers: mean evaluation in the mode, at least 3 homes). Search adds the **Melhor avaliação** sort and a minimum-grade filter.
- **Price follow-up:** set a **target price** on a property; you are notified on every drop and when the target is reached. Favourites list the followed prices with the change since you started.
- **Linked tools:** property → similar homes, its neighbourhood, the comparator, an alert for similar homes; neighbourhoods → search; each opportunity tab → full search or an alert.

<a id="fontes"></a>

## 07 / Sources: what is integrated

| Source | Status |
|---|---|
| **Real-estate agency XML feed (VRSync)**, the same one the agency sends to ZAP/Viva Real | **Integrated**, for rent and sale (`For Rent`, `For Sale`, `Sale/Rent`). Automatic collection at 06:00 and 18:00, with the authorization recorded |
| **CSV spreadsheet** (own template, columns `finalidade` and `preco_venda`) and **manual entry** | **Integrated**, for rent and sale |
| **Demo data** | Integrated, flagged and removable |
| Viva Real, ZAP Imóveis, OLX, Imovelweb, Netimóveis | **Pending**: no read API and automated access is blocked (403) |
| QuintoAndar, Chaves na Mão | **Blocked by terms**: they forbid automated collection in writing |

Each portal was assessed **before** any collector was written (API, robots.txt, terms and response to automated access, on 13/11/2026). The assessment appears in **Administração → Fontes** (Admin → Sources). The app does not bypass CAPTCHAs, logins or blocks. The way to bring in listings from a portal is the **advertising agency's feed**. Details in [docs/fontes.md](docs/fontes.md) (in Portuguese).

<table>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-fontes.png" alt="Admin: sources in use, authorized feed registration and pending portals with their assessment." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-camadas.png" alt="Admin: geographic layers with source, date, count and GeoJSON import." /></td>
  </tr>
  <tr>
    <td align="center"><b>Fontes</b> (Sources) · status, counts, errors and assessments</td>
    <td align="center"><b>Camadas</b> (Layers) · source, date, count and import</td>
  </tr>
</table>

---

<a id="como-funciona"></a>

## 08 / How it works

<p align="center">
  <img src="docs/assets/readme/how-it-works-en.svg" alt="Diagram: authorized sources, consolidation (normalization, duplicates, history, availability), location analysis (SGB/IPT, OpenStreetMap, elevation) and delivery (search, map, opportunities, comparison, notifications)." width="1600" />
</p>

1. **06:00 and 18:00 (Brasília time):** GitHub Actions calls the app. Each call works for about 50 s and collection resumes where it stopped. Vercel runs a backup round.
2. **Sources:** each one is collected separately, with 3 attempts. A failure is logged, raises an alert and **does not stop the others**.
3. **Consolidation:**
   - the original data is stored separately, without personal contacts, and the normalized data goes to search;
   - listings for the same property are grouped, keeping every link;
   - price history is recorded;
   - a listing that disappears becomes *possivelmente indisponível* (possibly unavailable) and, if it stays missing, *indisponível* (unavailable). Nothing is deleted right away.
4. **Location:** properties are geocoded (OpenStreetMap, up to 1 request/s, with cache) and analyzed with PostGIS.
5. **Delivery:** opportunities are recalculated, and saved searches and favorites generate alerts.

**Monitoring:** **Administração → Execuções** (Admin → Runs) shows each round and each source, with read, new, updated, duplicates, missing, errors and duration.

<a id="publicar"></a>

## 09 / Deploy your own (Vercel + Neon + GitHub, all free)

1. **GitHub:** create a repository (it can be private) and push this folder.
2. **Vercel:** **Add New → Project**, import the repository and change nothing. The build, migrations and São Paulo region are already in `vercel.json`.
3. **Database:** **Storage → Create Database → Neon (Postgres)**, connect it and **Redeploy**. PostGIS is enabled by the migration itself.
4. **Password:** right after the deploy, open `https://<projeto>.vercel.app` and create yours.
5. **First collection:** **Administração → Executar coleta agora** (Admin → Run collection now) loads the geographic layers. Then register a feed, upload a spreadsheet or load the demo data.
6. **Scheduling:** in GitHub, create the variable `RADAR_URL` with the app's address. Also recommended: `CRON_SECRET` in Vercel and in GitHub Secrets.

| Optional | What for |
|---|---|
| `RESEND_API_KEY` or `SMTP_URL` + `EMAIL_FROM` | email alerts |
| `TELEGRAM_BOT_TOKEN` | Telegram alerts |
| `CRON_SECRET` | only your scheduler can trigger collection |
| `APP_PASSWORD` | recover access |
| `GEOCODER_CONTACT` | your email in the OpenStreetMap User-Agent |

Full guide, with city hall layers, Telegram and self-hosting: [**docs/deploy.md**](docs/deploy.md) (in Portuguese).

## 10 / Run it on your machine

```bash
docker run -d --name radar-pg -p 54500:5432 -e POSTGRES_PASSWORD=radar postgis/postgis:16-3.5
```
```bash
pnpm install
```
```bash
cp .env.example .env.local
```
```bash
pnpm db:migrate
```
```bash
pnpm dev
```

Before `pnpm db:migrate`, set in `.env.local`: `DATABASE_URL=postgres://postgres:radar@127.0.0.1:54500/postgres`. The app opens at http://localhost:3700.

| Command | What for |
|---|---|
| `pnpm check` | lint, typed lint, local rules, types, tests and build |
| `pnpm test` | domain unit tests (cost, purchase and financing, parsers, duplicates, lifecycle, filters, opportunities, risk) |
| `pnpm test:integration` | tests on real PostGIS (collection, failures, filters, analysis, layer import, SSRF) |
| `pnpm test:e2e` | 15 browser tests against the production build, including Comprar mode |

## 11 / Under the hood

| Layer | Technology |
|---|---|
| Application | Next.js 16 (App Router), React 19, strict TypeScript |
| Interface | Tailwind 4, shadcn/ui, lucide; custom design in blue, white and gray |
| Map | MapLibre GL with OpenStreetMap vector tiles (OpenFreeMap) |
| Data | Postgres + PostGIS (Neon), Drizzle ORM; money in cents |
| Geodata | SGB/CPRM (WFS), OpenStreetMap (vector tiles and Nominatim), Terrain Tiles (AWS), GeoJSON from PBH |
| Automation | GitHub Actions (06:00/18:00) + Vercel Cron; runs in resumable steps |
| Quality | Vitest, Playwright, ESLint with typed lint, Vibe Coding Toolkit, independent security review |

## 12 / Known limitations

- The portals offer no authorized integration: real listings come in through an agency feed, a spreadsheet or manual entry.
- The Belo Horizonte city hall (PBH) risk layers must be imported by hand (PBH servers refuse automated access).
- There is no open official public-safety data by neighborhood. The app does not rate neighborhoods as safe or dangerous.
- The SGB susceptibility data is from 2014, at city scale: it shows how prone the terrain is, not the condition of a property.
- In Comprar mode, the simulation uses editable assumptions and the yield is gross and estimated from comparables: it is not a bank offer, an appraisal or a forecast of appreciation.
- Personal use: one password, no multi-user accounts.

## 13 / Documentation

| Document | Contents |
|---|---|
| [docs/deploy.md](docs/deploy.md) (in Portuguese) | deploying, scheduling, sources, PBH layers, notifications |
| [docs/fontes.md](docs/fontes.md) (in Portuguese) | sources integrated, pending and why |
| [PRODUCT.md](PRODUCT.md) | scope, decisions and acceptance criteria |
| [docs/architecture.md](docs/architecture.md) | modules, data and flows |
| [docs/security.md](docs/security.md) | security, LGPD, retention and backups |
| [docs/design.md](docs/design.md) | visual system, map and phone |
| [docs/onboarding.md](docs/onboarding.md) | running and maintaining |
| [docs/quality.md](docs/quality.md) | tests, Toolkit and security review |
| [docs/setup.md](docs/setup.md) | Vibe Coding Toolkit evidence |

<p align="center"><sub>For choosing where to live, renting or buying, knowing what it costs, what is around it and what the terrain says.</sub></p>

<p align="right"><a href="#top">back to top ↑</a></p>
