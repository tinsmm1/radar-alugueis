<a id="top"></a>

<p align="center">
  <a href="README.md">Português</a> · <a href="README.en.md">English</a> · <b>Español</b>
</p>

<p align="center">
  <img src="docs/assets/readme/hero-es.svg" alt="Radar Aluguéis BH: elige el alquiler con datos, no a ciegas. Mapa de Belo Horizonte con precios, área de susceptibilidad a inundaciones y una tarjeta de análisis de la ubicación." width="1600" />
</p>

<h1 align="center">Radar Aluguéis BH</h1>

<p align="center">
  <b>Inteligencia inmobiliaria para alquilar o comprar en Belo Horizonte.</b><br />
  Un hub con dos productos, <b>Alugar</b> (Alquilar) y <b>Comprar</b> (Comprar): anuncios de fuentes autorizadas consolidados <b>todos los días a las 06h y a las 18h</b>, duplicados agrupados,<br />
  <b>costo mensual real</b> para alquilar, <b>simulación de compra y rentabilidad</b> para comprar, mapa con <b>capas de riesgo</b>, <b>análisis de la ubicación</b>, <b>oportunidades</b> y <b>comparativa de barrios</b>.
</p>

<p align="center">
  <a href="#tour"><b>VER LA APP →</b></a>
  &nbsp;·&nbsp; <a href="#comprar">COMPRAR</a>
  &nbsp;·&nbsp; <a href="#mapa">MAPA Y RIESGO</a>
  &nbsp;·&nbsp; <a href="#analise">ANÁLISIS</a>
  &nbsp;·&nbsp; <a href="#fontes">FUENTES</a>
  &nbsp;·&nbsp; <a href="#como-funciona">CÓMO FUNCIONA</a>
  &nbsp;·&nbsp; <a href="#publicar">PUBLICAR</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-0b0d0e?logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-1d4ed8?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-strict-1d4ed8?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostGIS-Neon-2563eb?logo=postgresql&logoColor=white" alt="Postgres + PostGIS" />
  <img src="https://img.shields.io/badge/mapa-MapLibre%20·%20OpenStreetMap-0b0d0e?logo=maplibre&logoColor=white" alt="MapLibre y OpenStreetMap" />
  <img src="https://img.shields.io/badge/UI-shadcn%2Fui-0b0d0e" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/pruebas-85%20unit%20·%2020%20integración%20·%2018%20E2E-15803d" alt="Pruebas" />
</p>

<p align="center">
  <b>2 modos</b> · <b>30+ filtros</b> · <b>3.000 áreas</b> de susceptibilidad oficiales · <b>9.000+ elementos</b> urbanos de OSM · <b>14</b> tipos de distancia por inmueble · <b>gratis</b> para publicar
</p>

> **Idioma de la app.** La interfaz está en portugués de Brasil. En este documento los nombres de pantallas y botones se mantienen en portugués, con una traducción entre paréntesis la primera vez que aparecen.

> **Sobre los datos de las imágenes.** Los portales (Viva Real, ZAP, OLX, QuintoAndar, Imovelweb, Chaves na Mão, Netimóveis) no permiten la recopilación automática, así que las imágenes usan los **datos de demostración** de la app. Son anuncios ficticios, marcados con la etiqueta morada "Demonstração" (Demostración) en todas las pantallas y que se pueden eliminar con un clic. Las capas geográficas son **reales**: SGB/IPT, OpenStreetMap y relieve SRTM. Consulta [qué está integrado y qué está pendiente](docs/fontes.md) (en portugués).

---

<a id="tour"></a>

## 00 / La app en un minuto

<p align="center">
  <img src="docs/assets/readme/showcase.png" alt="Radar Aluguéis BH en el ordenador (mapa de BH con precios y capa de inundación) y en el móvil (análisis de la ubicación con índice de riesgo 43, Atenção)." width="1600" />
</p>

<p align="center">
  <img src="docs/assets/readme/tour.gif" alt="Animación: búsqueda dividida en lista y mapa, filtro por la Regional Centro-Sul, apertura de un inmueble y desplazamiento hasta el análisis de la ubicación." width="1100" />
</p>

