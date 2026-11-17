#!/bin/sh
# Benchmark of the gallery on a big studio (default: 2,000 creatives, about 14,000 files).
#
#   sh tests/bench-galeria.sh [creatives]
#
# Builds a throwaway studio, then measures:
#   - the hook (scripts/sincronizar.sh) per change: target < 0.5 s
#   - the server cold start / full scan
#   - GET /api/elementos latency (p50, p95)
# Needs Node 18+. Prints the numbers and exits 1 if the hook misses its target.

set -u
REPO=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
export REPO TMP
export CLAUDE_PLUGIN_ROOT="$REPO/plugins/ugc-studio"
export CLAUDE_PROJECT_DIR="$TMP/estudio"
export UGC_GALERIA_PORT=0
export UGC_GALERIA_IDLE_MIN=10
export BENCH_CREATIVES=${1:-2000}

cleanup() {
  sh "$CLAUDE_PLUGIN_ROOT/scripts/galeria.sh" stop >/dev/null 2>&1
  rm -rf "$TMP"
}
trap cleanup EXIT

node --input-type=module - <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";

const { REPO, TMP, BENCH_CREATIVES } = process.env;
const studio = process.env.CLAUDE_PROJECT_DIR;
const galeria = path.join(REPO, "plugins/ugc-studio/scripts/galeria.sh");
const hook = path.join(REPO, "plugins/ugc-studio/scripts/sincronizar.sh");
const N = Number(BENCH_CREATIVES);

