// README screenshots and lossless screen recordings of the running app (production build with
// the flagged demonstration data). See docs/onboarding.md.
//   DEMO_URL=http://localhost:3700 DEMO_PASSWORD=... SHOTS_TMP=<dir> node scripts/readme-shots/capture.mjs [desktop,phone,tours]
//   python3 scripts/readme-shots/compose.py <dir>
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.DEMO_URL ?? "http://localhost:3700";
const PASSWORD = process.env.DEMO_PASSWORD ?? "senha-dev-123";
const TMP = process.env.SHOTS_TMP ?? "/tmp/radar-readme-shots";
const PROP = process.env.DEMO_IMOVEL ?? "322";
const COMPARE = (process.env.DEMO_COMPARAR ?? "322,345,168,309").split(",").map(Number);
const only = process.argv[2] ?? "all";
const want = (k) => only === "all" || only.split(",").includes(k);
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch();

async function context({ phone = false, scale = 2, layers = [] } = {}) {
  const ctx = await browser.newContext({
    viewport: phone ? { width: 430, height: 932 } : { width: 1440, height: 900 },
    deviceScaleFactor: scale,
    isMobile: phone,
    hasTouch: phone,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  await ctx.addInitScript(([l, c]) => {
    localStorage.setItem("radar:camadas", JSON.stringify(l));
    localStorage.setItem("radar:comparar", JSON.stringify(c));
  }, [layers, COMPARE]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/`);
  return { ctx, page };
}

async function settle(page, ms = 500) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0).catch(() => undefined);
  await page.waitForTimeout(ms);
}
async function mapReady(page) {
  await page.locator("canvas.maplibregl-canvas").first().waitFor({ timeout: 45_000 });
  await page.waitForTimeout(3500);
}
const go = async (page, path, map = false) => {
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => undefined);
  if (map) await mapReady(page);
  else await settle(page);
};
const scrollTo = (page, selector, gap = 72) => page.evaluate(([s, g]) => window.scrollTo(0, (document.querySelector(s)?.getBoundingClientRect().top ?? 0) + window.scrollY - g), [selector, gap]);

if (want("desktop")) {
  const { ctx, page } = await context({ layers: ["sgb_inundacao", "curso_dagua", "metro"] });
  await go(page, "/", true);
  await page.screenshot({ path: `${TMP}/d-busca.png` });
  await go(page, "/?vista=mapa&regionais=Centro-Sul,Oeste,Noroeste", true);
  await page.screenshot({ path: `${TMP}/d-mapa.png` });
  await go(page, `/imovel/${PROP}`, true);
  await page.screenshot({ path: `${TMP}/d-imovel.png` });
  await scrollTo(page, "#analise");
  await settle(page, 800);
  await page.screenshot({ path: `${TMP}/d-analise.png` });
  // Buy mode (the hub's second product).
  const BUY = process.env.DEMO_IMOVEL_COMPRA ?? "477";
  await go(page, "/?modo=compra", true);
  await page.screenshot({ path: `${TMP}/d-compra-busca.png` });
  await go(page, `/imovel/${BUY}?modo=compra`, true);
  await scrollTo(page, "#simulacao");
  await settle(page, 600);
  await page.screenshot({ path: `${TMP}/d-compra-simulacao.png` });
  for (const [name, path] of [["compra-rendimento", "/oportunidades?modo=compra&tab=rendimento"], ["compra-bairros", "/bairros?modo=compra"]]) {
    await go(page, path);
    await page.screenshot({ path: `${TMP}/d-${name}.png` });
  }
  for (const [name, path] of [["comparar", "/comparar"], ["bairros", "/bairros"], ["oportunidades", "/oportunidades"], ["favoritos", "/favoritos"], ["fontes", "/admin/fontes"], ["camadas", "/admin/camadas"], ["execucoes", "/admin/execucoes"]]) {
    await go(page, path);
    await page.screenshot({ path: `${TMP}/d-${name}.png` });
  }
  await ctx.close();
}

if (want("phone")) {
  const { ctx, page } = await context({ phone: true, layers: ["sgb_inundacao", "curso_dagua"] });
  await go(page, "/");
  await page.screenshot({ path: `${TMP}/m-busca.png` });
  await go(page, "/?vista=mapa", true);
  await page.screenshot({ path: `${TMP}/m-mapa.png` });
  await go(page, `/imovel/${PROP}`);
  await page.screenshot({ path: `${TMP}/m-imovel.png` });
  await scrollTo(page, "#analise", 64);
  await settle(page, 600);
  await page.screenshot({ path: `${TMP}/m-analise.png` });
  await go(page, "/");
  await page.getByRole("button", { name: /Filtros/ }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${TMP}/m-filtros.png` });
  await go(page, "/?modo=compra");
  await page.screenshot({ path: `${TMP}/m-compra.png` });
  await go(page, `/imovel/${process.env.DEMO_IMOVEL_COMPRA ?? "477"}?modo=compra`);
  await scrollTo(page, "#simulacao", 64);
  await settle(page, 500);
  await page.screenshot({ path: `${TMP}/m-simulacao.png` });
  await ctx.close();
}

/** Lossless recording: Chrome's screencast sends a PNG only when the screen changes. */
async function screencast(ctx, page, name) {
  const dir = `${TMP}/frames-${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = `${dir}/${String(frames.length).padStart(5, "0")}.png`;
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, at: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
  });
  const size = page.viewportSize();
  await cdp.send("Page.startScreencast", { format: "png", maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
  return {
    async stop() {
      await page.waitForTimeout(400);
      await cdp.send("Page.stopScreencast").catch(() => undefined);
      const end = (frames.at(-1)?.at ?? 0) + 1.6;
      const lines = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.at ?? end) - f.at).toFixed(3)}`);
      writeFileSync(`${dir}/list.txt`, lines.join("\n") + `\nfile '${frames.at(-1)?.file}'\n`);
    },
  };
}

