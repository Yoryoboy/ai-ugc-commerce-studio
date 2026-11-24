#!/usr/bin/env node
// UGC Studio gallery server.
//
//   node servidor.mjs --studio <studio folder> [--port <base port>]
//
// Indexes the studio in memory, serves the gallery, the studio files and thumbnails, and applies
// actions (status, archive, trash, restore). Built-in modules only, Node >= 18. Listens on
// 127.0.0.1 only, with no access token: the address opens with one click. What protects it is, on
// every request, the Host check (DNS rebinding) and the Sec-Fetch-Site check (a page of another site
// cannot read or change anything; only a link to "/" may be followed from anywhere), and on POST the
// Origin and application/json checks. State (pid, port) goes to <studio>/.galeria/servidor.json.
// Started and stopped by scripts/galeria.sh. See references/workspace.md for the folder contract.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const GALERIA_HTML = path.join(AQUI, "..", "galeria", "galeria.html");
const BASE_PORT = 4317;
export const PORT_TRIES = 21; // 4317 … 4337
const MAX_BODY = 1024 * 1024;
const MAX_ACCIONES = 500;
const ROOTS = new Set(["actores", "clientes"]);
const KIND_ORDER = ["actor", "product", "brand", "video", "creative"];
const KIND_ALIAS = {
  actor: "actor", product: "product", producto: "product", brand: "brand", marca: "brand",
  video: "video", creative: "creative", creativo: "creative",
};
const JSON_NAME = { actor: "actor.json", product: "producto.json", brand: "marca.json", video: "video.json", creative: "creativo.json" };
const ESTADOS = {
  creative: ["draft", "approved", "discarded"],
  video: ["storyboard", "draft", "final", "discarded"],
};
const ANCHOS = [240, 480, 960];
const MAX_IDS_VACIAR = 20000;
const ID_PAPELERA = /^\d{4}-\d{2}-\d{2}T\d{6}Z-[0-9a-f]{6}$/;
const SLOT_ORDER = ["4x5", "9x16", "1x1"];
const TIPOS = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
  ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".zip": "application/zip",
};
const IMAGENES = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const VIDEOS = new Set([".mp4", ".m4v", ".mov", ".webm"]);

class ErrorHttp extends Error {
  constructor(status, mensaje, cabeceras = {}) { super(mensaje); this.status = status; this.cabeceras = cabeceras; }
}
class ErrorAccion extends Error {}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const isoSeg = (d = new Date()) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esObjeto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const str = (x) => (typeof x === "string" && x !== "" ? x : null);

// ---------- paths ----------

// Splits a relative studio path into safe segments: no empty, ".", "..", separators, NUL or dot-files.
function segmentos(ruta) {
  if (typeof ruta !== "string" || ruta === "" || ruta.includes("\0") || ruta.includes("\\")) return null;
  const segs = ruta.split("/");
  for (const s of segs) if (s === "" || s === "." || s === ".." || s.startsWith(".")) return null;
  return segs;
}

function dentro(raiz, abs) {
  return abs === raiz || abs.startsWith(raiz + path.sep);
}

// ---------- entity reading ----------