// ----- build the studio -----
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const put = (rel, content) => {
  const f = path.join(studio, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
};
const json = (o) => JSON.stringify(o, null, 2) + "\n";
let files = 0;
const w = (rel, c) => { put(rel, c); files++; };
w("studio.json", json({ credits: { available: 100 }, createdAt: "2026-01-01T00:00:00Z" }));
for (let a = 0; a < 20; a++) {
  w(`actores/actor-${a}-v1/actor.json`, json({ id: `actor-${a}-v1`, name: `Actor ${a}`, createdAt: "2026-01-01T00:00:00Z" }));
  for (const f of ["retrato.png", "angulos.png", "character-sheet.png"]) w(`actores/actor-${a}-v1/${f}`, PNG);
}
const clientes = 8;
const productosPorCliente = 10;
const angulos = ["Dolor", "Precio", "Humor", "Prueba social", "Urgencia", "Comparación", "Beneficio", "Problema"];
let hechos = 0;
for (let c = 0; c < clientes; c++) {
  const cid = `cliente-${c}`;
  w(`clientes/${cid}/marca/marca.json`, json({ name: `Cliente ${c} SRL`, logo: "logo.png" }));
  w(`clientes/${cid}/marca/logo.png`, PNG);
  for (let p = 0; p < productosPorCliente; p++) {
    const pid = `MLA${c}${String(p).padStart(3, "0")}`;
    const base = `clientes/${cid}/${pid}`;
    w(`${base}/producto.json`, json({ profileId: cid, clientName: `Cliente ${c} SRL`, productId: pid, title: `Producto número ${p} del cliente ${c}`, cover: "fotos/foto-1.jpg", createdAt: "2026-01-01T00:00:00Z" }));
    w(`${base}/ficha.md`, "# ficha\n");
    for (let f = 1; f <= 3; f++) w(`${base}/fotos/foto-${f}.jpg`, PNG);
    const aqui = Math.ceil((N - hechos) / (clientes * productosPorCliente - (c * productosPorCliente + p)));
    for (let k = 0; k < aqui; k++, hechos++) {
      const id = `2026-02-${String((k % 28) + 1).padStart(2, "0")}-prod${p}-concepto-${k}`;
      const dir = `${base}/creativos/${id}`;
      w(`${dir}/creativo.json`, json({
        id, batch: `2026-02-01-lote-${k % 5}`, title: `Concepto ${k} del producto ${p}`, type: "static", status: ["draft", "approved", "discarded"][k % 3],
        concept: { angle: angulos[k % angulos.length], awareness: "Consciente del problema", visual: "Persona usando el producto", why: "Distinto a los otros" },
        actorId: `actor-${k % 20}-v1`, textMode: "template", layout: "titular", slots: ["4x5", "9x16"],
        copy: { primaryText: "Texto principal del anuncio", headline: "Titular", description: "Envío gratis", cta: "Comprar" },
        adName: `${pid}_${angulos[k % angulos.length].toLowerCase()}_actor_estatica`, credits: 5.5,
        versions: [{ n: 1, slots: ["4x5", "9x16"], credits: 5.5, createdAt: "2026-02-01T10:00:00Z" }],
        createdAt: `2026-02-${String((k % 28) + 1).padStart(2, "0")}T10:00:00Z`, updatedAt: `2026-02-${String((k % 28) + 1).padStart(2, "0")}T11:00:00Z`,
      }));
      w(`${dir}/prompt-v1.md`, "prompt\n");
      for (const s of ["4x5", "9x16"]) {
        w(`${dir}/${s}-base-v1.png`, PNG);
        w(`${dir}/${s}-diseno-v1.html`, "<html></html>\n");
        w(`${dir}/${s}-v1.png`, PNG);
      }
    }
  }
}
console.log(`studio: ${hechos} creatives, ${files} files`);

// ----- helpers -----
const run = (cmd, args) => {
  const t0 = performance.now();
  const r = spawnSync(cmd, args, { env: process.env, encoding: "utf8" });
  return { ms: performance.now() - t0, status: r.status, out: r.stdout, err: r.stderr };
};
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const f1 = (x) => x.toFixed(1);

// ----- hook: first run (validates every file, starts the server) -----
const first = run("sh", [hook, "--resumen"]);
console.log(`hook --resumen (validates all, starts the server): ${f1(first.ms)} ms, exit ${first.status}`);
if (first.status !== 0) console.log(first.err);

// ----- cold server start -----
run("sh", [galeria, "stop"]);
const cold = run("sh", [galeria, "start"]);
const url = new URL(cold.out.trim());
const base = `http://127.0.0.1:${url.port}`;
// `start` prints the address without the token; `url` is the private one.
const token = new URL(run("sh", [galeria, "url"]).out.trim()).searchParams.get("t");
const get = async (p) => {
  const r = await fetch(base + p, { headers: { "X-UGC-Token": token } });
  return r.json();
};
// The server listens first and indexes right after: wait for `listo`.
const t0ready = performance.now();
let salud;
do {
  salud = await get("/api/salud");
  if (!salud.listo) await new Promise((r) => setTimeout(r, 5));
} while (!salud.listo);
const readyMs = cold.ms + (performance.now() - t0ready);
console.log(`server cold start (galeria.sh start until it listens): ${f1(cold.ms)} ms; until the index is ready: ${f1(readyMs)} ms; full scan inside the server: ${salud.scanMs} ms; ${salud.entities} entities`);

// ----- hook per change -----
const targets = [];
for (const c of ["cliente-0", "cliente-3", "cliente-7"]) targets.push(`clientes/${c}/MLA${c.slice(-1)}005/creativos`);
const tiempos = [];
const sinCambio = [];
const rounds = 15;
for (let i = 0; i < rounds; i++) {
  const dir = path.join(studio, targets[i % targets.length]);
  const ids = fs.readdirSync(dir);
  const f = path.join(dir, ids[i % ids.length], "creativo.json");
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  j.status = ["draft", "approved", "discarded"][(i + 1) % 3];
  j.updatedAt = new Date().toISOString();
  await new Promise((r) => setTimeout(r, 20));
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
  const r = run("sh", [hook]);
  if (r.status !== 0) console.log("hook exit", r.status, r.err);
  tiempos.push(r.ms);
  await new Promise((r2) => setTimeout(r2, 20));
  sinCambio.push(run("sh", [hook]).ms);
}
const objetivo = 500;
const p95 = pct(tiempos, 95);
console.log(`hook per change (n=${rounds}): median ${f1(pct(tiempos, 50))} ms, p95 ${f1(p95)} ms, max ${f1(Math.max(...tiempos))} ms  [target < ${objetivo} ms: ${p95 < objetivo ? "PASS" : "FAIL"}]`);
console.log(`hook with nothing changed (n=${rounds}): median ${f1(pct(sinCambio, 50))} ms, p95 ${f1(pct(sinCambio, 95))} ms`);

// ----- /api/elementos -----
const consultas = [
  "/api/elementos",
  "/api/elementos?tipo=creative&porPagina=48&pagina=3",
  "/api/elementos?tipo=creative&cliente=cliente-2&estado=approved",
  "/api/elementos?tipo=creative&q=comparacion",
  "/api/elementos?q=producto+numero+4+cliente+5",
  "/api/elementos?tipo=creative&producto=MLA3004&orden=titulo",
  "/api/elementos?tipo=creative&orden=antiguo&pagina=40",
  "/api/elementos?q=actor+7&archivados=1",
];
for (let i = 0; i < 5; i++) await get(consultas[i % consultas.length]); // warm up
const lat = [];
for (let i = 0; i < 300; i++) {
  const t0 = performance.now();
  const r = await get(consultas[i % consultas.length]);
  lat.push(performance.now() - t0);
  if (typeof r.total !== "number") console.log("unexpected answer", r);
}
console.log(`GET /api/elementos (n=300, ${consultas.length} query shapes): p50 ${f1(pct(lat, 50))} ms, p95 ${f1(pct(lat, 95))} ms, max ${f1(Math.max(...lat))} ms`);
const datos = performance.now();
const d = await fetch(base + "/datos.js", { headers: { "X-UGC-Token": token } });
const bytes = (await d.arrayBuffer()).byteLength;
console.log(`GET /datos.js (compatibility, ${(bytes / 1e6).toFixed(1)} MB): ${f1(performance.now() - datos)} ms`);
process.exit(p95 < objetivo ? 0 : 1);
EOF