| Pantalla | Qué muestra |
|---|---|
| **Alugar ⇄ Comprar** | Selector en la parte superior que cambia toda la app: filtros, totales, tarjetas, mapa, ordenaciones, inmueble, oportunidades, barrios y comparador se adaptan al modo (azul para alquilar, verde para comprar). |
| **Buscar** (Buscar) | Campo de búsqueda por barrio, dirección o zona; totales (inmuebles, alquiler medio, precio más bajo, superficie media, nuevos en 24 h, última actualización); lista y mapa sincronizados; vistas **Lista / Dividido / Mapa** (Lista / Dividida / Mapa). |
| **Imóvel** (Inmueble) | Galería, descripción original, ficha completa, **costo mensual conocido** partida por partida, costo por m², todas las fuentes con enlace, historial de precios, posibles duplicados y el **análisis de la ubicación**. |
| **Oportunidades** (Oportunidades) | Precio rebajado, **por debajo de los comparables** (mismo barrio, tipo y rango de habitaciones), recién publicados, ranking de **costo por m²** y, en el modo Comprar, **mayor rentabilidad**. |
| **Bairros** (Barrios) | Costo mediano, oferta, infraestructura en un radio de 1 km, transporte y proporción de inmuebles en zona susceptible, para cada barrio y regional. |
| **Comparar** (Comparar) | Hasta 5 inmuebles lado a lado, con el mejor valor de cada fila destacado. |
| **Favoritos, Buscas salvas, Notificações** (Favoritos, Búsquedas guardadas, Notificaciones) | Listas propias con notas; búsquedas que avisan de inmuebles nuevos y de rebajas; avisos en la app, por correo electrónico y Telegram. |
| **Administração** (Administración) | Fuentes y su estado, ejecuciones y fallos, importación de hojas de cálculo, alta manual, capas geográficas, demostración, notificaciones, copia de seguridad y contraseña. |

---

## 01 / En el ordenador

<table>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-busca.png" alt="Búsqueda con filtros en el lateral, totales, tarjetas y mapa." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-imovel.png" alt="Página del inmueble con costo mensual conocido y mapa." /></td>
  </tr>
  <tr>
    <td align="center"><b>Buscar</b> · filtros, totales, lista y mapa</td>
    <td align="center"><b>Imóvel</b> · costo real y todas las fuentes</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-comparar.png" alt="Comparador con cuatro inmuebles y el mejor valor de cada fila en verde." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-oportunidades.png" alt="Detector de oportunidades con inmuebles por debajo de los comparables." /></td>
  </tr>
  <tr>
    <td align="center"><b>Comparar</b> · lo mejor de cada fila en verde</td>
    <td align="center"><b>Oportunidades</b> · por debajo de los comparables, rebajas, nuevos</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-bairros.png" alt="Tabla comparativa de barrios." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-favoritos.png" alt="Favoritos en listas con notas." /></td>
  </tr>
  <tr>
    <td align="center"><b>Bairros</b> · costo, oferta, infraestructura y riesgo</td>
    <td align="center"><b>Favoritos</b> · listas, notas y cambios</td>
  </tr>
</table>

## 02 / En el móvil

<p align="center">
  <img src="docs/assets/readme/phones.png" alt="Pantallas en el móvil: búsqueda, mapa con capas, inmueble, análisis de la ubicación y filtros." width="1600" />
</p>

<table>
  <tr>
    <td width="34%" align="center"><img src="docs/assets/readme/mobile.gif" alt="Animación en el móvil: lista, filtros, mapa y análisis de un inmueble." width="300" /></td>
    <td width="66%">
      <b>Hecho para buscar en la calle.</b><br /><br />
      • Barra inferior con Buscar, Oportunidades, Bairros, Comparar y Favoritos.<br />
      • Filtros en un panel que sube desde abajo, con el total actualizado en cada cambio.<br />
      • Botón <i>Mapa</i> flotante; el mapa ocupa la pantalla, con capas y leyenda.<br />
      • <i>Perto de mim</i> (Cerca de mí) busca en un radio a partir de donde estás.<br />
      • Ninguna pantalla se desplaza en horizontal (probado a 390 px).
    </td>
  </tr>
</table>

---

<a id="comprar"></a>

## 03 / Comprar: precio por m², simulación y rentabilidad

<p align="center">
  <img src="docs/assets/readme/desktop-compra-simulacao.png" alt="Inmueble en el modo Comprar: precio de venta, precio por m², alquiler estimado, rentabilidad bruta y simulación de compra con entrada, ITBI, financiación SAC y comparación entre comprar y alquilar." width="1100" />
</p>