function listarArchivos(dirAbs, prefijo = "") {
  let entradas;
  try { entradas = fs.readdirSync(dirAbs, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const d of entradas) {
    if (d.name.startsWith(".")) continue;
    let ok = d.isFile();
    if (!ok && d.isSymbolicLink()) {
      try { ok = fs.statSync(path.join(dirAbs, d.name)).isFile(); } catch { ok = false; }
    }
    if (ok) out.push(prefijo + d.name);
  }
  return out.sort(cmp);
}

function listarCarpetas(dirAbs) {
  let entradas;
  try { entradas = fs.readdirSync(dirAbs, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const d of entradas) {
    if (d.name.startsWith(".")) continue;
    let ok = d.isDirectory();
    if (!ok && d.isSymbolicLink()) {
      try { ok = fs.statSync(path.join(dirAbs, d.name)).isDirectory(); } catch { ok = false; }
    }
    if (ok) out.push(d.name);
  }
  return out.sort(cmp);
}

const mtimeDe = (abs) => { try { return fs.statSync(abs).mtimeMs; } catch { return null; } };

// Slots of a creative: carousels take the cards found in the files, statics the ones in creativo.json.
function slotsDe(data, files) {
  const listed = (Array.isArray(data.slots) ? data.slots : []).filter((s) => typeof s === "string" && /^[a-z0-9-]+$/i.test(s));
  const found = new Set();
  if (data.type === "carousel") {
    listed.filter((s) => /^tarjeta-\d+$/.test(s)).forEach((s) => found.add(s));
    for (const f of files) { const r = /^(tarjeta-\d+)-v\d+\.png$/.exec(f); if (r) found.add(r[1]); }
    return [...found].sort((a, b) => Number(a.slice(8)) - Number(b.slice(8)));
  }
  if (listed.length) return listed;
  for (const f of files) { const r = /^(\d+x\d+)-v\d+\.png$/.exec(f); if (r) found.add(r[1]); }
  const rank = (s) => (SLOT_ORDER.includes(s) ? SLOT_ORDER.indexOf(s) : SLOT_ORDER.length);
  return [...found].sort((a, b) => rank(a) - rank(b));
}

function piezasDe(ruta, data, files) {
  const set = new Set(files);
  return slotsDe(data, files).map((slot) => {
    const re = new RegExp("^" + slot + "-v(\\d+)\\.png$");
    const versiones = [...set].map((f) => re.exec(f)).filter(Boolean)
      .map((r) => ({ n: Number(r[1]), src: ruta + "/" + r[0] })).sort((a, b) => b.n - a.n);
    const label = /^tarjeta-(\d+)$/.test(slot) ? "Tarjeta " + slot.slice(8) : slot.replace("x", ":");
    return { slot, label, current: versiones[0] || null, older: versiones.slice(1) };
  });
}

// Files of older versions of a creative or a video: what "clean old versions" moves to the trash.
// It never moves what could still be current, so a half-made version cannot lose its newest file:
//  - video: borrador-vN.mp4 and thumb-vN.jpg with N below the last version of video.json (or below
//    the highest N on disk, if that is lower: the last version may not have its files yet).
//    final.mp4, prompts, scenes and the storyboard stay.
//  - creative: per slot, <slot>-vN.png, <slot>-base-vN.png and <slot>-diseno-vN.html with N below
//    the highest finished piece of that slot (below the highest file of any kind if the slot has no
//    finished piece). Prompts stay.
function versionesAntiguas(e) {
  const data = esObjeto(e.data) ? e.data : {};
  const viejos = [];
  if (e.kind === "video") {
    const versiones = Array.isArray(data.versions) ? data.versions : [];
    const ultima = versiones.length ? Number((versiones[versiones.length - 1] || {}).n) || versiones.length : Infinity;
    const hallados = [];
    for (const f of e.files) {
      const r = /^(?:borrador-v(\d+)\.mp4|thumb-v(\d+)\.jpg)$/.exec(f);
      if (r) hallados.push({ f, n: Number(r[1] || r[2]) });
    }
    const desde = Math.min(ultima, Math.max(0, ...hallados.map((x) => x.n)));
    for (const x of hallados) if (x.n < desde) viejos.push(x.f);
  } else if (e.kind === "creative") {
    const slots = new Map(); // slot -> {finales: max N of finished pieces, todos: max N of any file, files}
    for (const f of e.files) {
      const r = /^(.+?)-(?:base-v(\d+)\.png|diseno-v(\d+)\.html|v(\d+)\.png)$/.exec(f);
      if (!r) continue;
      const n = Number(r[2] || r[3] || r[4]);
      if (!slots.has(r[1])) slots.set(r[1], { finales: 0, todos: 0, files: [] });
      const s = slots.get(r[1]);
      s.files.push({ f, n });
      s.todos = Math.max(s.todos, n);
      if (r[4] !== undefined) s.finales = Math.max(s.finales, n);
    }
    for (const s of slots.values()) {
      const desde = s.finales || s.todos;
      for (const x of s.files) if (x.n < desde) viejos.push(x.f);
    }
  }
  return viejos.sort(cmp).map((f) => e.path + "/" + f);
}

function versionesDeVideo(ruta, data, files) {
  const set = new Set(files);
  const file = (name) => (set.has(name) ? ruta + "/" + name : null);
  return (Array.isArray(data.versions) ? data.versions : []).map((v, i) => {
    const n = (v && v.n) || i + 1;
    return { ...v, n, video: file("borrador-v" + n + ".mp4"), thumb: file("thumb-v" + n + ".jpg") };
  });
}

// Fields shared by the list and the detail, computed once when the entity is read.
function derivar(e) {
  const data = esObjeto(e.data) ? e.data : {};
  const segs = e.path.split("/");
  const set = new Set(e.files);
  const ultimo = segs[segs.length - 1];
  let cover = null;
  if (e.kind === "actor") {
    cover = set.has("retrato.png") ? "retrato.png" : e.files.find((f) => IMAGENES.has(path.extname(f).toLowerCase())) || null;
  } else if (e.kind === "product") {
    const fotos = e.files.filter((f) => f.startsWith("fotos/"));
    cover = (typeof data.cover === "string" && set.has(data.cover) && data.cover) || fotos[0] || null;
  } else if (e.kind === "brand") {
    cover = typeof data.logo === "string" && set.has(data.logo) ? data.logo : null;
  } else if (e.kind === "creative") {
    const piezas = piezasDe(e.path, data, e.files);
    const c = piezas[0] && piezas[0].current;
    cover = c ? c.src.slice(e.path.length + 1) : null;
    e.tipoCreativo = data.type === "carousel" ? "carousel" : "static";
    e.piezasActuales = piezas.filter((p) => p.current).length;
  } else if (e.kind === "video") {
    const vs = versionesDeVideo(e.path, data, e.files);
    const ult = vs[vs.length - 1];
    const thumbs = e.files.filter((f) => /^thumb-v\d+\.jpg$/.test(f)).sort((a, b) => Number(b.match(/\d+/)[0]) - Number(a.match(/\d+/)[0]));
    const escena = e.files.find((f) => /^escena-1\.(png|jpe?g|webp)$/i.test(f));
    cover = (ult && ult.thumb && ult.thumb.slice(e.path.length + 1)) || thumbs[0] || escena || (set.has("storyboard.jpg") ? "storyboard.jpg" : null);
  }
  const titulo = e.kind === "actor" || e.kind === "brand" ? data.name : data.title;
  e.titulo = str(titulo) || (e.kind === "brand" ? "Marca" : ultimo);
  e.estado = e.kind === "actor" || e.kind === "brand" ? null : str(data.status);
  e.archivado = data.archived === true;
  e.profileId = e.kind === "actor" ? null : segs[1];
  e.productId = e.kind === "product" || e.kind === "video" || e.kind === "creative" ? segs[2] : null;
  e.productPath = e.productId ? segs.slice(0, 3).join("/") : null;
  e.batch = e.kind === "creative" ? str(data.batch) : null;
  e.tipoCreativo ??= null;
  e.piezasActuales ??= null;
  e.actorId = e.kind === "actor" ? str(data.id) || ultimo : str(data.actorId);
  e.angulo = e.kind === "creative" ? str(esObjeto(data.concept) && data.concept.angle) : str(data.angle);
  e.hook = str(data.hook);
  e.adName = str(data.adName);
  const fecha = str(data.updatedAt) || str(data.createdAt);
  const ms = fecha ? Date.parse(fecha) : NaN;
  e.updatedAt = Number.isFinite(ms) ? fecha : new Date(e.jsonMtime || 0).toISOString();
  e.updatedMs = Number.isFinite(ms) ? ms : e.jsonMtime || 0;
  e.cover = cover ? e.path + "/" + cover : null;
  e.tituloNorm = norm(e.titulo);
}

// ---------- port memory and .claude/launch.json ----------

function escribirAtomico(file, contenido) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, contenido);
    fs.renameSync(tmp, file);
  } catch (err) {
    // A full disk or a read-only folder must not leave the temp file behind.
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

// The port recorded by the last server of this studio, or null.
function leerUltimoPuerto(file) {
  try {
    const n = Number(fs.readFileSync(file, "utf8").trim());
    return Number.isInteger(n) && n > 0 && n < 65536 ? n : null;
  } catch { return null; }
}

// Points the "galeria" configuration of <studio>/.claude/launch.json at this server, so the
// Claude desktop app can open the gallery in its browser pane (preview_start "galeria"). It has a
// url and no command: it attaches to the running server, never starts one. Other configurations
// and fields are kept; a file that is not valid JSON is left as it is. Written only when it changes.
const LAUNCH_NOMBRE = "galeria";
function actualizarLaunch(raiz, puerto) {
  const file = path.join(raiz, ".claude", "launch.json");
  let actual = null;
  // "0.0.1" is the launch.json format version the Claude desktop app reads, not the plugin
  // version: never bump it with a release.
  let datos = { version: "0.0.1", configurations: [] };
  try { actual = fs.readFileSync(file, "utf8"); } catch (err) { if (err.code !== "ENOENT") throw err; }
  if (actual !== null) {
    try { datos = JSON.parse(actual); } catch { throw new Error("it is not valid JSON; left as it is"); }
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) throw new Error("unexpected shape; left as it is");
    if (!Array.isArray(datos.configurations)) datos.configurations = [];
  }
  const entrada = { name: LAUNCH_NOMBRE, port: puerto, url: `http://127.0.0.1:${puerto}` };
  const i = datos.configurations.findIndex((c) => c && c.name === LAUNCH_NOMBRE);
  if (i === -1) datos.configurations.push(entrada); else datos.configurations[i] = entrada;
  const nuevo = JSON.stringify(datos, null, 2) + "\n";
  if (nuevo !== actual) escribirAtomico(file, nuevo);
}

// ---------- server ----------