async function glide(page, to, ms = 1400) {
  await page.evaluate(([to, ms]) => new Promise((done) => {
    const from = window.scrollY;
    const start = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      window.scrollTo(0, from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  }), [to, ms]);
}
const top = (page, s, g = 72) => page.evaluate(([s, g]) => (document.querySelector(s)?.getBoundingClientRect().top ?? 0) + window.scrollY - g, [s, g]);

if (want("tours")) {
  // 1. Search → filter by regional → property → location analysis.
  {
    const { ctx, page } = await context({ scale: 1 });
    await go(page, "/", true);
    const rec = await screencast(ctx, page, "tour");
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: /^Centro-Sul/ }).first().click().catch(() => undefined);
    await mapReady(page);
    await page.locator("article").first().hover();
    await page.waitForTimeout(900);
    await page.goto(`${BASE}/imovel/${PROP}`, { waitUntil: "networkidle" });
    await mapReady(page);
    await glide(page, await top(page, "#analise"), 1800);
    await page.waitForTimeout(1600);
    await glide(page, await top(page, "#analise") + 700, 1600);
    await page.waitForTimeout(1400);
    await rec.stop();
    await ctx.close();
  }
  // 2. Map: switch risk layers on, zoom in.
  {
    const { ctx, page } = await context({ scale: 1 });
    await go(page, "/?vista=mapa", true);
    const rec = await screencast(ctx, page, "camadas");
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: /Camadas/ }).first().click();
    await page.waitForTimeout(600);
    for (const label of [/Inundação/, /Deslizamento/, /Rios e córregos/]) {
      await page.getByRole("checkbox", { name: label }).first().click().catch(async () => page.getByText(label).first().click());
      await page.waitForTimeout(1300);
    }
    await page.keyboard.press("Escape");
    const box = await page.locator("canvas.maplibregl-canvas").first().boundingBox();
    for (let i = 0; i < 2; i++) {
      await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.6);
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(1200);
    await rec.stop();
    await ctx.close();
  }
  // 3. Phone: list → filters → map → property.
  {
    const { ctx, page } = await context({ phone: true, scale: 1, layers: ["sgb_inundacao"] });
    await go(page, "/");
    const rec = await screencast(ctx, page, "mobile");
    await page.waitForTimeout(700);
    await glide(page, 700, 1200);
    await page.waitForTimeout(500);
    await glide(page, 0, 700);
    await page.getByRole("button", { name: /Filtros/ }).first().click();
    await page.waitForTimeout(1400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.goto(`${BASE}/?vista=mapa`, { waitUntil: "networkidle" });
    await mapReady(page);
    await page.goto(`${BASE}/imovel/${PROP}`, { waitUntil: "networkidle" });
    await settle(page, 600);
    await glide(page, await top(page, "#analise", 56), 1600);
    await page.waitForTimeout(1500);
    await rec.stop();
    await ctx.close();
  }
}

await browser.close();
console.log("capture ok", TMP);