En el modo **Comprar**, el Radar se convierte en otro producto sobre los mismos datos:

- **Precio y precio por m²**, comunidad (condomínio) e IPTU, rebaja de precio e historial del precio de venta.
- **Simulación de compra** con supuestos editables:
  - entrada, intereses, plazo, ITBI de BH (3%), escritura y registro;
  - financiación **SAC o Price**, con primera y última cuota, intereses totales y dinero necesario al contado.
- **¿Comprar o alquilar?** La cuota sumada a comunidad, IPTU y mantenimiento se compara con el alquiler de un inmueble equivalente. La app muestra también la rentabilidad que se deja de obtener con el dinero al contado y cuántos años de alquiler representa el precio.
- **Alquiler estimado y rentabilidad bruta:** la mediana del alquiler por m² de inmuebles comparables **en alquiler**, del mismo barrio, de la regional o de la regional entera. La pantalla indica cuál de estos ámbitos se usó.
- **Oportunidades de compra:** precio por m² por debajo de los comparables en venta, **mayor rentabilidad**, rebajas y anuncios nuevos.
- **Barrios:** precio mediano, precio por m² y rentabilidad por barrio y regional.

<table>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-compra-busca.png" alt="Búsqueda en el modo Comprar con precio de venta, precio por m², alquiler estimado y rentabilidad en las tarjetas." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-compra-rendimento.png" alt="Oportunidades de compra: ranking de mayor rentabilidad estimada." /></td>
  </tr>
  <tr>
    <td align="center"><b>Comprar</b> · precio, R$/m² y rentabilidad en las tarjetas</td>
    <td align="center"><b>Mayor rentabilidad</b> · ranking con el alquiler estimado</td>
  </tr>
  <tr>
    <td width="50%" colspan="2"><img src="docs/assets/readme/desktop-compra-bairros.png" alt="Comparativa de barrios en el modo Comprar: precio mediano, precio por m² y rentabilidad." /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><b>Barrios en el modo Comprar</b> · precio mediano, R$/m², rentabilidad, infraestructura y riesgo</td>
  </tr>
</table>

> La simulación **no es una oferta bancaria ni un cálculo oficial de impuestos**. Los valores por defecto (entrada del 20%, interés del 11% anual, 30 años, ITBI del 3%, notaría del 1,5%) son supuestos que puedes cambiar en pantalla. La rentabilidad es **bruta**: no descuenta impuestos, periodos sin inquilino ni costos.

---

<a id="mapa"></a>

## 04 / Mapa interactivo y capas de riesgo

<p align="center">
  <img src="docs/assets/readme/camadas.gif" alt="Animación: en el mapa de BH, las capas de inundación, deslizamiento y ríos se activan una a una y el mapa se acerca." width="1100" />
</p>

<p align="center">
  <img src="docs/assets/readme/desktop-mapa.png" alt="Mapa de Belo Horizonte con precios de los inmuebles, susceptibilidad a inundaciones, ríos y arroyos y estaciones de metro." width="1100" />
</p>

- **Marcadores con precio**, agrupados cuando hay muchos cerca. El borde de color indica el índice de riesgo, el borde discontinuo una ubicación aproximada y el fondo lila un dato de demostración.
- **Capas activables:**
  - riesgo: inundación, deslizamiento, crecida súbita (enxurrada), áreas importadas de la PBH/Defensa Civil;
  - agua: ríos y arroyos, abiertos o canalizados;
  - entorno: avenidas de mucho tráfico, vías de tren, metro y estaciones de BRT, hospitales, supermercados y farmacias, parques;
  - límites: regionales.
- **Selecciona barrios en el mapa** con un toque. **Buscar nesta área** (Buscar en esta zona) limita la búsqueda a lo que está visible, y la **distancia a una dirección** dibuja el radio.
- La lista y el mapa están conectados: pasar el ratón por una tarjeta resalta el marcador, y tocar el marcador abre la tarjeta.

<a id="analise"></a>

## 05 / Análisis de la ubicación e índice de riesgo

<p align="center">
  <img src="docs/assets/readme/desktop-analise.png" alt="Análisis de la ubicación: índice 43, Atenção; elementos de deslizamiento, crecida súbita y pendiente con clasificación, descripción, distancia, fuente, fecha y enlace." width="1100" />
</p>

Cada inmueble ubicado recibe un análisis con **clasificación, descripción, distancia, fuente, fecha y enlace** de cada elemento:

