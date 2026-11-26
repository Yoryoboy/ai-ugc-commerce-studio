// Drives the gallery in a real Chromium over the DevTools protocol (no packages: Node's global
// WebSocket, Node >= 22) against a throwaway studio served by the real server.
//
//   node tests/galeria-ui.cdp.mjs [screenshot folder]
//
// UGC_PLUGIN=<plugin folder> tests another copy of the plugin (a checkout of an older commit, for
// the RED run). UGC_CHROMIUM=<binary> picks the browser. Without Node 22 or a Chromium it prints
// "SKIPPED: needs Node 22 + Chromium" and exits 0, unless UGC_REQUIRE_UI_TESTS=1 is set (CI, release
// checks): then the same message goes to stderr and the exit code is 1, so a skip cannot pass as a green run.
// Headless `--dump-dom` and `--timeout` do not run page timers in real time, so this script talks to
// a live page instead. Everything it creates lives under os.tmpdir() and is removed at the end.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = process.env.UGC_PLUGIN ? path.resolve(process.env.UGC_PLUGIN) : path.join(REPO, "plugins", "ugc-studio");
const CHROMIUM = process.env.UGC_CHROMIUM
  || ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"].find((b) => spawnSync("sh", ["-c", `command -v ${b}`]).status === 0);
if (typeof WebSocket === "undefined" || !CHROMIUM) {
  const why = [typeof WebSocket === "undefined" ? `Node ${process.versions.node} has no global WebSocket` : null, CHROMIUM ? null : "no Chromium found"].filter(Boolean).join(", ");
  const msg = `SKIPPED: needs Node 22 + Chromium (${why}); the gallery UI was NOT tested.`;
  if (process.env.UGC_REQUIRE_UI_TESTS === "1") {
    console.error(msg + " UGC_REQUIRE_UI_TESTS=1: failing.");
    process.exit(1);
  }
  console.log(msg);
  process.exit(0);
}
const { crearServidor } = await import(pathToFileURL(path.join(PLUGIN, "servidor", "servidor.mjs")).href);

const scratch = [];
const tmp = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); scratch.push(d); return d; }; // removed at the end
const shots = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the studio ----------