export async function crearServidor(opts = {}) {
  const env = process.env;
  let raiz;
  try { raiz = fs.realpathSync(opts.studio); } catch { throw new Error(`studio folder not found: ${opts.studio}`); }
  if (!fs.existsSync(path.join(raiz, "studio.json"))) throw new Error(`${raiz} is not a studio (no studio.json)`);

  const basePort = opts.port ?? (env.UGC_GALERIA_PORT !== undefined && env.UGC_GALERIA_PORT !== "" ? Number(env.UGC_GALERIA_PORT) : BASE_PORT);
  const idleMin = opts.idleMin ?? (env.UGC_GALERIA_IDLE_MIN !== undefined && env.UGC_GALERIA_IDLE_MIN !== "" ? Number(env.UGC_GALERIA_IDLE_MIN) : 30);
  const debounceMs = opts.debounceMs ?? Number(env.UGC_GALERIA_DEBOUNCE_MS || 200);
  const checkMs = opts.checkMs ?? 10000;
  // Test-only hook: wait this long before the scan, to look at the server while it is not ready.
  const scanDelayMs = opts.scanDelayMs ?? Number(env.UGC_GALERIA_TEST_SCAN_DELAY_MS || 0);
  const pluginRaiz = (() => { try { return fs.realpathSync(path.join(AQUI, "..")); } catch { return path.resolve(AQUI, ".."); } })();
  const version = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(AQUI, "..", ".claude-plugin", "plugin.json"), "utf8")).version || "0"; } catch { return "0"; }
  })();
  const inicio = isoSeg(); // this process's start, recorded in servidor.json to recognise it on close
  const estadoFile = path.join(raiz, ".galeria", "servidor.json");
  const puertoFile = path.join(raiz, ".galeria", "puerto"); // last port used; outlives the server
  const abs = (rel) => path.join(raiz, ...rel.split("/"));

  // ----- index -----
  const entidades = new Map(); // path -> entity
  const estructura = new Map(); // folder path -> mtimeMs, folders whose listing the index depends on
  const idx = { version: 0, sucio: false, studioTexto: "{}", studioData: {}, studioError: null, studioMtime: null, cacheOrden: null };

  const marcar = () => { idx.sucio = true; };
  function volcar() {
    if (!idx.sucio) return;
    idx.sucio = false;
    idx.version++;
    idx.cacheOrden = null;
  }

  function leerEntidad(kind, rel) {
    const dirAbs = abs(rel);
    const jsonAbs = path.join(dirAbs, JSON_NAME[kind]);
    let real;
    let st;
    const dirMtime = mtimeDe(dirAbs); // before listing, so a change in between shows up on the next check
    const fotosMtime = kind === "product" ? mtimeDe(path.join(dirAbs, "fotos")) : null; // fotos/ is listed too
    try { real = fs.realpathSync(jsonAbs); st = fs.statSync(jsonAbs); } catch { return null; }
    if (!dentro(raiz, real) || !st.isFile()) return null;
    let texto;
    try { texto = fs.readFileSync(jsonAbs, "utf8"); } catch { return null; }
    let data = null;
    let error = null;
    try {
      data = JSON.parse(texto.replace(/^﻿/, ""));
      if (!esObjeto(data)) { error = "the JSON is not an object"; data = null; }
    } catch (err) { error = err.message; }
    const files = listarArchivos(dirAbs);
    if (kind === "product") files.push(...listarArchivos(path.join(dirAbs, "fotos"), "fotos/"));
    const e = { kind, path: rel, texto, data, error, files, jsonMtime: st.mtimeMs, dirMtime, fotosMtime };
    e.firma = texto + "\0" + files.join("\0");
    derivar(e);
    return e;
  }

  function poner(e) {
    const antes = entidades.get(e.path);
    if (antes && antes.firma === e.firma) {
      // Same content: keep the object the views were built on (replacing it would drop the search data
      // that prepararVistas added without bumping the version); only the times the periodic check compares move.
      antes.jsonMtime = e.jsonMtime; antes.dirMtime = e.dirMtime; antes.fotosMtime = e.fotosMtime;
      antes.updatedAt = e.updatedAt; antes.updatedMs = e.updatedMs; // from the file time when the JSON has no date
      return;
    }
    entidades.set(e.path, e);
    marcar();
  }

  function refrescar(kind, rel) {
    const e = leerEntidad(kind, rel);
    if (e) poner(e);
    else if (entidades.delete(rel)) marcar();
  }

  function quitarPrefijo(rel) {
    for (const k of [...entidades.keys()]) {
      if (k === rel || k.startsWith(rel + "/")) { entidades.delete(k); marcar(); }
    }
    for (const k of [...estructura.keys()]) if (k === rel || k.startsWith(rel + "/")) estructura.delete(k);
  }

  const existeDir = (rel) => { try { return fs.statSync(abs(rel)).isDirectory(); } catch { return false; } };
  const marcarEstructura = (rel) => { const m = mtimeDe(abs(rel)); if (m === null) estructura.delete(rel); else estructura.set(rel, m); };

  function escanearActores() {
    if (!existeDir("actores")) { quitarPrefijo("actores"); return; }
    marcarEstructura("actores");
    const ids = new Set(listarCarpetas(abs("actores")));
    for (const k of [...entidades.keys()]) if (k.startsWith("actores/") && !ids.has(k.split("/")[1])) { entidades.delete(k); marcar(); }
    for (const id of ids) if (!entidades.has("actores/" + id)) refrescar("actor", "actores/" + id);
  }

  function escanearContenedor(c, p, carpeta) {
    const rel = `clientes/${c}/${p}/${carpeta}`;
    const kind = carpeta === "videos" ? "video" : "creative";
    if (!existeDir(rel)) { quitarPrefijo(rel); return; }
    marcarEstructura(rel);
    const ids = new Set(listarCarpetas(abs(rel)));
    for (const k of [...entidades.keys()]) if (k.startsWith(rel + "/") && !ids.has(k.split("/")[4])) { entidades.delete(k); marcar(); }
    for (const id of ids) if (!entidades.has(`${rel}/${id}`)) refrescar(kind, `${rel}/${id}`);
  }

  function escanearProducto(c, p) {
    const rel = `clientes/${c}/${p}`;
    if (!existeDir(rel)) { quitarPrefijo(rel); return; }
    marcarEstructura(rel);
    refrescar("product", rel);
    for (const carpeta of ["videos", "creativos"]) {
      const sub = `${rel}/${carpeta}`;
      if (existeDir(sub)) escanearContenedor(c, p, carpeta);
      else quitarPrefijo(sub);
    }
  }

  function escanearCliente(c) {
    const rel = `clientes/${c}`;
    if (!existeDir(rel)) { quitarPrefijo(rel); return; }
    marcarEstructura(rel);
    refrescar("brand", `${rel}/marca`);
    const productos = new Set(listarCarpetas(abs(rel)).filter((n) => n !== "marca"));
    for (const k of [...entidades.keys()]) {
      if (k.startsWith(rel + "/") && !k.startsWith(rel + "/marca") && !productos.has(k.split("/")[2])) { entidades.delete(k); marcar(); }
    }
    for (const k of [...estructura.keys()]) if (k.startsWith(rel + "/") && !productos.has(k.split("/")[2])) estructura.delete(k);
    for (const p of productos) if (!estructura.has(`${rel}/${p}`)) escanearProducto(c, p);
  }

  function escanearClientes() {
    if (!existeDir("clientes")) { quitarPrefijo("clientes"); return; }
    marcarEstructura("clientes");
    const cs = new Set(listarCarpetas(abs("clientes")));
    for (const k of [...entidades.keys()]) if (k.startsWith("clientes/") && !cs.has(k.split("/")[1])) { entidades.delete(k); marcar(); }
    for (const k of [...estructura.keys()]) if (k.startsWith("clientes/") && !cs.has(k.split("/")[1])) estructura.delete(k);
    for (const c of cs) if (!estructura.has("clientes/" + c)) escanearCliente(c);
  }

  function cargarEstudio() {
    const f = path.join(raiz, "studio.json");
    idx.studioMtime = mtimeDe(f);
    let texto = "{}";
    try { texto = fs.readFileSync(f, "utf8"); } catch { /* missing studio.json reads as empty */ }
    let data = {};
    let error = null;
    try { data = JSON.parse(texto.replace(/^﻿/, "")); } catch (err) { error = err.message; data = null; }
    if (texto !== idx.studioTexto) marcar();
    idx.studioTexto = texto;
    idx.studioData = data;
    idx.studioError = error;
  }

  // Applies a change at a studio-relative path (from the watcher, the periodic check or an action).
  function aplicarCambio(segs) {
    const [a, c, p, carpeta, id] = segs;
    if (a === "studio.json" && segs.length === 1) cargarEstudio();
    else if (a === "actores") {
      if (segs.length === 1) escanearActores();
      else {
        refrescar("actor", `actores/${segs[1]}`);
        if (segs.length === 2) escanearActores();
      }
    } else if (a === "clientes") {
      if (segs.length === 1) escanearClientes();
      else if (segs.length === 2) escanearCliente(c);
      else if (p === "marca") refrescar("brand", `clientes/${c}/marca`);
      else if (segs.length === 3) escanearProducto(c, p);
      else if ((carpeta === "videos" || carpeta === "creativos") && segs.length === 4) escanearContenedor(c, p, carpeta);
      else if ((carpeta === "videos" || carpeta === "creativos") && id) refrescar(carpeta === "videos" ? "video" : "creative", `clientes/${c}/${p}/${carpeta}/${id}`);
      else refrescar("product", `clientes/${c}/${p}`);
    }
    volcar();
  }

  // The first scan runs after the server is listening and gives the event loop back between
  // products, so /api/salud keeps answering (listo: false) while it runs.
  const cede = (() => {
    let desde = Date.now();
    return async () => {
      if (Date.now() - desde < 10) return;
      await new Promise((resolve) => setImmediate(resolve));
      desde = Date.now();
    };
  })();

  async function escaneoInicial() {
    entidades.clear();
    estructura.clear();
    cargarEstudio();
    escanearActores();
    if (existeDir("clientes")) {
      marcarEstructura("clientes");
      for (const c of listarCarpetas(abs("clientes"))) {
        if (cerrado) return;
        const rel = `clientes/${c}`;
        marcarEstructura(rel);
        refrescar("brand", `${rel}/marca`);
        for (const p of listarCarpetas(abs(rel)).filter((n) => n !== "marca")) {
          escanearProducto(c, p);
          await cede();
          if (cerrado) return;
        }
      }
    }
    marcar();
    volcar();
  }

  // Cheap fallback: compare folder and JSON times with what the index last saw.
  function revisarCambios() {
    if (mtimeDe(path.join(raiz, "studio.json")) !== idx.studioMtime) cargarEstudio();
    for (const [rel, m] of [...estructura]) {
      if (estructura.get(rel) !== m) continue; // already refreshed by an earlier step
      if (mtimeDe(abs(rel)) !== m) aplicarCambio(rel.split("/"));
    }
    for (const e of [...entidades.values()]) {
      if (entidades.get(e.path) !== e) continue;
      if (mtimeDe(abs(e.path)) !== e.dirMtime || mtimeDe(abs(e.path + "/" + JSON_NAME[e.kind])) !== e.jsonMtime
        || (e.kind === "product" && mtimeDe(abs(e.path + "/fotos")) !== e.fotosMtime)) {
        aplicarCambio(e.path.split("/"));
      }
    }
    volcar();
  }

  const ordenadas = () => {
    if (!idx.cacheOrden) {
      idx.cacheOrden = [...entidades.values()].sort((x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind) || cmp(x.path, y.path));
    }
    return idx.cacheOrden;
  };

  // ----- views of the index -----
  let vistaVersion = -1;
  let nombresCliente = new Map();
  let actores = new Map();
  function prepararVistas() {
    if (vistaVersion === idx.version) return;
    vistaVersion = idx.version;
    nombresCliente = new Map();
    for (const e of entidades.values()) {
      if (e.kind === "brand" && str(e.data && e.data.name)) nombresCliente.set(e.profileId, e.data.name);
    }
    for (const e of entidades.values()) {
      if (e.kind === "product" && !nombresCliente.has(e.profileId) && str(e.data && e.data.clientName)) nombresCliente.set(e.profileId, e.data.clientName);
    }
    actores = new Map();
    for (const e of entidades.values()) if (e.kind === "actor") actores.set(e.actorId, e);
    for (const e of entidades.values()) {
      const producto = e.productPath ? entidades.get(e.productPath) : null;
      const actor = e.actorId ? actores.get(e.actorId) : null;
      e.clienteNombre = e.profileId ? nombresCliente.get(e.profileId) || e.profileId : null;
      e.productoTitulo = producto ? producto.titulo : null;
      e.busqueda = norm([
        e.titulo, e.kind === "product" ? e.productId : producto && producto.titulo, e.clienteNombre, e.angulo, e.hook, e.adName,
        e.actorId, actor && actor.titulo,
      ].filter(Boolean).join("\n"));
    }
  }

  const vistaItem = (e) => ({
    kind: e.kind, path: e.path, title: e.titulo, status: e.estado, archived: e.archivado, broken: !!e.error,
    profileId: e.profileId, productId: e.productId, batch: e.batch, actorId: e.actorId, updatedAt: e.updatedAt,
    cover: e.cover, coverThumb: e.cover ? "/miniatura/" + e.cover.split("/").map(encodeURIComponent).join("/") + "?w=480" : null,
    productTitle: e.productoTitulo ?? null, clientName: e.profileId ? e.clienteNombre : null,
    type: e.tipoCreativo, pieces: e.piezasActuales,
  });

  function vistaElemento(e) {
    prepararVistas();
    const out = { ...vistaItem(e), json: e.data, error: e.error, files: e.files };
    const data = esObjeto(e.data) ? e.data : {};
    if (e.kind === "creative") {
      const pieces = piezasDe(e.path, data, e.files);
      out.pieces = pieces;
      const topN = Math.max(0, ...pieces.map((p) => (p.current ? p.current.n : 0)));
      out.versionCount = (Array.isArray(data.versions) && data.versions.length) || topN;
    } else if (e.kind === "video") {
      const versions = versionesDeVideo(e.path, data, e.files);
      out.versions = versions;
      out.current = versions[versions.length - 1] || null;
      out.scenes = e.files.map((f) => /^escena-(\d+)\.(png|jpe?g|webp)$/i.exec(f)).filter(Boolean)
        .sort((a, b) => Number(a[1]) - Number(b[1])).map((r) => ({ n: Number(r[1]), src: e.path + "/" + r[0] }));
      out.finalVideo = e.files.includes("final.mp4") ? e.path + "/final.mp4" : null;
    } else if (e.kind === "product") {
      out.photos = e.files.filter((f) => f.startsWith("fotos/")).map((f) => e.path + "/" + f);
    }
    return out;
  }

  function vistaEstudio() {
    prepararVistas();
    const byKind = {};
    const status = {};
    let archived = 0;
    let broken = 0;
    let creditsUsed = 0;
    const clientes = new Map();
    const cliente = (id) => {
      if (!clientes.has(id)) clientes.set(id, { profileId: id, name: nombresCliente.get(id) || id, products: 0, creatives: 0, videos: 0 });
      return clientes.get(id);
    };
    for (const id of listarCarpetas(abs("clientes"))) cliente(id);
    for (const e of entidades.values()) {
      if (e.error) broken++;
      // Credits spent, archived items included; only actors, videos and creatives carry credits.
      if ((e.kind === "actor" || e.kind === "video" || e.kind === "creative") && e.data && typeof e.data.credits === "number" && Number.isFinite(e.data.credits)) creditsUsed += e.data.credits;
      if (e.archivado) { archived++; continue; }
      byKind[e.kind] = (byKind[e.kind] || 0) + 1;
      if (e.estado) {
        status[e.kind] ??= {};
        status[e.kind][e.estado] = (status[e.kind][e.estado] || 0) + 1;
      }
      if (e.profileId) {
        const c = cliente(e.profileId);
        if (e.kind === "product") c.products++;
        else if (e.kind === "creative") c.creatives++;
        else if (e.kind === "video") c.videos++;
      }
    }
    return {
      studio: idx.studioData, studioError: idx.studioError,
      counts: { byKind, status, archived, broken },
      creditsUsed: Math.round(creditsUsed * 100) / 100,
      trashCount: contarPapelera(),
      clients: [...clientes.values()].sort((a, b) => cmp(a.profileId, b.profileId)),
    };
  }

  function elementos(q) {
    prepararVistas();
    const entero = (v, def, min, max) => {
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
    };
    const pagina = entero(q.get("pagina"), 1, 1, 1e9);
    const porPagina = entero(q.get("porPagina"), 48, 1, 200);
    let tipo = null;
    if (q.get("tipo")) {
      tipo = KIND_ALIAS[norm(q.get("tipo"))];
      if (!tipo) throw new ErrorHttp(400, "unknown tipo");
    }
    const fecha = (nombre, finDelDia) => {
      const v = q.get(nombre);
      if (!v) return null;
      const ms = Date.parse(v);
      if (!Number.isFinite(ms)) throw new ErrorHttp(400, `invalid ${nombre}`);
      return finDelDia && /^\d{4}-\d{2}-\d{2}$/.test(v) ? ms + 86400000 - 1 : ms;
    };
    const desde = fecha("desde", false);
    const hasta = fecha("hasta", true);
    const cliente = q.get("cliente") || null;
    const producto = q.get("producto") || null;
    const estado = q.get("estado") || null;
    const actor = q.get("actor") || null;
    const lote = q.get("lote") || null;
    const archivados = q.get("archivados") || "0";
    const terminos = norm(q.get("q") || "").split(/\s+/).filter(Boolean);
    let lista = ordenadas().filter((e) => {
      if (tipo && e.kind !== tipo) return false;
      if (cliente && e.profileId !== cliente) return false;
      if (producto && e.productId !== producto) return false;
      if (estado && e.estado !== estado) return false;
      if (actor && e.actorId !== actor) return false;
      if (lote && e.batch !== lote) return false;
      if (archivados === "solo" ? !e.archivado : archivados !== "1" && e.archivado) return false;
      if (desde !== null && e.updatedMs < desde) return false;
      if (hasta !== null && e.updatedMs > hasta) return false;
      for (const t of terminos) if (!e.busqueda.includes(t)) return false;
      return true;
    });
    const orden = q.get("orden") || "reciente";
    if (orden === "antiguo") lista = lista.sort((a, b) => a.updatedMs - b.updatedMs || cmp(a.path, b.path));
    else if (orden === "titulo") lista = lista.sort((a, b) => cmp(a.tituloNorm, b.tituloNorm) || cmp(a.path, b.path));
    else lista = lista.sort((a, b) => b.updatedMs - a.updatedMs || cmp(a.path, b.path));
    const ini = (pagina - 1) * porPagina;
    return { total: lista.length, pagina, porPagina, items: lista.slice(ini, ini + porPagina).map(vistaItem) };
  }

  // ----- file access -----

  // Resolves studio-relative segments to a real path inside the studio, or throws.
  function resolver(segs, { raices = true } = {}) {
    if (!segs) throw new ErrorHttp(400, "invalid path");
    if (segs.some((s) => s.startsWith("."))) throw new ErrorHttp(404, "not found");
    if (raices && !ROOTS.has(segs[0])) throw new ErrorHttp(403, "path not allowed");
    const a = path.join(raiz, ...segs);
    let real;
    try { real = fs.realpathSync(a); } catch { throw new ErrorHttp(404, "not found"); }
    if (!dentro(raiz, real)) throw new ErrorHttp(403, "path not allowed");
    return { abs: a, real };
  }

  function enviar(res, status, cuerpo, tipo, extra = {}) {
    const buf = Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(cuerpo);
    res.writeHead(status, { "Content-Type": tipo, "Content-Length": buf.length, ...extra });
    res.end(res.req.method === "HEAD" ? undefined : buf);
  }
  const enviarJson = (res, status, obj, extra) => enviar(res, status, JSON.stringify(obj), "application/json; charset=utf-8", extra);

  function rango(cabecera, size) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(cabecera).trim());
    if (!m) return null;
    let start;
    let end;
    if (m[1] === "" && m[2] === "") return "malo";
    if (m[1] === "") {
      const n = Number(m[2]);
      if (n === 0) return "malo";
      start = Math.max(0, size - n);
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start >= size || start > end) return "malo";
    return { start, end };
  }

  function servirArchivo(req, res, real, tipoForzado) {
    let st;
    try { st = fs.statSync(real); } catch { throw new ErrorHttp(404, "not found"); }
    if (!st.isFile()) throw new ErrorHttp(404, "not found");
    const ext = path.extname(real).toLowerCase();
    const tipo = tipoForzado || TIPOS[ext] || "application/octet-stream";
    const etag = `W/"${st.size.toString(16)}-${Math.round(st.mtimeMs).toString(16)}"`;
    const cab = {
      "Content-Type": tipo, "Accept-Ranges": "bytes", ETag: etag, "Cache-Control": "private, no-cache", "Last-Modified": st.mtime.toUTCString(),
    };
    if (ext === ".html" || ext === ".svg") cab["Content-Security-Policy"] = "sandbox";
    let status = 200;
    let ini = 0;
    let fin = st.size - 1;
    if (req.headers.range) {
      const r = rango(req.headers.range, st.size);
      if (r === "malo") {
        res.writeHead(416, { "Content-Range": `bytes */${st.size}`, "Content-Length": 0 });
        res.end();
        return;
      }
      if (r) { status = 206; ini = r.start; fin = r.end; cab["Content-Range"] = `bytes ${ini}-${fin}/${st.size}`; }
    } else if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, { ETag: etag, "Cache-Control": cab["Cache-Control"] });
      res.end();
      return;
    }
    const largo = st.size === 0 ? 0 : fin - ini + 1;
    cab["Content-Length"] = largo;
    res.writeHead(status, cab);
    if (req.method === "HEAD" || largo === 0) { res.end(); return; }
    const stream = fs.createReadStream(real, { start: ini, end: fin });
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  }

  // ----- thumbnails -----
  const herramientas = opts.herramientas ?? ["sips", "ffmpeg"].filter((n) => {
    for (const d of (env.PATH || "").split(path.delimiter)) {
      try { fs.accessSync(path.join(d, n), fs.constants.X_OK); return true; } catch { /* next */ }
    }
    return false;
  });
  const generando = new Map(); // key -> Promise<boolean>
  const fallidas = new Set();
  const cola = [];
  let activas = 0;
  function correr(tarea) {
    return new Promise((resolve) => {
      cola.push({ tarea, resolve });
      siguiente();
    });
  }
  function siguiente() {
    while (activas < 4 && cola.length) {
      const { tarea, resolve } = cola.shift();
      activas++;
      tarea().then(resolve, () => resolve(false)).finally(() => { activas--; siguiente(); });
    }
  }
  const ejecutar = (cmd, args) => new Promise((resolve) => {
    execFile(cmd, args, { timeout: 30000, windowsHide: true }, (err) => resolve(!err));
  });

  function generarMiniatura(real, ext, ancho, destino) {
    const tmp = path.join(path.dirname(destino), `.${path.basename(destino, ".jpg")}.tmp-${crypto.randomBytes(4).toString("hex")}.jpg`);
    return correr(async () => {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      let ok = false;
      const esVideo = VIDEOS.has(ext);
      if (!esVideo && herramientas.includes("sips")) {
        ok = await ejecutar("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "80", "-Z", String(ancho), real, "--out", tmp]);
      }
      if (!ok && herramientas.includes("ffmpeg")) {
        const args = ["-nostdin", "-loglevel", "error", "-y"];
        if (esVideo) args.push("-ss", "0.5");
        args.push("-i", real, "-frames:v", "1", "-vf", `scale='min(${ancho},iw)':-2`, "-q:v", "4", tmp);
        ok = await ejecutar("ffmpeg", args);
        if (!ok && esVideo) {
          ok = await ejecutar("ffmpeg", ["-nostdin", "-loglevel", "error", "-y", "-i", real, "-frames:v", "1", "-vf", `scale='min(${ancho},iw)':-2`, "-q:v", "4", tmp]);
        }
      }
      if (ok) {
        try { fs.renameSync(tmp, destino); } catch { ok = false; }
      }
      if (!ok) { try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ } }
      return ok;
    });
  }

  async function miniatura(req, res, segs, q) {
    const ancho = q.has("w") ? Number(q.get("w")) : 480;
    if (!ANCHOS.includes(ancho)) throw new ErrorHttp(400, "w must be 240, 480 or 960");
    const { real } = resolver(segs);
    const st = fs.statSync(real);
    if (!st.isFile()) throw new ErrorHttp(404, "not found");
    const ext = path.extname(real).toLowerCase();
    if ((!IMAGENES.has(ext) && !VIDEOS.has(ext)) || herramientas.length === 0) return servirArchivo(req, res, real);
    const clave = crypto.createHash("sha1").update(`${segs.join("/")}\0${st.mtimeMs}\0${ancho}`).digest("hex");
    const destino = path.join(raiz, ".galeria", "miniaturas", clave + ".jpg");
    if (!fs.existsSync(destino) && !fallidas.has(clave)) {
      if (!generando.has(clave)) {
        const p = generarMiniatura(real, ext, ancho, destino).finally(() => generando.delete(clave));
        generando.set(clave, p);
      }
      if (!(await generando.get(clave))) fallidas.add(clave);
    }
    if (fs.existsSync(destino)) return servirArchivo(req, res, destino);
    return servirArchivo(req, res, real);
  }

  // ----- actions -----
  const idEntidad = (rel) => entidades.get(rel);

  function leerRuta(ruta) {
    const segs = segmentos(ruta);
    if (!segs) throw new ErrorAccion("invalid path");
    if (!ROOTS.has(segs[0])) throw new ErrorAccion("path not allowed");
    return segs;
  }

  function entidadDe(ruta) {
    const segs = leerRuta(ruta);
    const e = idEntidad(segs.join("/"));
    if (!e) throw new ErrorAccion("not an item of the studio");
    let real;
    try { real = fs.realpathSync(abs(e.path)); } catch { throw new ErrorAccion("not found"); }
    if (!dentro(raiz, real)) throw new ErrorAccion("path not allowed");
    return e;
  }

  function escribirJson(e, mutar) {
    const file = abs(e.path + "/" + JSON_NAME[e.kind]);
    let data;
    try { data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")); } catch (err) {
      throw new ErrorAccion("the JSON file is broken: " + err.message);
    }
    if (!esObjeto(data)) throw new ErrorAccion("the JSON file is not an object");
    mutar(data);
    const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`);
    try {
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
      fs.renameSync(tmp, file);
    } catch (err) {
      try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
      throw new ErrorAccion("could not write: " + err.code);
    }
    aplicarCambio(e.path.split("/"));
  }

  function propietario(segs) {
    for (let n = segs.length - 1; n >= 2; n--) {
      const e = entidades.get(segs.slice(0, n).join("/"));
      if (e) return e;
    }
    return null;
  }

  function aPapelera(ruta) {
    const segs = leerRuta(ruta);
    const rel = segs.join("/");
    let st;
    let real;
    try { st = fs.lstatSync(abs(rel)); real = fs.realpathSync(abs(rel)); } catch { throw new ErrorAccion("not found"); }
    if (!dentro(raiz, real)) throw new ErrorAccion("path not allowed");
    let dueno;
    if (st.isDirectory()) {
      if (!entidades.has(rel)) throw new ErrorAccion("only item folders or single files can be moved to the trash");
      dueno = null;
    } else {
      dueno = propietario(segs);
      if (!dueno) throw new ErrorAccion("the file does not belong to an item");
      if (rel === dueno.path + "/" + JSON_NAME[dueno.kind]) throw new ErrorAccion("the main JSON of an item cannot be moved alone: move its folder");
    }
    if (opts.alMover) opts.alMover(rel); // test-only hook: raise an fs error before a move
    const ahora = new Date();
    const id = `${ahora.toISOString().slice(0, 19).replace(/:/g, "")}Z-${crypto.randomBytes(3).toString("hex")}`;
    const entrada = path.join(raiz, ".papelera", id);
    const destino = path.join(entrada, ...segs);
    try {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(path.join(entrada, "papelera.json"), JSON.stringify({
        id, originalPath: rel, trashedAt: isoSeg(ahora), kind: st.isDirectory() ? "folder" : "file",
      }, null, 2) + "\n");
      fs.renameSync(abs(rel), destino);
    } catch (err) {
      try { fs.rmSync(entrada, { recursive: true, force: true }); } catch { /* ignore */ }
      throw new ErrorAccion("could not move: " + err.code);
    }
    // The file is already in the trash: the caller must get its id even if refreshing the index fails
    // (the periodic check catches up).
    try { aplicarCambio(segs); } catch { /* stale index until the next check */ }
    return id;
  }

  function restaurar(id) {
    if (typeof id !== "string" || !ID_PAPELERA.test(id)) throw new ErrorAccion("invalid trash entry id");
    const entrada = path.join(raiz, ".papelera", id);
    let meta;
    try { meta = JSON.parse(fs.readFileSync(path.join(entrada, "papelera.json"), "utf8")); } catch { throw new ErrorAccion("trash entry not found"); }
    const segs = esObjeto(meta) ? segmentos(meta.originalPath) : null;
    if (!segs || !ROOTS.has(segs[0])) throw new ErrorAccion("the trash entry has an invalid original path");
    const origen = path.join(entrada, ...segs);
    const destino = abs(segs.join("/"));
    try { fs.lstatSync(origen); } catch { throw new ErrorAccion("the trashed item is missing"); }
    try { fs.lstatSync(destino); throw new ErrorAccion("the original path already exists: " + segs.join("/")); } catch (err) {
      if (err instanceof ErrorAccion) throw err;
    }
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    if (!dentro(raiz, fs.realpathSync(path.dirname(destino)))) throw new ErrorAccion("path not allowed");
    try { fs.renameSync(origen, destino); } catch (err) { throw new ErrorAccion("could not restore: " + err.code); }
    try { fs.rmSync(entrada, { recursive: true, force: true }); } catch { /* the item is back; leftovers are only empty folders */ }
    aplicarCambio(segs); // a folder with children, or a file inside an item
  }

  // Moves the files of older versions of a creative or video to the trash, one ordinary trash entry
  // per file (so each one restores like any other file). The list is made first; a file that cannot
  // be moved does not stop the others and the result says how many went.
  function limpiarVersiones(ruta) {
    const e = entidadDe(ruta);
    if (e.kind !== "creative" && e.kind !== "video") throw new ErrorAccion("only creatives and videos have versions to clean");
    const archivos = versionesAntiguas(e);
    const ids = [];
    const fallos = [];
    let parado = false;
    for (const f of archivos) {
      const nombre = f.slice(e.path.length + 1);
      try { ids.push(aPapelera(f)); } catch (err) {
        if (err instanceof ErrorAccion) { fallos.push(`${nombre} (${err.message})`); continue; }
        // Not one of our own checks: the state of the rest is unknown, so stop here, but still report
        // what already moved (and its ids) so it can be restored.
        fallos.push(`${nombre} (${err.code || err.message})`);
        parado = true;
        break;
      }
    }
    if (fallos.length) {
      return {
        ruta, ok: false, movidos: ids.length, ids,
        error: `moved ${ids.length} of ${archivos.length} files; failed: ${fallos.join("; ")}` + (parado ? "; stopped after an unexpected error" : ""),
      };
    }
    return { ruta, ok: true, movidos: ids.length, ids };
  }

  function aplicarAccion(a) {
    const ruta = esObjeto(a) && typeof a.ruta === "string" ? a.ruta : "";
    try {
      if (!esObjeto(a)) throw new ErrorAccion("invalid action");
      switch (a.tipo) {
        case "estado": {
          const e = entidadDe(ruta);
          const validos = ESTADOS[e.kind];
          if (!validos) throw new ErrorAccion(`status does not apply to ${e.kind}`);
          if (typeof a.valor !== "string" || !validos.includes(a.valor)) throw new ErrorAccion(`valor must be one of: ${validos.join(", ")}`);
          escribirJson(e, (d) => { d.status = a.valor; d.updatedAt = isoSeg(); });
          return { ruta, ok: true };
        }
        case "archivar":
          escribirJson(entidadDe(ruta), (d) => { d.archived = true; if (!str(d.archivedAt)) d.archivedAt = isoSeg(); });
          return { ruta, ok: true };
        case "desarchivar":
          escribirJson(entidadDe(ruta), (d) => { delete d.archived; delete d.archivedAt; });
          return { ruta, ok: true };
        case "papelera":
          return { ruta, ok: true, id: aPapelera(ruta) };
        case "limpiarVersiones":
          return limpiarVersiones(ruta);
        case "restaurar":
          restaurar(ruta);
          return { ruta, ok: true };
        default:
          throw new ErrorAccion("unknown tipo");
      }
    } catch (err) {
      if (err instanceof ErrorAccion) return { ruta, ok: false, error: err.message };
      return { ruta, ok: false, error: "internal error: " + (err.code || err.message) };
    }
  }

  // Entries in the trash, counted from the folder names only (cheap: /api/estudio reports it).
  function contarPapelera() {
    try { return fs.readdirSync(path.join(raiz, ".papelera")).filter((id) => ID_PAPELERA.test(id)).length; } catch { return 0; }
  }

  function entradasPapelera() {
    let nombres;
    try { nombres = fs.readdirSync(path.join(raiz, ".papelera")); } catch { return []; }
    const out = [];
    for (const id of nombres) {
      if (!ID_PAPELERA.test(id)) continue;
      let meta = null;
      try { meta = JSON.parse(fs.readFileSync(path.join(raiz, ".papelera", id, "papelera.json"), "utf8")); } catch { /* entry without metadata */ }
      const ts = /^(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(id);
      const deId = `${ts[1]}T${ts[2]}:${ts[3]}:${ts[4]}Z`;
      out.push({
        id, originalPath: esObjeto(meta) ? str(meta.originalPath) : null,
        trashedAt: (esObjeto(meta) && str(meta.trashedAt)) || deId, kind: esObjeto(meta) ? str(meta.kind) : null,
      });
    }
    return out.sort((a, b) => cmp(b.trashedAt, a.trashedAt) || cmp(b.id, a.id));
  }

  // Deletes one trash entry for good. `id` already passed ID_PAPELERA, so it is a single folder name
  // inside .papelera (no separators, no "..", no dots at all); a link or a plain file with that name is left alone.
  function borrarEntrada(id) {
    const dir = path.join(raiz, ".papelera", id);
    let st;
    try { st = fs.lstatSync(dir); } catch { return "noEncontrado"; }
    if (!st.isDirectory()) return "noEncontrado";
    try { fs.rmSync(dir, { recursive: true, force: true }); return "eliminado"; } catch { return "fallido"; }
  }

  // POST /api/papelera/vaciar. With `ids` it deletes exactly those entries that still exist (what the
  // user saw in the confirmation) and nothing else, whatever was trashed since; without `ids`, every
  // entry, or those trashed before `antesDe`. With both, only the ids that are also before `antesDe`.
  // Ids that are not an entry name, or are gone, are reported, not fatal.
  function vaciarPapelera(body) {
    let corte = null;
    if (esObjeto(body) && body.antesDe !== undefined && body.antesDe !== null) {
      corte = typeof body.antesDe === "string" ? Date.parse(body.antesDe) : NaN;
      if (!Number.isFinite(corte)) throw new ErrorHttp(400, "invalid antesDe");
    }
    const conIds = esObjeto(body) && body.ids !== undefined;
    if (conIds && (!Array.isArray(body.ids) || body.ids.length > MAX_IDS_VACIAR)) throw new ErrorHttp(400, "ids must be an array of trash entry ids");
    const res = { eliminados: 0, ids: [], invalidos: [], noEncontrados: [], fallidos: [] };
    const aplicar = (id) => {
      const r = borrarEntrada(id);
      if (r === "eliminado") { res.eliminados++; res.ids.push(id); } else if (r === "fallido") res.fallidos.push(id); else res.noEncontrados.push(id);
    };
    // Entry dates are only read when they are needed: to cut by antesDe, or to list everything.
    const fecha = corte !== null || !conIds ? new Map(entradasPapelera().map((e) => [e.id, e.trashedAt])) : new Map();
    if (conIds) {
      for (const id of new Set(body.ids)) {
        if (typeof id !== "string" || !ID_PAPELERA.test(id)) { res.invalidos.push(typeof id === "string" ? id.slice(0, 100) : typeof id); continue; }
        if (corte !== null && fecha.has(id) && !(Date.parse(fecha.get(id)) < corte)) continue;
        aplicar(id);
      }
      return res;
    }
    for (const [id, trashedAt] of fecha) {
      if (corte !== null && !(Date.parse(trashedAt) < corte)) continue;
      aplicar(id);
    }
    res.noEncontrados.length = 0; // gone between the listing and the delete: nothing to report for "everything"
    return res;
  }

  // The item named by ?ruta= of a GET, checked to be inside the studio.
  function entidadDeConsulta(q) {
    const s = segmentos(q.get("ruta"));
    if (!s || !ROOTS.has(s[0])) throw new ErrorHttp(400, "invalid ruta");
    const e = entidades.get(s.join("/"));
    if (!e) throw new ErrorHttp(404, "not found");
    try {
      if (!dentro(raiz, fs.realpathSync(abs(e.path)))) throw new ErrorHttp(403, "path not allowed");
    } catch (err) {
      if (err instanceof ErrorHttp) throw err;
      throw new ErrorHttp(404, "not found");
    }
    return e;
  }

  // ----- HTTP -----
  let puerto = 0;
  const sockets = new Set();
  let idleTimer = null;
  let cerrado = false;
  let listo = false; // the first scan is done

  function leerCuerpo(req) {
    return new Promise((resolve, reject) => {
      const partes = [];
      let total = 0;
      req.on("data", (c) => {
        total += c.length;
        if (total > MAX_BODY) { reject(new ErrorHttp(413, "body too large")); req.destroy(); return; }
        partes.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
      req.on("error", reject);
    });
  }

  async function manejar(req, res) {
    const comunes = { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" };
    const writeHead = res.writeHead.bind(res);
    res.writeHead = (status, cab) => writeHead(status, { ...comunes, ...cab });
    res.req = req;

    const permitidos = [`127.0.0.1:${puerto}`, `localhost:${puerto}`];
    if (!permitidos.includes(String(req.headers.host || ""))) throw new ErrorHttp(403, "host not allowed");

    // Cross-site guard: browsers say where a request comes from. Anything from another site (or
    // another origin of this host) is refused, except following a link to the page itself.
    // Requests without the header (curl, scripts, older browsers) pass.
    const sitio = req.headers["sec-fetch-site"];
    if (sitio !== undefined && sitio !== "same-origin" && sitio !== "none") {
      const navegacion = (req.method === "GET" || req.method === "HEAD") && req.url.split("?")[0] === "/"
        && req.headers["sec-fetch-mode"] === "navigate" && req.headers["sec-fetch-dest"] === "document";
      if (!navegacion) throw new ErrorHttp(403, "cross-site request not allowed");
    }

    const crudo = req.url || "/";
    const qi = crudo.indexOf("?");
    const rutaCruda = qi < 0 ? crudo : crudo.slice(0, qi);
    const q = new URLSearchParams(qi < 0 ? "" : crudo.slice(qi + 1));
    if (!rutaCruda.startsWith("/")) throw new ErrorHttp(400, "bad request");
    let segs = [];
    if (rutaCruda !== "/") {
      segs = rutaCruda.slice(1).split("/");
      try { segs = segs.map(decodeURIComponent); } catch { throw new ErrorHttp(400, "bad path encoding"); }
      for (const s of segs) {
        if (s === "" || s === "." || s === ".." || s.includes("/") || s.includes("\\") || s.includes("\0")) throw new ErrorHttp(400, "bad path");
      }
    }
    const metodo = req.method;

    // Old bookmarks and the old abrir.html carry ?t=<token>: send them to the plain address.
    if (metodo === "GET" && segs.length === 0 && q.has("t")) {
      res.writeHead(302, { Location: "/", "Content-Length": 0 });
      res.end();
      return;
    }

    if (!["GET", "HEAD", "POST"].includes(metodo)) throw new ErrorHttp(405, "method not allowed");
    let cuerpo;
    if (metodo === "POST") {
      const origen = req.headers.origin;
      if (origen !== undefined && !permitidos.map((h) => "http://" + h).includes(origen)) throw new ErrorHttp(403, "origin not allowed");
      const tipo = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (tipo !== "application/json") throw new ErrorHttp(415, "Content-Type must be application/json");
      const texto = await leerCuerpo(req);
      try { cuerpo = JSON.parse(texto); } catch { throw new ErrorHttp(400, "invalid JSON body"); }
    }

    const [a, b] = segs;
    // Until the first scan is done the index is empty: say so instead of answering with partial data.
    if (!listo && a === "api" && !(segs.length === 2 && b === "salud")) {
      throw new ErrorHttp(503, "the studio is still being indexed, retry in 1 second", { "Retry-After": "1" });
    }
    if (a === "api") {
      const ruta = segs.slice(1).join("/");
      const rutaPost = { acciones: 1, "papelera/vaciar": 1 }[ruta];
      if (metodo === "POST") {
        if (!rutaPost) throw new ErrorHttp(404, "not found");
        if (ruta === "acciones") {
          if (!esObjeto(cuerpo) || !Array.isArray(cuerpo.acciones)) throw new ErrorHttp(400, "acciones must be an array");
          if (cuerpo.acciones.length > MAX_ACCIONES) throw new ErrorHttp(400, "too many acciones");
          const resultados = cuerpo.acciones.map(aplicarAccion);
          return enviarJson(res, 200, { resultados }, { "Cache-Control": "no-store" });
        }
        return enviarJson(res, 200, vaciarPapelera(cuerpo), { "Cache-Control": "no-store" });
      }
      if (rutaPost) throw new ErrorHttp(405, "method not allowed");
      const nostore = { "Cache-Control": "no-store" };
      if (ruta === "salud") return enviarJson(res, 200, { ok: true, version, pid: process.pid, listo, studio: raiz, entities: entidades.size, scanMs: idx.scanMs }, nostore);
      if (ruta === "estudio") return enviarJson(res, 200, vistaEstudio(), nostore);
      if (ruta === "elementos") return enviarJson(res, 200, elementos(q), nostore);
      if (ruta === "papelera") return enviarJson(res, 200, { entries: entradasPapelera() }, nostore);
      if (ruta === "elemento") return enviarJson(res, 200, vistaElemento(entidadDeConsulta(q)), nostore);
      if (ruta === "versiones-antiguas") {
        // Dry run of the limpiarVersiones action: the files it would move, nothing is changed.
        const e = entidadDeConsulta(q);
        if (e.kind !== "creative" && e.kind !== "video") throw new ErrorHttp(400, "only creatives and videos have versions to clean");
        const files = versionesAntiguas(e);
        return enviarJson(res, 200, { ruta: e.path, total: files.length, files }, nostore);
      }
      throw new ErrorHttp(404, "not found");
    }
    if (metodo === "POST") throw new ErrorHttp(404, "not found");

    if (segs.length === 0) {
      let html;
      try { html = fs.readFileSync(GALERIA_HTML); } catch { throw new ErrorHttp(500, "galeria.html not found"); }
      return enviar(res, 200, html, "text/html; charset=utf-8", { "Cache-Control": "no-store" });
    }
    if (a === "miniatura" && segs.length > 1) return miniatura(req, res, segs.slice(1), q);
    if (ROOTS.has(a) && segs.length > 1) {
      const { real } = resolver(segs);
      return servirArchivo(req, res, real);
    }
    throw new ErrorHttp(404, "not found");
  }

  const server = http.createServer((req, res) => {
    if (idleTimer) idleTimer.refresh();
    manejar(req, res).catch((err) => {
      const status = err instanceof ErrorHttp ? err.status : 500;
      if (res.headersSent) { res.destroy(); return; }
      const cab = { "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...(err instanceof ErrorHttp ? err.cabeceras : {}) };
      try {
        const cuerpo = JSON.stringify({ error: status === 500 ? "internal error" : err.message });
        res.writeHead(status, { ...cab, "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(cuerpo) });
        res.end(res.req && res.req.method === "HEAD" ? undefined : cuerpo);
      } catch { res.destroy(); }
      if (status === 500) console.error("servidor:", err && err.stack ? err.stack : err);
    });
  });
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  server.on("clientError", (err, s) => { if (s.writable) s.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"); });

  // First free port from the base (4317 … 4337); base 0 asks the system for any. The port this
  // studio used last goes first, so a restart keeps its address (and .claude/launch.json) whenever
  // that port is still free.
  const intentos = basePort === 0 ? [0] : Array.from({ length: PORT_TRIES }, (_, i) => basePort + i);
  const ultimo = leerUltimoPuerto(puertoFile);
  if (intentos.includes(ultimo)) intentos.unshift(...intentos.splice(intentos.indexOf(ultimo), 1));
  let ok = false;
  for (const p of intentos) {
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(p, "127.0.0.1", () => { server.off("error", reject); resolve(); });
      });
      ok = true;
      break;
    } catch (err) {
      if (err.code !== "EADDRINUSE") throw err;
    }
  }
  if (!ok) throw new Error(`no free port between ${basePort} and ${basePort + PORT_TRIES - 1}`);
  puerto = server.address().port;

  // ----- keep the index fresh -----
  const pendientes = new Map();
  function programar(segs) {
    const clave = segs.join("/");
    if (pendientes.has(clave)) return;
    const t = setTimeout(() => {
      pendientes.delete(clave);
      if (!listo) return; // the first scan reads the current state; revisarCambios runs when it ends
      try { aplicarCambio(segs); } catch (err) { console.error("servidor: index update failed:", err.message); }
    }, debounceMs);
    t.unref();
    pendientes.set(clave, t);
  }
  let vigia = null;
  if (opts.watch !== false) {
    try {
      vigia = fs.watch(raiz, { recursive: true, persistent: false }, (_ev, nombre) => {
        if (cerrado) return;
        if (!nombre) { programar(["clientes"]); programar(["actores"]); programar(["studio.json"]); return; }
        const segs = String(nombre).split(path.sep).join("/").split("/").filter(Boolean);
        if (segs.length === 0 || segs[0].startsWith(".")) return;
        if (segs[0] === "studio.json" || segs[0] === "actores" || segs[0] === "clientes") {
          // Ignore the hidden temp files of our own atomic writes.
          if (segs[segs.length - 1].startsWith(".")) return;
          programar(segs);
        }
      });
      vigia.on("error", () => { try { vigia.close(); } catch { /* ignore */ } vigia = null; });
    } catch { vigia = null; } // recursive watching is not available here: the periodic check covers it
  }
  const revisor = setInterval(() => {
    if (!listo) return;
    try { revisarCambios(); } catch (err) { console.error("servidor: check failed:", err.message); }
  }, checkMs);
  revisor.unref();

  // ----- state file, idle shutdown, close -----
  const url = `http://127.0.0.1:${puerto}/`;
  fs.mkdirSync(path.dirname(estadoFile), { recursive: true });
  const tmpEstado = `${estadoFile}.tmp-${process.pid}`;
  fs.writeFileSync(tmpEstado, JSON.stringify({ pid: process.pid, port: puerto, startedAt: inicio, version, plugin: pluginRaiz }, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(tmpEstado, 0o600);
  fs.renameSync(tmpEstado, estadoFile);
  // Neither of these is needed to serve the gallery: a failure is logged, never fatal.
  try { escribirAtomico(puertoFile, `${puerto}\n`); } catch (err) { console.error("servidor: could not record the port:", err.message); }
  try { actualizarLaunch(raiz, puerto); } catch (err) { console.error("servidor: could not update .claude/launch.json:", err.message); }

  async function cerrar() {
    if (cerrado) return;
    cerrado = true;
    clearInterval(revisor);
    if (idleTimer) clearTimeout(idleTimer);
    for (const t of pendientes.values()) clearTimeout(t);
    if (vigia) { try { vigia.close(); } catch { /* ignore */ } }
    try {
      const estado = JSON.parse(fs.readFileSync(estadoFile, "utf8"));
      if (estado.pid === process.pid && estado.startedAt === inicio) fs.rmSync(estadoFile, { force: true });
    } catch { /* already gone */ }
    await new Promise((resolve) => {
      server.close(() => resolve());
      if (server.closeAllConnections) server.closeAllConnections();
      for (const s of sockets) s.destroy();
    });
  }

  if (idleMin > 0) {
    idleTimer = setTimeout(() => {
      Promise.resolve(opts.onIdle ? opts.onIdle() : cerrar()).catch(() => {});
    }, idleMin * 60000);
    idleTimer.unref();
  }

  // The scan starts now: the server already listens and servidor.json is written. `listo` resolves
  // when the index is complete (or the server was closed first).
  const listoPromesa = (async () => {
    const t0 = process.hrtime.bigint();
    if (scanDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, scanDelayMs));
    if (cerrado) return;
    await escaneoInicial();
    if (cerrado) return;
    idx.scanMs = Math.round(Number(process.hrtime.bigint() - t0) / 1e6) - scanDelayMs;
    listo = true;
    try { revisarCambios(); } catch (err) { console.error("servidor: check failed:", err.message); } // what changed during the scan
  })().catch((err) => {
    // Serve what was indexed rather than answer 503 for ever; the periodic check fills the rest.
    console.error("servidor: scan failed:", err && err.stack ? err.stack : err);
    listo = true;
  });

  return { server, port: puerto, url, studio: raiz, close: cerrar, listo: listoPromesa };
}

// ---------- command line ----------

async function main() {
  const args = process.argv.slice(2);
  const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const studio = valor("--studio");
  if (!studio) { console.error("usage: servidor.mjs --studio <studio folder> [--port <base port>]"); process.exit(2); }
  const port = valor("--port");
  let srv;
  let pedido = false; // a stop signal that arrived while the server was still starting
  const apagar = async () => {
    if (!srv) { pedido = true; return; }
    await srv.close();
    process.exit(0);
  };
  // Before starting: servidor.json is written during start, so a SIGTERM in that window must still
  // shut down cleanly and remove it.
  process.on("SIGTERM", apagar);
  process.on("SIGINT", apagar);
  try {
    srv = await crearServidor({ studio, port: port === undefined ? undefined : Number(port), onIdle: apagar });
  } catch (err) {
    console.error("servidor: " + err.message);
    process.exit(1);
  }
  if (pedido) await apagar();
  console.log(`UGC Studio gallery on http://127.0.0.1:${srv.port}/ (pid ${process.pid})`);
}

const esPrincipal = (() => {
  try { return process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url; } catch { return false; }
})();
if (esPrincipal) await main();