| Tema | Base consultada | Ejemplo |
|---|---|---|
| Inundación y anegamiento | Cartas de Susceptibilidad del **SGB/CPRM e IPT** (2014) | "Área de susceptibilidad alta a 50 m" |
| Deslizamiento y crecida súbita | Las mismas cartas oficiales | "Dentro de cuenca susceptible a crecidas súbitas" |
| Cursos de agua | OpenStreetMap (abiertos y **canalizados**) | "Córrego do Leitão (canalizado) a 10 m" |
| Pendiente | Relieve SRTM (~30 m) | "Pendiente elevada (≥ 30%)" |
| Entorno | Avenidas, vía de tren, Aeropuerto de Pampulha, zonas industriales | "Avenida de mucho tráfico a 40 m" |
| Servicios | Metro y BRT, hospitales, supermercados, farmacias, parques, escuelas | "Estación Vilarinho a 50 m" |
| Riesgo cartografiado y sucesos | Capas de la PBH/Urbel y de la Defensa Civil importadas por ti | "Dentro de área de riesgo R4" |

El **índice de riesgo (0–100)** lo resume todo en *Baixo* (Bajo), *Moderado* (Moderado), *Atenção* (Atención) o *Alto* (Alto) y muestra qué pesó más. La confianza baja cuando la ubicación es aproximada. La app **distingue riesgo cartografiado oficialmente, susceptibilidad y suceso histórico**, avisa cuando falta una base y **nunca** dice que un lugar está libre de riesgo solo porque la base consultada no tiene registros. Es un resumen y **no sustituye una inspección ni una evaluación técnica**.

## 06 / Alquilar: costo real, costo por m² y oportunidades

- **Costo mensual conocido** = alquiler + comunidad + IPTU mensual (anual ÷ 12) + tasas recurrentes informadas. Un valor que la fuente no informó **no cuenta como cero**: el costo aparece como *parcial* (parcial), con lo que falta.
- **Costo por m²** = costo mensual conocido ÷ superficie útil. Sirve para comparar barrios y tamaños distintos.
- **Oportunidades:**
  - **precio rebajado**, con la fecha y el porcentaje;
  - **por debajo de los comparables**, cuando el costo por m² está al menos un 15% por debajo de la mediana de 5 o más inmuebles del mismo barrio (o regional), del mismo tipo y del mismo rango de habitaciones;
  - **recién publicados**.

### Evaluación crítica, mejores lugares y seguimiento de precio

<p align="center">
  <img src="docs/assets/readme/avaliacao.png" alt="Avaliação do Radar de um imóvel para alugar: nota A, 91 de 100, com as partes da nota, os pontos fortes e os pontos de atenção." width="900" />
</p>

<p align="center">
  <img src="docs/assets/readme/melhores-bairros.png" alt="Rankings da página de bairros: melhores locais (risco e serviços) e melhores ofertas para alugar." width="1100" />
</p>

- **Evaluación del Radar (nota A a E, 0–100), por modo:** precio frente a inmuebles parecidos (40 puntos), claridad del costo mensual al alquilar o rentabilidad estimada al comprar (10), riesgo de la ubicación (25), servicios y transporte cercanos (15), el inmueble y sus datos (10). Cada inmueble muestra puntos fuertes y puntos de atención. Un dato faltante cuenta como neutro y reduce la confianza; es una nota automática, no una tasación.
- **Mejores lugares y mejores ofertas:** la página de barrios abre con dos rankings (lugar: riesgo y servicios; ofertas: evaluación media en el modo, mínimo 3 inmuebles). La búsqueda suma el orden **Melhor avaliação** y un filtro de nota mínima.
- **Seguimiento de precio:** define un **precio objetivo** en un inmueble; recibes un aviso con cada rebaja y cuando se alcanza el objetivo. Favoritos lista los precios seguidos con la variación desde el inicio.
- **Herramientas conectadas:** inmueble → parecidos, su barrio, el comparador, una alerta de parecidos; barrios → búsqueda; cada pestaña de oportunidades → búsqueda completa o alerta.

<a id="fontes"></a>

## 07 / Fuentes: qué está integrado