const studio = tmp("ugc-ui-");
function png(rel, color, size = "360x450") {
  const f = path.join(studio, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=${color}:s=${size}`, "-frames:v", "1", f]);
  if (r.status !== 0) fs.writeFileSync(f, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
}
const json = (rel, obj) => { const f = path.join(studio, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj, null, 2) + "\n"); };
const file = (rel, text = "x") => { const f = path.join(studio, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const P = "clientes/acme/MLA1";
const CR = (id) => `${P}/creativos/${id}`;
const VID = (id) => `${P}/videos/${id}`;
const ids = {
  dolor: "2026-11-16-x-dolor", precio: "2026-11-16-x-precio", carrusel: "2026-11-17-x-pasos",
  desc: "2026-11-16-x-descartado", desc2: "2026-11-17-x-descartado2",
};
const V1 = "2026-11-10-cama-problema";
const V2 = "2026-11-12-cama-descartado";

json("studio.json", { credits: { available: 933.5, checkedAt: "2026-11-17T10:00:00Z" } });
json("actores/ana-v1/actor.json", { id: "ana-v1", name: "Ana María", credits: 13.75 });
png("actores/ana-v1/retrato.png", "#c98b6b");
json("clientes/acme/marca/marca.json", { name: "Acme SRL" });
json(`${P}/producto.json`, { profileId: "acme", productId: "MLA1", title: "Patas de madera para cama", platform: "mercadolibre" });
png(`${P}/fotos/f1.png`, "#8a6d3b", "400x400");
const creativo = (id, extra) => json(`${CR(id)}/creativo.json`, { id, type: "static", status: "draft", slots: ["4x5"], updatedAt: "2026-11-16T12:00:00Z", ...extra });
creativo(ids.dolor, { title: "Agacharse ya no duele", batch: "2026-11-16-patas-cama", slots: ["4x5", "9x16"], credits: 5.5, concept: { angle: "Dolor" }, actorId: "ana-v1",
  copy: { primaryText: "Subí la cama 10 cm.", headline: "Patas de madera", cta: "Comprar" }, adName: "MLA1_dolor_ana_estatica" });
png(`${CR(ids.dolor)}/4x5-v1.png`, "#3b6ea5"); png(`${CR(ids.dolor)}/4x5-v2.png`, "#2a8f6a");
png(`${CR(ids.dolor)}/9x16-v1.png`, "#a54b3b", "270x480"); png(`${CR(ids.dolor)}/9x16-v2.png`, "#8f2a6a", "270x480");
creativo(ids.precio, { title: "Precio bajo, piso firme", batch: "2026-11-16-patas-cama", status: "approved", credits: 5.5, updatedAt: "2026-11-16T13:00:00Z" });
png(`${CR(ids.precio)}/4x5-v1.png`, "#d4a017");
creativo(ids.carrusel, { title: "Carrusel de tres pasos", batch: "2026-11-17-patas-cama", type: "carousel", slots: ["tarjeta-1", "tarjeta-2", "tarjeta-3"], credits: 12, updatedAt: "2026-11-17T09:00:00Z" });
png(`${CR(ids.carrusel)}/tarjeta-1-v1.png`, "#5b3ba5"); png(`${CR(ids.carrusel)}/tarjeta-1-v2.png`, "#3ba58e"); png(`${CR(ids.carrusel)}/tarjeta-2-v1.png`, "#a5a03b");
creativo(ids.desc, { title: "Concepto descartado uno", batch: "2026-11-16-patas-cama", status: "discarded", updatedAt: "2026-11-16T14:00:00Z" });
png(`${CR(ids.desc)}/4x5-v1.png`, "#777777");
creativo(ids.desc2, { title: "Concepto descartado dos", batch: "2026-11-17-patas-cama", status: "discarded", updatedAt: "2026-11-17T14:00:00Z" });
png(`${CR(ids.desc2)}/4x5-v1.png`, "#999999");

json(`${VID(V1)}/video.json`, {
  id: V1, title: "La cama pegada al piso", actorId: "ana-v1", status: "draft", credits: 56, hook: "¿Ustedes también tienen la cama pegada?",
  copy: { primaryText: "Mi cama estaba pegada al piso y lo arreglé en 5 minutos.", headline: "Patas de madera para cama", description: "Envío gratis", cta: "Comprar" },
  adName: "MLA1_dolor_ana_video",
  versions: [{ n: 1, credits: 20 }, { n: 2, credits: 20 }, { n: 3, credits: 16 }], updatedAt: "2026-11-10T18:05:00Z",
});
for (const n of [1, 2, 3]) { file(`${VID(V1)}/borrador-v${n}.mp4`, "video " + n); png(`${VID(V1)}/thumb-v${n}.jpg`, ["#444444", "#555555", "#2f5f8a"][n - 1], "270x480"); }
file(`${VID(V1)}/final.mp4`, "final"); file(`${VID(V1)}/prompt-v1.md`, "prompt");
json(`${VID(V2)}/video.json`, { id: V2, title: "Video descartado de prueba", status: "discarded", versions: [{ n: 1 }], updatedAt: "2026-11-12T10:00:00Z" });
file(`${VID(V2)}/borrador-v1.mp4`, "v"); png(`${VID(V2)}/thumb-v1.jpg`, "#666666", "270x480");
json("clientes/beta/marca/marca.json", { name: "Beta Hogar", logo: "logo.png" });
png("clientes/beta/marca/logo.png", "#224488", "200x200");
// Only the ad preview step uses it: an ad text longer than the feed shows (it is cut with «Ver más»).
const AD = "clientes/beta/MLB4/creativos/2026-11-19-x-anuncio";
const AD_TEXT = "Tu dormitorio merece una luz cálida que no encandile. Este velador tiene tres intensidades, base de madera maciza y una pantalla de lino que suaviza todo.";
json("clientes/beta/MLB4/producto.json", { profileId: "beta", productId: "MLB4", title: "Velador de noche" });
json(`${AD}/creativo.json`, { id: "2026-11-19-x-anuncio", title: "Luz que no encandila", type: "static", status: "draft", batch: "2026-11-19-velador", slots: ["4x5", "9x16"],
  concept: { angle: "Deseo" }, updatedAt: "2026-11-19T12:00:00Z",
  copy: { primaryText: AD_TEXT, headline: "Velador de noche", description: "Envío gratis a todo el país", cta: "Más información" } });
png(`${AD}/4x5-v1.png`, "#b08d57"); png(`${AD}/9x16-v1.png`, "#57b08d", "270x480");
json("clientes/beta/MLB2/producto.json", { profileId: "beta", productId: "MLB2", title: "Lámpara de pie" });
// Only the viewer step uses it, so no other step changes its images or counts it.
const VIS = "clientes/beta/MLB2/creativos/2026-11-15-x-visor";
json(`${VIS}/creativo.json`, { id: "2026-11-15-x-visor", title: "Piezas para el visor", type: "static", status: "draft", batch: "2026-11-15-lampara", slots: ["4x5", "9x16"], updatedAt: "2026-11-15T12:00:00Z" });
png(`${VIS}/4x5-v1.png`, "#1f6f8b"); png(`${VIS}/4x5-v2.png`, "#8b1f4e"); png(`${VIS}/9x16-v1.png`, "#4e8b1f", "270x480");
// A product of its own for the card alignment step (one batch, one row): a title that wraps to two
// lines, one far longer than two lines, a creative without status and a carousel of square cards.
const AL = "clientes/beta/MLB3";
const AL_CR = (id) => `${AL}/creativos/${id}`;
const LARGO = "Funda de lino lavado a la piedra con cierre invisible, relleno de pluma y costuras reforzadas a mano una por una";
const DOS = "Almohadón suave para el sillón del living";
json(`${AL}/producto.json`, { profileId: "beta", productId: "MLB3", title: "Funda de almohadón" });
const alineado = (id, extra) => json(`${AL_CR(id)}/creativo.json`, { id, type: "static", status: "draft", batch: "2026-11-18-funda", slots: ["4x5"], ...extra });
alineado("2026-11-18-x-largo", { title: LARGO, updatedAt: "2026-11-18T12:00:00Z" }); png(`${AL_CR("2026-11-18-x-largo")}/4x5-v1.png`, "#6b8e23");
alineado("2026-11-18-x-dos", { title: DOS, status: "approved", updatedAt: "2026-11-18T11:00:00Z" }); png(`${AL_CR("2026-11-18-x-dos")}/4x5-v1.png`, "#8e236b");
alineado("2026-11-18-x-sin-estado", { title: "Sin estado todavía", status: undefined, updatedAt: "2026-11-18T10:00:00Z" }); png(`${AL_CR("2026-11-18-x-sin-estado")}/4x5-v1.png`, "#236b8e");
alineado("2026-11-18-x-tarjetas", { title: "Tres pasos", type: "carousel", slots: ["tarjeta-1", "tarjeta-2"], updatedAt: "2026-11-18T09:00:00Z" });
png(`${AL_CR("2026-11-18-x-tarjetas")}/tarjeta-1-v1.png`, "#8e6b23", "400x400"); png(`${AL_CR("2026-11-18-x-tarjetas")}/tarjeta-2-v1.png`, "#238e6b", "400x400");
// An old entry in the trash (2020), written the way the server writes them.
file(".papelera/2020-01-01T000000Z-abcdef/clientes/acme/viejo.txt", "old");
json(".papelera/2020-01-01T000000Z-abcdef/papelera.json", { id: "2020-01-01T000000Z-abcdef", originalPath: "clientes/acme/viejo.txt", trashedAt: "2020-01-01T00:00:00Z", kind: "file" });

const srv = await crearServidor({ studio, port: 0, idleMin: 0, debounceMs: 40 });
await srv.listo;
const api = async (p, opts = {}) => {
  const r = await fetch(`http://127.0.0.1:${srv.port}${p}`, { ...opts, headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}) } });
  return r.json();
};
const disk = (rel) => fs.existsSync(path.join(studio, rel));
const ls = (rel) => fs.readdirSync(path.join(studio, rel)).sort();
const status = (rel) => JSON.parse(fs.readFileSync(path.join(studio, rel), "utf8")).status;

// ---------- Chromium over CDP ----------

const profile = tmp("ugc-ui-profile-");
const chrome = spawn(CHROMIUM, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
  "--disable-gpu", "--no-sandbox", "--window-size=1280,900", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  const t = setTimeout(() => reject(new Error("chromium did not report its DevTools address")), 20000);
  chrome.stderr.on("data", (d) => {
    buf += d;
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
  chrome.on("exit", () => reject(new Error("chromium exited early: " + buf.slice(-300))));
});
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error("cannot connect to " + wsUrl)); });
let nextId = 0;
const waiting = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { const { resolve, reject } = waiting.get(m.id); waiting.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId;
  waiting.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

async function openPage(init) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const cdp = (m, p) => send(m, p, sessionId);
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  if (init) await cdp("Page.addScriptToEvaluateOnNewDocument", { source: init });
  const page = {
    async eval(expression) {
      const r = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
      return r.result.value;
    },
    async waitFor(expression, what, ms = 8000) {
      const t0 = Date.now();
      let last;
      while (Date.now() - t0 < ms) {
        try { last = await page.eval(expression); if (last) return last; } catch (e) { last = e.message; }
        await sleep(80);
      }
      throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`);
    },
    async goto(url) { await cdp("Page.navigate", { url }); },
    async hash(h) { await page.eval(`location.hash = ${JSON.stringify(h)}`); },
    async shot(name) {
      if (!shots) return;
      const { data } = await cdp("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(shots, name + ".png"), Buffer.from(data, "base64"));
    },
    text: (sel) => page.eval(`(document.querySelector(${JSON.stringify(sel)}) || {}).innerText || ""`),
    // Clicks the first button/link whose text is exactly `text` inside `scope`.
    click: (text, scope = "document") => page.eval(`(() => { const b = [...${scope}.querySelectorAll("button, a")].find((x) => x.textContent.trim() === ${JSON.stringify(text)} && !x.disabled); if (!b) throw new Error("no button: ${text}"); b.click(); return true; })()`),
    cardTitles: () => page.eval(`[...document.querySelectorAll(".item h3")].map((h) => h.textContent)`),
    pick: (title) => page.eval(`(() => { const c = [...document.querySelectorAll(".item")].find((x) => x.querySelector("h3").textContent === ${JSON.stringify(title)}); const i = c && c.querySelector(".pick input"); if (!i) throw new Error("no card: ${title}"); i.click(); return true; })()`),
    resources: () => page.eval(`performance.getEntriesByType("resource").map((e) => e.name)`),
    // Real input through the browser (not synthetic DOM events): pointer and focus-visible behave as for a person.
    mouse: (x, y) => cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }),
    async key(key, keyCode) {
      await cdp("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code: key, windowsVirtualKeyCode: keyCode });
      await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: keyCode });
    },
    async tap(x, y) {
      await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    },
    cdp,
    async close() { await send("Target.closeTarget", { targetId }); },
  };
  return page;
}
const base = `http://127.0.0.1:${srv.port}`;
async function login(page) {
  await page.goto(`${base}/`);
  await page.waitFor(`location.pathname === "/" && !location.search && !!document.querySelector(".tile")`, "the gallery to load");
}

// ---------- steps ----------

let fails = 0;
const step = async (name, fn) => {
  try { await fn(); console.log("ok   " + name); } catch (e) {
    fails++; console.log("FAIL " + name + "\n     " + String(e.message).split("\n")[0]);
    // A dialog or selection left open by the failed step must not fail the next ones too.
    try { await page.eval(`(() => { const d = document.getElementById("dialogo"); if (d && !d.hidden) [...d.querySelectorAll("button")].find((b) => b.textContent.trim() === "Cancelar").click(); state.selection.clear(); return true; })()`); } catch { /* the page is gone */ }
  }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const has = (text, part, what) => expect(String(text).includes(part), `${what}: expected «${part}» in «${String(text).replace(/\s+/g, " ").slice(0, 300)}»`);

const page = await openPage();
await login(page);

await step("header: the used-credits tile shows the server's creditsUsed (actors + videos + creatives)", async () => {
  const used = (await api("/api/estudio")).creditsUsed;
  expect(used === 13.75 + 56 + 5.5 + 5.5 + 12, "server creditsUsed " + used);
  const tile = await page.eval(`[...document.querySelectorAll(".tile")].find((t) => t.textContent.includes("Créditos usados")).querySelector(".value").textContent`);
  expect(tile === (92.75).toLocaleString("es-AR", { maximumFractionDigits: 2 }) || tile === "92,75", `tile shows ${tile}`);
  await page.shot("01-inicio");
});

await step("design system: header controls share 32px and one row, status pills differ by shape with no fill, Geist is embedded", async () => {
  await page.hash("#/acme/MLA1/creativos");
  await page.waitFor(`document.querySelectorAll(".item").length === 5`, "the creatives of the product");
  const ctl = await page.eval(`["cliente-sel", "buscar"].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { h: r.height, top: r.top }; })`);
  expect(ctl[0].h === 32 && ctl[1].h === 32, "header select / search heights: " + JSON.stringify(ctl));
  expect(ctl[0].top === ctl[1].top, "header select and search do not share one row: " + JSON.stringify(ctl));
  const pills = await page.eval(`["draft", "approved", "discarded"].map((s) => {
    const p = document.querySelector(".item .pill.st-" + s);
    if (!p) return null;
    const b = getComputedStyle(p, "::before");
    const own = getComputedStyle(p);
    return { s, shape: [b.width, b.height, b.borderTopLeftRadius, b.transform, b.clipPath, b.borderTopWidth, b.borderTopStyle, b.backgroundColor === "rgba(0, 0, 0, 0)" ? "hollow" : "filled"].join("|"),
      fill: own.backgroundColor + " " + own.backgroundImage };
  })`);
  expect(pills.every(Boolean), "missing status pills: " + JSON.stringify(pills));
  expect(new Set(pills.map((p) => p.shape)).size === 3, "draft / approved / discarded share a dot shape: " + JSON.stringify(pills.map((p) => p.shape)));
  for (const p of pills) expect(p.fill === "rgba(0, 0, 0, 0) none", `status ${p.s} has a background fill: ${p.fill}`);
  const tagRow = await page.eval(`(() => { const c = [...document.querySelectorAll(".item")].find((x) => x.querySelector(".tag.type") && x.querySelector(".pill")); return c ? [c.querySelector(".pill").getBoundingClientRect().height, c.querySelector(".tag.type").getBoundingClientRect().height] : null; })()`);
  expect(tagRow && tagRow[0] === tagRow[1], "type tag and status pill heights: " + JSON.stringify(tagRow));
  const font = await page.eval(`document.fonts.load("13px Geist").then(() => document.fonts.ready).then(() => ({
    check: document.fonts.check("13px Geist"),
    loaded: [...document.fonts].some((f) => f.family.replace(/["']/g, "") === "Geist" && f.status === "loaded"),
    body: getComputedStyle(document.body).fontFamily }))`);
  expect(font.check && font.loaded, "Geist is not embedded and loaded: " + JSON.stringify(font));
  expect(/^"?Geist"?,/.test(font.body), "body font stack does not start with Geist: " + font.body);
  await page.shot("01b-design-system");
});

await step("list cards: title and meta start at the same height across a row (2-line title, no status), long titles clamp to 2 lines with the full title kept, covers fill the frame, selected is accent + accent-soft, checkbox and badge share one shape", async () => {
  await page.hash("#/beta/MLB3/creativos");
  await page.waitFor(`document.querySelectorAll(".item.creative").length === 4`, "the four creatives of the alignment product");
  const cards = await page.eval(`[...document.querySelectorAll(".item.creative")].map((c) => {
    const t = c.querySelector("h3"); const m = c.querySelector(".meta"); const img = c.querySelector(".media img");
    const range = document.createRange(); range.selectNodeContents(t);
    return { title: t.textContent, attr: t.getAttribute("title"), row: Math.round(c.getBoundingClientRect().top), h3: t.getBoundingClientRect().top,
      meta: m ? m.getBoundingClientRect().top : null, box: t.getBoundingClientRect().height, text: range.getBoundingClientRect().height,
      lh: parseFloat(getComputedStyle(t).lineHeight), pill: !!c.querySelector(".pill"), fit: img ? getComputedStyle(img).objectFit : null,
      type: (c.querySelector(".tag.type") || {}).textContent || "" };
  })`);
  const by = (t) => cards.find((c) => c.title === t);
  const [largo, dos, sin, tres] = [by(LARGO), by(DOS), by("Sin estado todavía"), by("Tres pasos")];
  expect(largo && dos && sin && tres, "missing cards: " + JSON.stringify(cards.map((c) => c.title)));
  expect(!sin.pill, "the creative without status shows a status pill");
  expect(new Set(cards.map((c) => c.row)).size === 1, "the four cards are not in one row: " + JSON.stringify(cards.map((c) => c.row)));
  expect(dos.text > dos.lh * 1.5, `the two-line title fits in one line (text ${dos.text}px, line ${dos.lh}px)`);
  const spread = (k) => Math.max(...cards.map((c) => c[k])) - Math.min(...cards.map((c) => c[k]));
  expect(spread("h3") <= 1, "titles start at different heights: " + JSON.stringify(cards.map((c) => [c.title.slice(0, 12), c.h3])));
  expect(cards.every((c) => c.meta !== null) && spread("meta") <= 1, "meta lines start at different heights: " + JSON.stringify(cards.map((c) => [c.title.slice(0, 12), c.meta])));
  expect(largo.text > largo.lh * 2.5, "the long title is not longer than two lines, the clamp is not tested: " + largo.text);
  expect(largo.box <= largo.lh * 2 + 1, `the long title is not clamped to two lines (${largo.box}px)`);
  expect(cards.every((c) => c.attr === c.title), "the full title is not in the title attribute: " + JSON.stringify(cards.map((c) => c.attr)));
  expect(tres.type.startsWith("Carrusel") && tres.fit === "cover", "the carousel cover does not fill the frame: " + JSON.stringify([tres.type, tres.fit]));
  await page.eval(`document.querySelector(".item.creative").scrollIntoView({ block: "center" }), true`);
  await page.shot("01c-tarjetas-alineadas");
  // Selected: accent border + accent-soft fill (hover only strengthens the border).
  await page.pick("Sin estado todavía");
  const sel = await page.eval(`(() => {
    const c = [...document.querySelectorAll(".item")].find((x) => x.querySelector("h3").textContent === "Sin estado todavía");
    const probe = document.createElement("div"); probe.style.cssText = "background: var(--accent-soft); border: 1px solid var(--accent)"; document.body.append(probe);
    const want = getComputedStyle(probe); const got = getComputedStyle(c);
    const out = { bg: got.backgroundColor, border: got.borderTopColor, outline: got.outlineStyle, wantBg: want.backgroundColor, wantBorder: want.borderTopColor };
    probe.remove(); return out; })()`);
  expect(sel.bg === sel.wantBg && sel.border === sel.wantBorder, "selected card is not accent border + accent-soft fill: " + JSON.stringify(sel));
  await page.shot("01d-tarjeta-seleccionada");
  await page.pick("Sin estado todavía");
  expect(await page.eval(`state.selection.size === 0`), "the card did not unselect");
  // The checkbox overlay and the kind badge in search results are one shape.
  await page.hash("#/buscar?cliente=beta&tipo=creativo");
  await page.waitFor(`document.querySelectorAll(".item.creative .media .badge").length >= 4`, "search results with kind badges");
  const shapes = await page.eval(`(() => { const c = document.querySelector(".item.creative");
    return [c.querySelector(".pick"), c.querySelector(".media .badge")].map((el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return [r.height, s.borderTopLeftRadius, s.backgroundColor, s.borderTopColor, s.borderTopWidth].join("|") + "@" + Math.round(r.top); }); })()`);
  expect(shapes[0] === shapes[1], "checkbox overlay and corner badge differ in shape or top: " + JSON.stringify(shapes));
});

const MLA1_LIST = "#/acme/MLA1/creativos";
const srcOf = (p) => "/" + p; // studio path as the quick view shows it, thumbnail or full file
const quickView = (page) => page.eval(`(() => { const p = document.getElementById("vista-rapida"); if (!p || p.hidden) return null;
  const r = p.getBoundingClientRect();
  return { inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.width > 0,
    pieces: [...p.querySelectorAll("figure")].map((f) => { const i = f.querySelector("img");
      return f.querySelector("figcaption").textContent + "=" + (i ? decodeURIComponent(i.getAttribute("src").split("?")[0]).replace(/^\\/miniatura\\//, "/") : "none"); }) }; })()`);
const cardPoint = (page, titleText, part = ".media") => page.eval(`(() => {
  const c = [...document.querySelectorAll(".item")].find((x) => x.querySelector("h3").textContent === ${JSON.stringify(titleText)});
  if (!c) throw new Error("no card: " + ${JSON.stringify(titleText)});
  c.scrollIntoView({ block: "center" });
  const r = c.querySelector(${JSON.stringify(part)}).getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
// Screenshots of the quick view once its images are in and the fade is over.
const qvSettled = async (page) => { await page.waitFor(`[...document.querySelectorAll("#vista-rapida img")].every((i) => i.complete)`, "the quick view images", 4000); await sleep(200); };
const DOLOR_PIECES = ["4:5=" + srcOf(`${CR(ids.dolor)}/4x5-v2.png`), "9:16=" + srcOf(`${CR(ids.dolor)}/9x16-v2.png`)];

await step("quick view: hovering a creative card shows its current pieces after a short delay, carousels show every card, Escape and leaving close it, the route does not change and the checkbox stays clickable", async () => {
  await page.hash(MLA1_LIST);
  await page.waitFor(`document.querySelectorAll(".item").length === 5`, "the creatives of the product");
  await page.mouse(1, 1);
  const hash0 = await page.eval(`location.hash`);
  const d = await cardPoint(page, "Agacharse ya no duele");
  await sleep(150); // let the scroll settle before the pointer arrives
  await page.mouse(d.x, d.y);
  expect((await quickView(page)) === null, "the quick view opened at once, without the hover delay");
  await page.waitFor(`(() => { const p = document.getElementById("vista-rapida"); return !!p && !p.hidden && p.querySelectorAll("figure").length === 2; })()`, "the quick view of the static creative");
  let v = await quickView(page);
  expect(JSON.stringify(v.pieces) === JSON.stringify(DOLOR_PIECES), "static pieces: " + JSON.stringify(v.pieces));
  expect(v.inside, "the quick view leaves the viewport");
  const pick = await page.eval(`(() => { const c = [...document.querySelectorAll(".item")].find((x) => x.querySelector("h3").textContent === "Agacharse ya no duele");
    const r = c.querySelector(".pick").getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && hit.closest(".pick") === c.querySelector(".pick"); })()`);
  expect(pick, "the quick view covers the card checkbox");
  await qvSettled(page);
  await page.shot("02a-vista-rapida-estatica");
  // Another card: the carousel shows its cards 1…N (a card without an image says so).
  const k = await cardPoint(page, "Carrusel de tres pasos");
  await sleep(150);
  await page.mouse(k.x, k.y);
  await page.waitFor(`(() => { const p = document.getElementById("vista-rapida"); return !!p && !p.hidden && [...p.querySelectorAll("figcaption")].some((f) => f.textContent === "Tarjeta 1"); })()`, "the quick view of the carousel");
  v = await quickView(page);
  expect(JSON.stringify(v.pieces) === JSON.stringify(["Tarjeta 1=" + srcOf(`${CR(ids.carrusel)}/tarjeta-1-v2.png`), "Tarjeta 2=" + srcOf(`${CR(ids.carrusel)}/tarjeta-2-v1.png`), "Tarjeta 3=none"]),
    "carousel pieces: " + JSON.stringify(v.pieces));
  expect(v.inside, "the carousel quick view leaves the viewport");
  await qvSettled(page);
  await page.shot("02b-vista-rapida-carrusel");
  await page.key("Escape", 27);
  await page.waitFor(`document.getElementById("vista-rapida").hidden`, "Escape to close the quick view");
  // Leaving the card closes it too.
  const d2 = await cardPoint(page, "Agacharse ya no duele");
  await sleep(150);
  await page.mouse(d2.x, d2.y);
  await page.waitFor(`!document.getElementById("vista-rapida").hidden`, "the quick view again");
  await page.mouse(1, 1);
  await page.waitFor(`document.getElementById("vista-rapida").hidden`, "leaving the card to close the quick view");
  expect((await page.eval(`location.hash`)) === hash0, "hovering changed the route: " + (await page.eval(`location.hash`)));
});

await step("quick view: keyboard focus on the card link shows it, Escape and moving focus away close it", async () => {
  await page.hash(MLA1_LIST);
  await page.waitFor(`document.querySelectorAll(".item").length === 5`, "the creatives of the product");
  await page.mouse(1, 1);
  const hash0 = await page.eval(`location.hash`);
  await page.eval(`(() => { const c = [...document.querySelectorAll(".item")].find((x) => x.querySelector("h3").textContent === "Agacharse ya no duele");
    c.scrollIntoView({ block: "center" }); c.querySelector(".pick input").focus(); return true; })()`);
  await sleep(150);
  await page.key("Tab", 9);
  expect(await page.eval(`!!document.activeElement.closest(".cardlink") && document.activeElement.closest(".item").querySelector("h3").textContent === "Agacharse ya no duele"`),
    "Tab did not reach the card link");
  await page.waitFor(`(() => { const p = document.getElementById("vista-rapida"); return !!p && !p.hidden && p.querySelectorAll("figure").length === 2; })()`, "the quick view on keyboard focus");
  const v = await quickView(page);
  expect(JSON.stringify(v.pieces) === JSON.stringify(DOLOR_PIECES), "pieces on focus: " + JSON.stringify(v.pieces));
  await qvSettled(page);
  await page.shot("02c-vista-rapida-teclado");
  await page.key("Escape", 27);
  await page.waitFor(`document.getElementById("vista-rapida").hidden`, "Escape to close the quick view opened by focus");
  await page.key("Tab", 9);
  await sleep(500);
  expect(await page.eval(`document.getElementById("vista-rapida").hidden`), "the quick view stayed open after focus moved on");
  expect((await page.eval(`location.hash`)) === hash0, "keyboard focus changed the route");
});

await step("quick view: a touch tap on a card opens the detail and never shows the quick view", async () => {
  await page.hash(MLA1_LIST);
  await page.waitFor(`document.querySelectorAll(".item").length === 5`, "the creatives of the product");
  await page.eval(`(() => { window.__qvShown = false; new MutationObserver(() => { const p = document.getElementById("vista-rapida"); if (p && !p.hidden) window.__qvShown = true; })
    .observe(document.body, { subtree: true, attributes: true, childList: true }); return true; })()`);
  const d = await cardPoint(page, "Agacharse ya no duele");
  await sleep(150);
  await page.cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  try {
    await page.tap(d.x, d.y);
    await page.waitFor(`document.querySelector("h1") && document.querySelector("h1").textContent === "Agacharse ya no duele"`, "the tap to open the detail");
    await sleep(500);
  } finally { await page.cdp("Emulation.setTouchEmulationEnabled", { enabled: false }); }
  expect(await page.eval(`window.__qvShown === false`), "a touch tap showed the quick view");
  expect((await page.eval(`location.hash`)) === "#/elemento/" + CR(ids.dolor).split("/").map(encodeURIComponent).join("/"), "the tap did not open the detail: " + (await page.eval(`location.hash`)));
});

await step("cards and search results show the product and client names, creative type and pieces", async () => {
  await page.hash("#/buscar?tipo=creativo");
  await page.waitFor(`document.querySelectorAll(".item").length >= 3`, "search results");
  const cards = await page.eval(`[...document.querySelectorAll(".item.creative")].map((c) => c.querySelector("h3").textContent + " | " + c.querySelector(".meta").textContent + " | " + ((c.querySelector(".tag.type") || {}).textContent || ""))`);
  const dolor = cards.find((c) => c.startsWith("Agacharse"));
  has(dolor, "Acme SRL", "client name on the card");
  has(dolor, "Patas de madera para cama", "product title on the card");
  expect(!/MLA1/.test(dolor), "the product id is not shown when the title is known: " + dolor);
  has(dolor, "Estática · 2 piezas", "type and pieces");
  has(cards.find((c) => c.startsWith("Carrusel")), "Carrusel · 2 tarjetas", "carousel type and pieces");
  await page.hash("#/buscar?q=l%C3%A1mpara");
  await page.waitFor(`[...document.querySelectorAll(".item h3")].some((h) => h.textContent === "Lámpara de pie")`, "product search result");
  await page.hash("#/buscar?tipo=creativo");
  await page.waitFor(`document.querySelectorAll(".item").length >= 3`, "search results again");
  await page.eval(`window.scrollTo(0, 600)`);
  await page.shot("02-resultados-con-nombres");
  await page.eval(`window.scrollTo(0, 0)`);
});

await step("batch filter: the page asks the server (lote=) and shows only that batch, with a total from the server", async () => {
  await page.hash("#/acme/MLA1/creativos?lote=2026-11-17-patas-cama");
  await page.waitFor(`[...document.querySelectorAll(".item h3")].length === 2`, "the batch list");
  const titles = (await page.cardTitles()).sort();
  expect(JSON.stringify(titles) === JSON.stringify(["Carrusel de tres pasos", "Concepto descartado dos"]), "titles " + titles);
  // Archived are hidden, discarded are not: both creatives of that batch are shown.
  const urls = (await page.resources()).filter((u) => u.includes("/api/elementos") && u.includes("lote="));
  expect(urls.length > 0, "no request carried lote=");
  expect(urls.every((u) => u.includes("pagina=1")), "the batch is not read page by page on the client: " + urls.join(" "));
  has(await page.text("#app"), "Mostrando solo el lote", "batch note");
  await page.shot("03-lote");
  await page.hash("#/acme/MLA1/creativos");
  await page.waitFor(`document.querySelectorAll(".item").length === 5`, "all batches again");
});

await step("reopen: a discarded creative and a discarded video go back to draft from their detail view", async () => {
  await page.hash("#/elemento/" + CR(ids.desc).split("/").map(encodeURIComponent).join("/"));
  await page.waitFor(`document.querySelector("h1") && document.querySelector("h1").textContent === "Concepto descartado uno"`, "creative detail");
  const botones = await page.eval(`[...document.querySelectorAll(".actions button")].map((b) => b.textContent)`);
  expect(botones.includes("Reabrir"), "no Reabrir among " + botones);
  expect(!botones.includes("Descartar"), "a discarded creative cannot be discarded again");
  await page.shot("04-reabrir-creativo");
  await page.click("Reabrir", "document.querySelector('.actions')");
  await page.waitFor(`!!document.querySelector(".pill.st-draft")`, "the draft pill");
  expect(status(`${CR(ids.desc)}/creativo.json`) === "draft", "creative status on disk: " + status(`${CR(ids.desc)}/creativo.json`));
  has(await page.text("#resultado"), "reabierto", "result message");

  await page.hash("#/elemento/" + VID(V2).split("/").map(encodeURIComponent).join("/"));
  await page.waitFor(`document.querySelector("h1") && document.querySelector("h1").textContent === "Video descartado de prueba"`, "video detail");
  await page.click("Reabrir", "document.querySelector('.actions')");
  await page.waitFor(`!!document.querySelector(".pill.st-draft")`, "the draft pill on the video");
  expect(status(`${VID(V2)}/video.json`) === "draft", "video status on disk");
});

await step("ad copy: a video shows its Meta ad text with copy buttons like a creative; one without copy shows none", async () => {
  const adText = () => page.eval(`(() => { const g = [...document.querySelectorAll(".group")].find((x) => (x.querySelector(".label") || {}).textContent === "Texto del anuncio"); return g ? [...g.querySelectorAll(".copyrow")].map((r) => r.querySelector(".label").textContent + "=" + r.querySelector("p").textContent + "|" + r.querySelector("button").getAttribute("aria-label")) : null; })()`);
  await page.hash("#/elemento/" + VID(V1).split("/").map(encodeURIComponent).join("/"));
  await page.waitFor(`document.querySelector("h1") && document.querySelector("h1").textContent === "La cama pegada al piso"`, "video detail");
  const rows = await adText();
  expect(JSON.stringify(rows) === JSON.stringify([
    "Texto principal=Mi cama estaba pegada al piso y lo arreglé en 5 minutos.|Copiar texto principal",
    "Titular=Patas de madera para cama|Copiar titular",
    "Descripción=Envío gratis|Copiar descripción",
    "Botón=Comprar|Copiar botón",
    "Nombre del anuncio=MLA1_dolor_ana_video|Copiar nombre del anuncio",
  ]), "video ad text: " + JSON.stringify(rows));
  await page.shot("04b-video-texto-anuncio");

  await page.hash("#/elemento/" + VID(V2).split("/").map(encodeURIComponent).join("/"));
  await page.waitFor(`document.querySelector("h1") && document.querySelector("h1").textContent === "Video descartado de prueba"`, "video detail without copy");
  expect((await adText()) === null, "a video without copy shows no ad text group");

  await page.hash("#/elemento/" + CR(ids.dolor).split("/").map(encodeURIComponent).join("/"));
  await page.waitFor(`document.querySelector("h1") && document.querySelector("h1").textContent === "Agacharse ya no duele"`, "creative detail");
  const crows = await adText();
  expect(JSON.stringify(crows) === JSON.stringify([
    "Texto principal=Subí la cama 10 cm.|Copiar texto principal",
    "Titular=Patas de madera|Copiar titular",
    "Botón=Comprar|Copiar botón",
    "Nombre del anuncio=MLA1_dolor_ana_estatica|Copiar nombre del anuncio",
  ]), "creative ad text still shown: " + JSON.stringify(crows));
});

const detailOf = async (rel, h1) => {
  await page.hash("#/elemento/" + rel.split("/").map(encodeURIComponent).join("/"));
  await page.waitFor(`document.querySelector("h1") && document.querySelector("h1").textContent === ${JSON.stringify(h1)}`, "detail of " + h1);
};
const imgsLoaded = (sel) => page.waitFor(`[...document.querySelectorAll(${JSON.stringify(sel)})].every((i) => i.complete)`, "images of " + sel, 6000);
// Studio path of an <img> src, thumbnail or full file (the same form as srcOf).
const SRC = `(i) => i ? decodeURIComponent(i.getAttribute("src").split("?")[0]).replace(/^\\/miniatura\\//, "/") : null`;

await step("detail pieces: a static's 4:5 and 9:16 share one larger height, captions and older versions sit on one line; carousel cards keep a fixed 4:5 frame in one row", async () => {
  await detailOf(CR(ids.dolor), "Agacharse ya no duele");
  await imgsLoaded(".pieces img");
  const f = await page.eval(`[...document.querySelectorAll(".pieces figure")].map((x) => { const i = x.querySelector(".shot img").getBoundingClientRect();
    const o = x.querySelector(".olds");
    return { cls: x.className, img: i.height, cap: x.querySelector("figcaption").getBoundingClientRect().top, olds: o ? o.getBoundingClientRect().top : null }; })`);
  expect(f.length === 2 && /r4x5/.test(f[0].cls) && /r9x16/.test(f[1].cls), "pieces: " + JSON.stringify(f));
  expect(Math.abs(f[0].img - f[1].img) <= 1, "4:5 and 9:16 images differ in height: " + JSON.stringify(f));
  expect(f[0].img >= 440, "the pieces are not larger than before (4:5 was 375px, 9:16 400px): " + f[0].img);
  expect(Math.abs(f[0].cap - f[1].cap) <= 1, "captions are not on one line: " + JSON.stringify(f));
  expect(f[0].olds !== null && f[1].olds !== null && Math.abs(f[0].olds - f[1].olds) <= 1, "older versions are not on one line: " + JSON.stringify(f));
  await page.eval(`document.querySelector(".pieces").scrollIntoView({ block: "start" }), true`);
  await page.shot("04c-detalle-piezas-alineadas");

  await detailOf(CR(ids.carrusel), "Carrusel de tres pasos");
  const c = await page.eval(`[...document.querySelectorAll(".pieces figure .shot")].map((s) => { const r = s.getBoundingClientRect(); return { top: Math.round(r.top), h: r.height, ratio: getComputedStyle(s).aspectRatio }; })`);
  expect(c.length === 3, "carousel cards: " + JSON.stringify(c));
  expect(c.every((x) => x.ratio === "4 / 5"), "carousel frames are not a fixed 4:5 before the images load: " + JSON.stringify(c));
  expect(new Set(c.map((x) => x.top)).size === 1 && Math.max(...c.map((x) => x.h)) - Math.min(...c.map((x) => x.h)) <= 1, "carousel cards are not one row of one height (the missing card included): " + JSON.stringify(c));
  await detailOf(`${AL}/creativos/2026-11-18-x-tarjetas`, "Tres pasos");
  await imgsLoaded(".pieces img");
  const sq = await page.eval(`[...document.querySelectorAll(".pieces figure .shot")].map((s) => getComputedStyle(s).aspectRatio + "|" + getComputedStyle(s.querySelector("img")).objectFit)`);
  expect(JSON.stringify(sq) === JSON.stringify(["4 / 5|contain", "4 / 5|contain"]), "square cards are not shown whole in the 4:5 frame: " + JSON.stringify(sq));
});

const mock = () => page.eval(`(() => { const m = document.querySelector(".admock"); if (!m) return null; const t = (s) => { const e = m.querySelector(s); return e ? e.textContent : null; };
  const av = m.querySelector(".am-avatar");
  return { stories: m.classList.contains("stories"), name: t(".am-name"), sub: t(".am-sub"), avatar: av ? (av.querySelector("img") ? "img:" + decodeURIComponent(av.querySelector("img").getAttribute("src")) : "text:" + av.textContent) : null,
    text: t(".am-text"), note: t(".am-note"), headline: t(".am-headline"), desc: t(".am-desc"), cta: t(".am-cta"), img: (${SRC})(m.querySelector(".am-media img")),
    video: !!m.querySelector(".am-media video"), modes: [...document.querySelectorAll(".admock-bar [data-modo]")].map((b) => b.textContent + "=" + b.getAttribute("aria-pressed")) }; })()`);
const toMock = () => page.eval(`document.querySelector(".admock").scrollIntoView({ block: "center" }), true`);
const modo = (name) => page.eval(`(() => { const b = [...document.querySelectorAll(".admock-bar button")].find((x) => x.textContent === ${JSON.stringify(name)}); if (!b) throw new Error("no preview button: ${name}"); b.click(); return true; })()`);

await step("ad preview: a creative with copy shows its text, headline and button around the 4:5 piece under the client's name; Stories swaps to the 9:16 with the covered zones; without copy a neutral note and no button", async () => {
  await detailOf(CR(ids.dolor), "Agacharse ya no duele");
  let m = await mock();
  expect(m, "no ad preview in the creative detail");
  expect(m.name === "Acme SRL" && m.sub === "Publicidad" && m.avatar === "text:A", "ad header (client, Publicidad, initial without a logo): " + JSON.stringify(m));
  expect(m.text === "Subí la cama 10 cm." && m.headline === "Patas de madera" && m.cta === "Comprar" && m.desc === null && m.note === null, "ad text: " + JSON.stringify(m));
  expect(!m.stories && m.img === srcOf(`${CR(ids.dolor)}/4x5-v2.png`), "feed preview shows " + m.img);
  expect(JSON.stringify(m.modes) === JSON.stringify(["Feed=true", "Stories=false"]), "preview modes: " + JSON.stringify(m.modes));
  await toMock();
  await page.shot("04d-anuncio-feed");
  await modo("Stories");
  m = await mock();
  expect(m.stories && m.img === srcOf(`${CR(ids.dolor)}/9x16-v2.png`) && m.cta === "Comprar", "stories preview: " + JSON.stringify(m));
  expect(JSON.stringify(m.modes) === JSON.stringify(["Feed=false", "Stories=true"]), "preview modes in stories: " + JSON.stringify(m.modes));
  await modo("Zonas tapadas");
  const z = await page.eval(`(() => { const f = document.querySelector(".admock").getBoundingClientRect(); const [t, b] = [...document.querySelectorAll(".admock .am-zone")].map((e) => e.getBoundingClientRect());
    return { top: Math.abs(t.height - f.height * .14) <= 1.5 && Math.abs(t.top - f.top) <= 1.5, bottom: Math.abs(b.height - f.height * .35) <= 1.5 && Math.abs(b.bottom - f.bottom) <= 1.5, vis: [t.height, b.height, f.height] }; })()`);
  expect(z.top && z.bottom, "covered zones are not the top 14% and bottom 35% of the story: " + JSON.stringify(z.vis));
  await toMock();
  await page.shot("04e-anuncio-stories");
  await modo("Feed");
  m = await mock();
  expect(!m.stories && m.img === srcOf(`${CR(ids.dolor)}/4x5-v2.png`), "back to feed shows " + m.img);

  await detailOf(CR(ids.precio), "Precio bajo, piso firme");
  m = await mock();
  expect(m && m.note === "Todavía no tiene texto del anuncio", "no-copy note: " + JSON.stringify(m));
  expect(m.cta === null && m.text === null && m.headline === null && m.desc === null, "a creative without copy shows invented text or a button: " + JSON.stringify(m));
  expect(m.img === srcOf(`${CR(ids.precio)}/4x5-v1.png`) && m.modes.length === 0, "without a 9:16 there is no Stories toggle and the 4:5 is shown: " + JSON.stringify(m));

  await detailOf(AD, "Luz que no encandila");
  m = await mock();
  expect(m.avatar === "img:/clientes/beta/marca/logo.png" && m.name === "Beta Hogar", "client logo in the ad header: " + JSON.stringify(m));
  expect(m.text !== AD_TEXT && m.text.endsWith("… Ver más") && AD_TEXT.startsWith(m.text.slice(0, -"… Ver más".length)) && m.text.length - "… Ver más".length <= 125,
    "a text longer than 125 characters is not cut with «… Ver más»: " + m.text);
  expect(m.headline === "Velador de noche" && m.desc === "Envío gratis a todo el país" && m.cta === "Más información", "headline, description and button: " + JSON.stringify(m));
  await page.eval(`document.querySelector(".admock .am-more").click(), true`);
  expect((await mock()).text === AD_TEXT, "«Ver más» does not show the whole text");
  await toMock();
  await page.shot("04f-anuncio-texto-largo");
});

await step("detail: copy buttons sit on the first line of every row, facts are one hairline list without holes (12px --text-3 labels)", async () => {
  await detailOf(AD, "Luz que no encandila");
  const rows = await page.eval(`[...document.querySelectorAll(".copyrow")].map((r) => { const t = r.getBoundingClientRect().top;
    const mid = (el) => { const b = el.getBoundingClientRect(); return Math.round(b.top + b.height / 2 - t); };
    return { btn: mid(r.querySelector("button")), label: mid(r.querySelector(".label")), h: r.getBoundingClientRect().height }; })`);
  expect(rows.length === 4 && rows[0].h > rows[1].h, "copy rows (the first one wraps): " + JSON.stringify(rows));
  expect(new Set(rows.map((r) => r.btn)).size === 1 && rows.every((r) => Math.abs(r.btn - r.label) <= 2), "Copiar buttons are not centered on the first line of each row: " + JSON.stringify(rows));
  const facts = await page.eval(`(() => { const l = document.querySelector(".facts"); const lr = l.getBoundingClientRect();
    const probe = document.createElement("span"); probe.style.color = "var(--text-3)"; document.body.append(probe); const want = getComputedStyle(probe).color; probe.remove();
    return { tag: l.tagName, rows: [...l.children].map((f) => { const r = f.getBoundingClientRect(); const dt = f.querySelector("dt"); const s = dt ? getComputedStyle(dt) : {};
      return { left: Math.round(r.left - lr.left), right: Math.round(lr.right - r.right), dt: dt ? dt.textContent : null, dd: (f.querySelector("dd") || {}).textContent || "", size: s.fontSize, color: s.color === want, line: getComputedStyle(f).borderBottomStyle }; }) }; })()`);
  expect(facts.tag === "DL" && facts.rows.length >= 3, "facts are not a description list: " + JSON.stringify(facts));
  expect(facts.rows.every((r) => r.dt && r.dd && r.left === facts.rows[0].left && r.right === facts.rows[0].right), "facts have holes or empty rows: " + JSON.stringify(facts.rows));
  expect(facts.rows.every((r) => r.size === "12px" && r.color), "fact labels are not 12px --text-3: " + JSON.stringify(facts.rows));
  expect(facts.rows.slice(0, -1).every((r) => r.line === "solid"), "fact rows are not split by hairlines: " + JSON.stringify(facts.rows));
});

await step("ad preview (video): the video plays inside the feed ad with its copy; a video without copy shows the note", async () => {
  await detailOf(VID(V1), "La cama pegada al piso");
  let m = await mock();
  expect(m && m.video, "no video inside the ad preview: " + JSON.stringify(m));
  expect(m.text === "Mi cama estaba pegada al piso y lo arreglé en 5 minutos." && m.headline === "Patas de madera para cama" && m.desc === "Envío gratis" && m.cta === "Comprar",
    "video ad text: " + JSON.stringify(m));
  expect(JSON.stringify(m.modes) === JSON.stringify(["Feed=true", "Stories=false"]), "video preview modes: " + JSON.stringify(m.modes));
  await modo("Stories");
  m = await mock();
  expect(m.stories && m.video && m.cta === "Comprar", "video stories preview: " + JSON.stringify(m));
  await toMock();
  await page.shot("04g-anuncio-video");
  await detailOf(VID(V2), "Video descartado de prueba");
  m = await mock();
  expect(m && m.note === "Todavía no tiene texto del anuncio" && m.cta === null && m.text === null, "video without copy: " + JSON.stringify(m));
});

await step("reopen in multi-select: the bar button reopens the discarded ones and says so for the rest", async () => {
  await page.hash("#/buscar?tipo=creativo&estado=discarded");
  await page.waitFor(`document.querySelectorAll(".item").length === 1`, "discarded creatives");
  await page.pick("Concepto descartado dos");
  await page.waitFor(`!document.getElementById("barra").hidden`, "the selection bar");
  const bar = await page.text("#barra");
  has(bar, "Reabrir", "bar");
  await page.click("Reabrir", 'document.getElementById("barra")');
  await page.waitFor(`document.getElementById("resultado") && !document.getElementById("resultado").hidden`, "result panel");
  expect(status(`${CR(ids.desc2)}/creativo.json`) === "draft", "bulk reopen on disk");
});

await step("clean versions: a failed dry run is not 'nothing to clean'; it names the items that could not be checked and the rest is still offered", async () => {
  const stub = (needle) => page.eval(`(() => { window.__fetch0 = window.__fetch0 || window.fetch;
    window.fetch = (u, o) => String(u).includes("/api/versiones-antiguas") && String(u).includes(${JSON.stringify(needle)})
      ? Promise.resolve(new Response(JSON.stringify({ error: "the studio is still being indexed" }), { status: 503, headers: { "Content-Type": "application/json" } }))
      : window.__fetch0(u, o); return true; })()`);
  const unstub = () => page.eval(`(() => { if (window.__fetch0) window.fetch = window.__fetch0; return true; })()`);
  const antes = JSON.stringify([ls(CR(ids.dolor)), ls(CR(ids.carrusel))]);
  try {
    await page.hash("#/buscar?tipo=creativo");
    await page.waitFor(`document.querySelectorAll(".item").length >= 3`, "creatives");
    await page.pick("Agacharse ya no duele");
    await page.pick("Carrusel de tres pasos");
    await page.waitFor(`!document.getElementById("barra").hidden`, "the bar");
    // One item fails: the dialog offers the other one and says which could not be checked.
    await stub("x-pasos");
    await page.click("Limpiar versiones", 'document.getElementById("barra")');
    await page.waitFor(`!document.getElementById("dialogo").hidden`, "the confirmation");
    const dlg = await page.text("#dialogo");
    has(dlg, "2 archivos", "total of the item that could be checked");
    has(dlg, "Agacharse ya no duele (2 archivos)", "checked item");
    has(dlg, "No se pudo revisar 1 elemento (Carrusel de tres pasos)", "unchecked item");
    has(dlg, "Probá de nuevo", "retry hint");
    await page.shot("07a-limpiar-revision-parcial");
    await page.click("Cancelar", 'document.getElementById("dialogo")');
    await page.waitFor(`document.getElementById("dialogo").hidden`, "the dialog to close");
    // Every dry run fails: no dialog and never "No hay versiones viejas".
    await unstub();
    await stub("");
    await page.click("Limpiar versiones", 'document.getElementById("barra")');
    await page.waitFor(`document.getElementById("estado").textContent.includes("No se pudo revisar")`, "the could-not-check message");
    const msg = await page.text("#estado");
    has(msg, "Agacharse ya no duele", "first unchecked item");
    has(msg, "Carrusel de tres pasos", "second unchecked item");
    has(msg, "Probá de nuevo", "retry hint");
    expect(!msg.includes("No hay versiones viejas"), "a failed dry run was reported as nothing to clean: " + msg);
    expect(await page.eval(`document.getElementById("dialogo").hidden`), "a dialog opened with nothing known");
    await page.shot("07b-limpiar-revision-fallida");
  } finally { await unstub(); }
  expect(JSON.stringify([ls(CR(ids.dolor)), ls(CR(ids.carrusel))]) === antes, "files changed during dry runs");
  await page.click("Limpiar selección", 'document.getElementById("barra")');
});

await step("clean versions (detail): dry run first, confirmation names the file count, cancel changes nothing, confirm moves them", async () => {
  await page.hash("#/elemento/" + VID(V1).split("/").map(encodeURIComponent).join("/"));
  await page.waitFor(`document.querySelector("h1") && document.querySelector("h1").textContent === "La cama pegada al piso"`, "video detail");
  const before = ls(VID(V1));
  await page.click("Limpiar versiones viejas", "document.querySelector('.actions')");
  await page.waitFor(`!document.getElementById("dialogo").hidden`, "the confirmation");
  const dlg = await page.text("#dialogo");
  has(dlg, "4 archivos", "file count in the confirmation");
  has(dlg, "La cama pegada al piso (4 archivos)", "item line");
  expect((await page.resources()).some((u) => u.includes("/api/versiones-antiguas?")), "no dry-run GET before the dialog");
  expect(JSON.stringify(ls(VID(V1))) === JSON.stringify(before), "the dry run moved something");
  await page.shot("05-limpiar-confirmacion");
  await page.click("Cancelar", 'document.getElementById("dialogo")');
  await page.waitFor(`document.getElementById("dialogo").hidden`, "the dialog to close");
  expect(JSON.stringify(ls(VID(V1))) === JSON.stringify(before), "cancel changed files");
  await page.click("Limpiar versiones viejas", "document.querySelector('.actions')");
  await page.waitFor(`!document.getElementById("dialogo").hidden`, "the confirmation again");
  await page.click("Mover 4 archivos", 'document.getElementById("dialogo")');
  await page.waitFor(`document.getElementById("resultado") && !document.getElementById("resultado").hidden && document.getElementById("resultado").textContent.includes("4 archivos a la papelera")`, "the result");
  expect(JSON.stringify(ls(VID(V1))) === JSON.stringify(["borrador-v3.mp4", "final.mp4", "prompt-v1.md", "thumb-v3.jpg", "video.json"]), "left: " + ls(VID(V1)));
  expect(fs.readdirSync(path.join(studio, ".papelera")).length === 5, "trash entries (1 old + 4 moved): " + fs.readdirSync(path.join(studio, ".papelera")).length);
  await page.shot("06-limpiar-resultado");
  // Nothing left to clean: it says so instead of asking.
  await page.click("Limpiar versiones viejas", "document.querySelector('.actions')");
  await page.waitFor(`document.getElementById("estado").textContent.includes("No hay versiones viejas")`, "the nothing-to-clean message");
  expect(await page.eval(`document.getElementById("dialogo").hidden`), "no dialog when there is nothing to clean");
});

await step("clean versions (multi-select): one dry run per item, a single confirmation with the total", async () => {
  await page.hash("#/buscar?tipo=creativo");
  await page.waitFor(`document.querySelectorAll(".item").length >= 3`, "creatives");
  await page.pick("Agacharse ya no duele");
  await page.pick("Carrusel de tres pasos");
  await page.pick("Precio bajo, piso firme");
  await page.waitFor(`!document.getElementById("barra").hidden`, "the bar");
  await page.click("Limpiar versiones", 'document.getElementById("barra")');
  await page.waitFor(`!document.getElementById("dialogo").hidden`, "the confirmation");
  const dlg = await page.text("#dialogo");
  has(dlg, "3 archivos", "total");
  has(dlg, "Agacharse ya no duele (2 archivos)", "first item");
  has(dlg, "Carrusel de tres pasos (1 archivo)", "second item");
  expect(!dlg.includes("Precio bajo"), "an item with nothing to clean is not listed");
  await page.shot("07-limpiar-multiple");
  await page.click("Mover 3 archivos", 'document.getElementById("dialogo")');
  await page.waitFor(`document.getElementById("resultado") && document.getElementById("resultado").textContent.includes("3 archivos a la papelera")`, "the result");
  expect(JSON.stringify(ls(CR(ids.dolor))) === JSON.stringify(["4x5-v2.png", "9x16-v2.png", "creativo.json"]), "dolor: " + ls(CR(ids.dolor)));
  expect(JSON.stringify(ls(CR(ids.carrusel))) === JSON.stringify(["creativo.json", "tarjeta-1-v2.png", "tarjeta-2-v1.png"]), "carrusel: " + ls(CR(ids.carrusel)));
});

await step("empty trash: the tab shows the count; 30-day and full emptying each ask with the count and delete only what they said", async () => {
  await page.hash("#/papelera");
  await page.waitFor(`document.querySelectorAll(".row").length === 8`, "8 trash entries (1 old, 4 + 3 from cleaning)");
  expect((await page.text('[data-nav="papelera"]')).includes("8"), "tab count: " + (await page.text('[data-nav="papelera"]')));
  await page.shot("08-papelera");
  const total = () => fs.readdirSync(path.join(studio, ".papelera")).length;
  await page.click("Vaciar lo de más de 30 días", "document.getElementById('app')");
  await page.waitFor(`!document.getElementById("dialogo").hidden`, "the 30-day confirmation");
  has(await page.text("#dialogo"), "1 elemento", "count of the 30-day confirmation");
  has(await page.text("#dialogo"), "más de 30 días", "wording");
  await page.shot("09-vaciar-30-dias");
  await page.click("Cancelar", 'document.getElementById("dialogo")');
  await page.waitFor(`document.getElementById("dialogo").hidden`, "the dialog to close");
  expect(total() === 8, "cancel deleted something: " + total());
  await page.click("Vaciar lo de más de 30 días", "document.getElementById('app')");
  await page.waitFor(`!document.getElementById("dialogo").hidden`, "the 30-day confirmation again");
  await page.click("Eliminar 1 elemento", 'document.getElementById("dialogo")');
  await page.waitFor(`document.querySelectorAll(".row").length === 7`, "7 rows after the 30-day emptying");
  expect(total() === 7 && !disk(".papelera/2020-01-01T000000Z-abcdef"), "old entry not removed or too much removed: " + total());

  await page.click("Vaciar papelera", "document.getElementById('app')");
  await page.waitFor(`!document.getElementById("dialogo").hidden`, "the full confirmation");
  has(await page.text("#dialogo"), "7 elementos", "count of the full confirmation");
  await page.shot("10-vaciar-todo");
  await page.click("Cancelar", 'document.getElementById("dialogo")');
  await page.waitFor(`document.getElementById("dialogo").hidden`, "the dialog to close");
  expect(total() === 7, "cancel deleted something");
  await page.click("Vaciar papelera", "document.getElementById('app')");
  await page.waitFor(`!document.getElementById("dialogo").hidden`, "the full confirmation again");
  await page.click("Eliminar 7 elementos", 'document.getElementById("dialogo")');
  await page.waitFor(`document.getElementById("app").textContent.includes("La papelera está vacía")`, "the empty trash");
  expect(total() === 0, "left in the trash: " + total());
  expect((await page.text('[data-nav="papelera"]')).trim() === "Papelera", "tab with an empty trash: «" + (await page.text('[data-nav="papelera"]')) + "»");
  expect((await page.eval(`[...document.querySelectorAll("#app button")].filter((b) => b.textContent.startsWith("Vaciar")).length`)) === 0, "empty buttons shown on an empty trash");
  await page.shot("11-papelera-vacia");
});

await step("empty trash is bound to the confirmed ids: an item trashed while the dialog is open survives, and the request carries the ids", async () => {
  const total = () => fs.readdirSync(path.join(studio, ".papelera")).length;
  const LATE = `${CR(ids.dolor)}/9x16-v2.png`; // a single file: trashed after the dialog was drawn
  const res = await api("/api/acciones", { method: "POST", body: JSON.stringify({ acciones: [{ tipo: "papelera", ruta: CR(ids.desc) }, { tipo: "papelera", ruta: CR(ids.desc2) }] }) });
  expect(res.resultados.every((r) => r.ok), "could not trash the fixtures: " + JSON.stringify(res));
  const confirmed = res.resultados.map((r) => r.id).sort();
  await page.hash("#/papelera");
  await page.waitFor(`document.querySelectorAll(".row").length === 2`, "2 trash entries");
  await page.eval(`(() => { window.__vaciar = []; window.__fetch1 = window.fetch;
    window.fetch = (u, o) => { if (String(u).includes("/api/papelera/vaciar")) window.__vaciar.push(String(o && o.body)); return window.__fetch1(u, o); }; return true; })()`);
  try {
    await page.click("Vaciar papelera", "document.getElementById('app')");
    await page.waitFor(`!document.getElementById("dialogo").hidden`, "the confirmation");
    has(await page.text("#dialogo"), "2 elementos", "count in the dialog");
    // This one arrives after the user was shown the list.
    const late = await api("/api/acciones", { method: "POST", body: JSON.stringify({ acciones: [{ tipo: "papelera", ruta: LATE }] }) });
    expect(late.resultados[0].ok, "could not trash the late item: " + JSON.stringify(late));
    expect(total() === 3, "trash entries before confirming: " + total());
    await page.click("Eliminar 2 elementos", 'document.getElementById("dialogo")');
    await page.waitFor(`document.getElementById("estado").textContent.includes("Se eliminaron 2 elementos")`, "the result message");
  } finally { await page.eval(`(() => { if (window.__fetch1) window.fetch = window.__fetch1; return true; })()`); }
  expect(total() === 1 && disk(`.papelera/${late_id()}`), "only the late entry should be left: " + fs.readdirSync(path.join(studio, ".papelera")));
  const bodies = await page.eval(`window.__vaciar`);
  expect(bodies.length === 1, "vaciar requests: " + bodies.length);
  const sent = JSON.parse(bodies[0]);
  expect(JSON.stringify([...sent.ids].sort()) === JSON.stringify(confirmed) && !("antesDe" in sent), "the request must carry exactly the confirmed ids: " + bodies[0]);
  await page.waitFor(`document.querySelectorAll(".row").length === 1`, "the late entry still listed");
  await page.shot("11b-vaciar-con-ids");
  // Leave the trash empty for the next steps, through the same button.
  await page.click("Vaciar papelera", "document.getElementById('app')");
  await page.waitFor(`!document.getElementById("dialogo").hidden`, "the confirmation for the last entry");
  await page.click("Eliminar 1 elemento", 'document.getElementById("dialogo")');
  await page.waitFor(`document.getElementById("app").textContent.includes("La papelera está vacía")`, "the empty trash");
  expect(total() === 0, "left: " + total());
  function late_id() { return fs.readdirSync(path.join(studio, ".papelera")).find((d) => d && fs.existsSync(path.join(studio, ".papelera", d, LATE))) || "?"; }
});

await step("busy refresh: a change that arrives while something is selected is drawn once the selection is cleared", async () => {
  await page.hash("#/buscar?tipo=creativo");
  await page.waitFor(`document.querySelectorAll(".item").length >= 3`, "creatives");
  await page.pick("Precio bajo, piso firme");
  await page.waitFor(`state.selection.size === 1`, "the selection");
  json(`${CR("2026-11-17-x-nueva")}/creativo.json`, { id: "2026-11-17-x-nueva", title: "Pieza que llegó mientras seleccionaba", type: "static", status: "draft", slots: ["4x5"], updatedAt: "2026-11-17T15:00:00Z" });
  const t0 = Date.now();
  while (Date.now() - t0 < 5000 && !(await api("/api/elementos?q=llego+mientras")).total) await sleep(80);
  await page.eval(`poll()`);
  expect(await page.eval(`state.pendingRefresh === true`), "the skipped redraw was not remembered");
  expect(!(await page.cardTitles()).includes("Pieza que llegó mientras seleccionaba"), "the view was redrawn under the selection");
  expect(await page.eval(`state.selection.size === 1`), "the selection was lost");
  expect((await page.text("#nav")).replace(/\s+/g, " ").trim() === "Inicio Actores Papelera", "nav text: «" + (await page.text("#nav")) + "»");
  await page.shot("12-seleccion-con-cambio-pendiente");
  await page.click("Limpiar selección", 'document.getElementById("barra")');
  await page.waitFor(`[...document.querySelectorAll(".item h3")].some((h) => h.textContent === "Pieza que llegó mientras seleccionaba")`, "the pending refresh after the selection is cleared", 4000);
  expect(await page.eval(`state.pendingRefresh === false`), "the pending flag was not reset");
  await page.shot("13-refresco-pendiente-dibujado");
});

await step("viewer: studio images open in an in-page viewer (no new tab), arrows move, Escape and Back close it", async () => {
  const detail = "#/elemento/" + VIS.split("/").map(encodeURIComponent).join("/");
  await page.hash(detail);
  await page.waitFor(`document.querySelector("h1") && document.querySelector("h1").textContent === "Piezas para el visor"`, "creative detail");
  const local = await page.eval(`[...document.querySelectorAll("#app a[target=_blank]")].filter((a) => a.href.startsWith(location.origin)).length`);
  expect(local === 0, local + " studio file link(s) still open a new tab");
  const links = await page.eval(`[...document.querySelectorAll("#app a[data-visor]")].map((a) => a.getAttribute("href"))`);
  expect(links.length === 3, "viewer links: " + JSON.stringify(links));
  const histLen = await page.eval(`history.length`);
  await page.eval(`document.querySelector("#app a[data-visor]").click(), true`);
  await page.waitFor(`!document.getElementById("visor").hidden`, "the viewer to open");
  expect(await page.eval(`location.hash`) === detail, "opening the viewer changed the route");
  const src0 = await page.eval(`document.querySelector("#visor img").getAttribute("src")`);
  expect(src0 === links[0], `viewer shows ${src0}, expected ${links[0]}`);
  has(await page.text("#visor"), "1 de " + links.length, "viewer counter");
  await page.shot("14-visor-abierto");
  await page.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })), true`);
  await page.waitFor(`document.querySelector("#visor img").getAttribute("src") === ${JSON.stringify(links[1])}`, "ArrowRight to show the next image");
  await page.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })), true`);
  await page.waitFor(`document.querySelector("#visor img").getAttribute("src") === ${JSON.stringify(links[0])}`, "ArrowLeft to go back");
  await page.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })), true`);
  await page.waitFor(`document.getElementById("visor").hidden`, "Escape to close the viewer");
  await page.waitFor(`history.length === ${histLen} || location.hash === ${JSON.stringify(detail)}`, "history to settle");
  expect(await page.eval(`location.hash`) === detail, "Escape left the detail view");
  expect(await page.eval(`document.activeElement === document.querySelector("#app a[data-visor]")`), "focus did not return to the clicked image");
  // The browser Back button closes the viewer and stays on the same view.
  await page.eval(`document.querySelectorAll("#app a[data-visor]")[1].click(), true`);
  await page.waitFor(`!document.getElementById("visor").hidden`, "the viewer to reopen");
  await page.eval(`history.back(), true`);
  await page.waitFor(`document.getElementById("visor").hidden`, "Back to close the viewer");
  await sleep(150);
  expect(await page.eval(`location.hash`) === detail, "Back left the detail view: " + (await page.eval(`location.hash`)));
  // Clicking the dark backdrop closes it too.
  await page.eval(`document.querySelector("#app a[data-visor]").click(), true`);
  await page.waitFor(`!document.getElementById("visor").hidden`, "the viewer to open again");
  await page.eval(`document.getElementById("visor").dispatchEvent(new MouseEvent("click", { bubbles: true })), true`);
  await page.waitFor(`document.getElementById("visor").hidden`, "a backdrop click to close the viewer");
  await sleep(150);
  expect(await page.eval(`location.hash`) === detail, "the backdrop click left the detail view");
  // Product photos use the same viewer.
  await page.hash("#/acme/MLA1/fotos");
  await page.waitFor(`!!document.querySelector(".photos a")`, "product photos");
  expect(await page.eval(`!document.querySelector(".photos a[target=_blank]") && !!document.querySelector(".photos a[data-visor]")`), "product photos still open a new tab");
});

await page.close();

await step("without AbortSignal.timeout (Safari < 16) the connection check works and shows no 'desconectada' banner", async () => {
  const old = await openPage(`try { Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true }); } catch (e) {}`);
  await login(old);
  expect(await old.eval(`typeof AbortSignal.timeout === "undefined"`), "the test did not remove AbortSignal.timeout");
  await old.eval(`poll()`);
  await old.waitFor(`!poll.running`, "poll to finish");
  expect(await old.eval(`document.getElementById("banner").hidden && state.conn === "ok"`), "banner: " + (await old.text("#banner")));
  // And a real outage is still detected through the fallback signal.
  await old.eval(`window.__fetch = window.fetch; window.fetch = (u, o) => String(u).includes("/api/salud") ? Promise.reject(new TypeError("offline")) : window.__fetch(u, o)`);
  await old.eval(`poll()`);
  await old.waitFor(`state.conn === "down" && !document.getElementById("banner").hidden`, "the banner on a real failure");
  await old.close();
});

// ---------- done ----------

try { ws.close(); } catch { /* ignore */ }
chrome.kill("SIGTERM");
await srv.close();
await sleep(300);
for (const d of scratch) fs.rmSync(d, { recursive: true, force: true });
console.log(fails ? `\n${fails} step(s) failed.` : "\nAll steps passed.");
process.exit(fails ? 1 : 0);