| Fuente | Estado |
|---|---|
| **Feed XML de inmobiliaria (VRSync)**, el mismo que envía a ZAP/Viva Real | **Integrado**, para alquiler y venta (`For Rent`, `For Sale`, `Sale/Rent`). Recopilación automática a las 06h y 18h, con la autorización registrada |
| **Hoja de cálculo CSV** (modelo propio, columnas `finalidade` y `preco_venda`) y **alta manual** | **Integrado**, para alquiler y venta |
| **Datos de demostración** | Integrado, marcado y eliminable |
| Viva Real, ZAP Imóveis, OLX, Imovelweb, Netimóveis | **Pendiente**: sin API de lectura y con bloqueo del acceso automatizado (403) |
| QuintoAndar, Chaves na Mão | **Bloqueado por los términos**: prohíben por escrito la recopilación automatizada |

Cada portal se evaluó **antes** de escribir cualquier recopilador (API, robots.txt, términos y respuesta al acceso automatizado, el 13/11/2026). La evaluación aparece en **Administração → Fontes** (Administración → Fuentes). La app no evita CAPTCHA, inicios de sesión ni bloqueos. La vía para traer anuncios de un portal es el **feed de la inmobiliaria anunciante**. Detalles en [docs/fontes.md](docs/fontes.md) (en portugués).

<table>
  <tr>
    <td width="50%"><img src="docs/assets/readme/desktop-fontes.png" alt="Administração: fuentes en uso, alta de feed autorizado y portales pendientes con la evaluación." /></td>
    <td width="50%"><img src="docs/assets/readme/desktop-camadas.png" alt="Administração: capas geográficas con fuente, fecha, cantidad e importación de GeoJSON." /></td>
  </tr>
  <tr>
    <td align="center"><b>Fontes</b> · estado, recuentos, errores y evaluaciones</td>
    <td align="center"><b>Camadas</b> (Capas) · fuente, fecha, cantidad e importación</td>
  </tr>
</table>

---

<a id="como-funciona"></a>

## 08 / Cómo funciona

<p align="center">
  <img src="docs/assets/readme/how-it-works-es.svg" alt="Diagrama: fuentes autorizadas, consolidación (normalización, duplicados, historial, disponibilidad), análisis de la ubicación (SGB/IPT, OpenStreetMap, relieve) y entrega (búsqueda, mapa, oportunidades, comparador, notificaciones)." width="1600" />
</p>

1. **06h y 18h (hora de Brasilia):** GitHub Actions llama a la app. Cada llamada trabaja unos 50 s y la recopilación continúa donde se quedó. Vercel hace una ronda de respaldo.
2. **Fuentes:** cada una se recopila por separado, con 3 intentos. Un fallo queda registrado, genera un aviso y **no interrumpe las demás**.
3. **Consolidación:**
   - los datos originales se guardan aparte, sin contactos personales, y los normalizados pasan a la búsqueda;
   - los anuncios del mismo inmueble se agrupan, conservando todos los enlaces;
   - se registra el historial de precios;
   - un anuncio que desaparece pasa a *possivelmente indisponível* (posiblemente no disponible) y, si sigue ausente, a *indisponível* (no disponible). Nada se borra de inmediato.
4. **Ubicación:** los inmuebles se geocodifican (OpenStreetMap, hasta 1 consulta/s, con caché) y se analizan con PostGIS.
5. **Entrega:** se recalculan las oportunidades, y las búsquedas guardadas y los favoritos generan avisos.

**Monitorización:** **Administração → Execuções** (Administración → Ejecuciones) muestra cada ronda y cada fuente, con leídos, nuevos, actualizados, duplicados, ausentes, errores y duración.

<a id="publicar"></a>

## 09 / Publica el tuyo (Vercel + Neon + GitHub, todo gratis)

1. **GitHub:** crea un repositorio (puede ser privado) y sube esta carpeta.
2. **Vercel:** **Add New → Project**, importa el repositorio y no cambies nada. El build, las migraciones y la región São Paulo ya están en `vercel.json`.
3. **Base de datos:** **Storage → Create Database → Neon (Postgres)**, conéctala y haz **Redeploy**. PostGIS se activa con la propia migración.
4. **Contraseña:** justo después del deploy, abre `https://<projeto>.vercel.app` y crea la tuya.
5. **Primera recopilación:** **Administração → Executar coleta agora** (Administración → Ejecutar recopilación ahora) carga las capas geográficas. Después registra un feed, sube una hoja de cálculo o carga la demostración.
6. **Programación:** en GitHub, crea la variable `RADAR_URL` con la dirección de la app. También se recomienda: `CRON_SECRET` en Vercel y en los Secrets de GitHub.

| Opcional | Para qué |
|---|---|
| `RESEND_API_KEY` o `SMTP_URL` + `EMAIL_FROM` | avisos por correo electrónico |
| `TELEGRAM_BOT_TOKEN` | avisos por Telegram |
| `CRON_SECRET` | solo tu programador activa la recopilación |
| `APP_PASSWORD` | recuperar el acceso |
| `GEOCODER_CONTACT` | tu correo electrónico en el User-Agent de OpenStreetMap |

Guía completa, con capas de la Prefeitura (Ayuntamiento), Telegram y servidor propio: [**docs/deploy.md**](docs/deploy.md) (en portugués).

## 10 / Ejecutar en tu máquina

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

Antes de `pnpm db:migrate`, define en `.env.local`: `DATABASE_URL=postgres://postgres:radar@127.0.0.1:54500/postgres`. La app se abre en http://localhost:3700.

| Comando | Para qué |
|---|---|
| `pnpm check` | lint, lint tipado, reglas locales, tipos, pruebas y build |
| `pnpm test` | pruebas unitarias del dominio (costo, compra y financiación, parsers, duplicados, ciclo de vida, filtros, oportunidades, riesgo) |
| `pnpm test:integration` | pruebas en PostGIS real (recopilación, fallos, filtros, análisis, importación de capas, SSRF) |
| `pnpm test:e2e` | 15 pruebas en el navegador contra el build de producción, incluido el modo Comprar |

## 11 / Por dentro

| Capa | Tecnología |
|---|---|
| Aplicación | Next.js 16 (App Router), React 19, TypeScript estricto |
| Interfaz | Tailwind 4, shadcn/ui, lucide; diseño propio en azul, blanco y gris |
| Mapa | MapLibre GL con teselas vectoriales de OpenStreetMap (OpenFreeMap) |
| Datos | Postgres + PostGIS (Neon), Drizzle ORM; dinero en centavos |
| Geodatos | SGB/CPRM (WFS), OpenStreetMap (teselas vectoriales y Nominatim), Terrain Tiles (AWS), GeoJSON de la PBH |
| Automatización | GitHub Actions (06h/18h) + Vercel Cron; ejecución en etapas reanudables |
| Calidad | Vitest, Playwright, ESLint con lint tipado, Vibe Coding Toolkit, revisión de seguridad independiente |

## 12 / Límites conocidos

- Los portales no ofrecen una integración autorizada: los anuncios reales entran por feed de inmobiliaria, hoja de cálculo o alta manual.
- Las capas de riesgo de la Prefeitura de BH (Ayuntamiento de BH) deben importarse a mano (los servidores de la PBH rechazan el acceso automático).
- No hay datos oficiales abiertos de seguridad pública por barrio. La app no clasifica los barrios como seguros o peligrosos.
- La susceptibilidad del SGB es de 2014, a escala municipal: muestra la predisposición del terreno, no el estado de un inmueble.
- En el modo Comprar, la simulación usa supuestos editables y la rentabilidad es bruta y estimada a partir de comparables: no es una oferta bancaria, una tasación ni una previsión de revalorización.
- Uso personal: una contraseña, sin cuentas de varios usuarios.

## 13 / Documentación

| Documento | Contenido |
|---|---|
| [docs/deploy.md](docs/deploy.md) (en portugués) | publicar, programar, fuentes, capas de la PBH, notificaciones |
| [docs/fontes.md](docs/fontes.md) (en portugués) | fuentes integradas, pendientes y por qué |
| [PRODUCT.md](PRODUCT.md) | alcance, decisiones y criterios de aceptación |
| [docs/architecture.md](docs/architecture.md) | módulos, datos y flujos |
| [docs/security.md](docs/security.md) | seguridad, LGPD, retención y copias de seguridad |
| [docs/design.md](docs/design.md) | sistema visual, mapa y móvil |
| [docs/onboarding.md](docs/onboarding.md) | ejecutar y mantener |
| [docs/quality.md](docs/quality.md) | pruebas, Toolkit y revisión de seguridad |
| [docs/setup.md](docs/setup.md) | evidencias del Vibe Coding Toolkit |

<p align="center"><sub>Para elegir dónde vivir, alquilando o comprando, sabiendo cuánto cuesta, qué hay alrededor y qué dice el terreno.</sub></p>

<p align="right"><a href="#top">volver arriba ↑</a></p>
