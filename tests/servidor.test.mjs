// Tests for plugins/ugc-studio/servidor/servidor.mjs, run against throwaway studios.
//
//   node --test tests/servidor.test.mjs
//
// Every studio lives under os.tmpdir() and is removed when its test ends.

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import vm from "node:vm";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = path.join(REPO, "plugins", "ugc-studio");
const SERVIDOR = path.join(PLUGIN, "servidor", "servidor.mjs");
const { crearServidor } = await import(SERVIDOR);

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const hasTool = (name) => spawnSync("sh", ["-c", `command -v ${name}`]).status === 0;

// ---------- helpers ----------

const scratch = [];
function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratch.push(d);
  return d;
}
after(() => {
  for (const d of scratch) fs.rmSync(d, { recursive: true, force: true });
});

function write(root, rel, content) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof content === "string" || Buffer.isBuffer(content) ? content : JSON.stringify(content, null, 2) + "\n");
  return f;
}

// The fixture of tests/sincronizar.test.sh: one actor, one product, one video.
function estudioBasico() {
  const s = tmp("ugc-srv-");
  write(s, "studio.json", '{"credits": {"available": 10}}\n');
  write(s, "actores/ana-v1/actor.json", '{"id": "ana-v1", "name": "Ana"}\n');
  write(s, "actores/ana-v1/retrato.png", "");
  write(s, "clientes/acme/MLA1/producto.json", '{"title": "Producto"}\n');
  fs.mkdirSync(path.join(s, "clientes/acme/MLA1/fotos"), { recursive: true });
  write(s, "clientes/acme/MLA1/videos/2026-01-01-x-y/video.json",
    '{"title": "Video", "status": "draft", "versions": [{"n": 1}]}\n');
  return s;
}

const C1 = "clientes/acme/MLA1/creativos/2026-01-02-x-dolor";
const C2 = "clientes/acme/MLA1/creativos/2026-01-03-x-precio";
const C3 = "clientes/acme/MLA1/creativos/2026-01-04-x-viejo";
const V1 = "clientes/acme/MLA1/videos/2026-01-01-cama-problema";

// A richer studio: two clients, accents, archived items, versions.
function estudioRico() {
  const s = tmp("ugc-srv-");
  write(s, "studio.json", { credits: { available: 50 }, createdAt: "2026-01-01T00:00:00Z" });
  write(s, "actores/ana-v1/actor.json", { id: "ana-v1", name: "Ana María", createdAt: "2026-01-01T10:00:00Z" });
  write(s, "actores/ana-v1/retrato.png", PNG);
  write(s, "clientes/acme/marca/marca.json", { name: "Acme SRL", logo: "logo.png" });
  write(s, "clientes/acme/marca/logo.png", PNG);
  write(s, "clientes/acme/MLA1/producto.json",
    { profileId: "acme", clientName: "Acme SRL", productId: "MLA1", title: "Ñandú de madera", cover: "fotos/f1.png", createdAt: "2026-01-01T11:00:00Z" });
  write(s, "clientes/acme/MLA1/fotos/f1.png", PNG);
  write(s, "clientes/acme/MLA1/fotos/f2.png", PNG);
  write(s, `${C1}/creativo.json`, {
    id: "2026-01-02-x-dolor", batch: "lote-1", title: "Agacharse ya no duele", type: "static", status: "draft",
    concept: { angle: "Dolor de espalda" }, actorId: "ana-v1", slots: ["4x5"],
    copy: { primaryText: "Subí la cama." }, adName: "MLA1_dolor_ana_estatica", credits: 5.5,
    versions: [{ n: 1, slots: ["4x5"] }, { n: 2, slots: ["4x5"] }], createdAt: "2026-01-02T10:00:00Z", updatedAt: "2026-01-02T12:00:00Z",
  });
  write(s, `${C1}/4x5-v1.png`, PNG);
  write(s, `${C1}/4x5-v2.png`, PNG);
  write(s, `${C2}/creativo.json`, {
    id: "2026-01-03-x-precio", batch: "lote-2", title: "Precio bajo", type: "static", status: "approved",
    concept: { angle: "Precio" }, actorId: null, slots: ["9x16"], adName: "MLA1_precio_producto_estatica",
    createdAt: "2026-01-03T10:00:00Z", updatedAt: "2026-01-03T12:00:00Z",
  });
  write(s, `${C2}/9x16-v1.png`, PNG);
  write(s, `${C3}/creativo.json`, {
    id: "2026-01-04-x-viejo", batch: "lote-2", title: "Concepto viejo", type: "static", status: "draft",
    concept: { angle: "Humor" }, slots: ["4x5"], archived: true, archivedAt: "2026-02-01T00:00:00Z",
    createdAt: "2026-01-04T10:00:00Z", updatedAt: "2026-01-04T12:00:00Z",
  });
  write(s, `${C3}/4x5-v1.png`, PNG);
  write(s, `${V1}/video.json`, {
    id: "2026-01-01-cama-problema", title: "La cama pegada al piso", actorId: "ana-v1", status: "draft",
    angle: "Problema → solución", hook: "¿Ustedes también tienen la cama pegada?", versions: [{ n: 1 }],
    createdAt: "2026-01-01T17:40:00Z", updatedAt: "2026-01-01T18:05:00Z",
  });
  write(s, `${V1}/borrador-v1.mp4`, Buffer.from("0123456789abcdefghij"));
  write(s, `${V1}/thumb-v1.jpg`, PNG);
  write(s, "clientes/beta/MLB2/producto.json",
    { profileId: "beta", clientName: "Beta Hogar", productId: "MLB2", title: "Lámpara de pie", createdAt: "2026-01-05T00:00:00Z" });
  write(s, "clientes/beta/MLB2/fotos/l.png", PNG);
  return s;
}

const servers = [];
// The server listens before it has indexed the studio; unless a test is about that, wait for the index.
async function iniciar(studio, opts = {}) {
  const { sinEsperar, ...resto } = opts;
  const srv = await crearServidor({ studio, port: 0, idleMin: 0, debounceMs: 40, checkMs: 10000, ...resto });
  servers.push(srv);
  if (!sinEsperar) await srv.listo;
  return srv;
}
after(async () => {
  for (const s of servers) await s.close().catch(() => {});
});

// Raw request: the path is sent as given (no normalization), the Host header can be overridden.
function req(srv, { method = "GET", path: p = "/", headers = {}, body, auth = true, port } = {}) {
  return new Promise((resolve, reject) => {
    const h = { ...headers };
    if (auth && !("X-UGC-Token" in h) && !("Cookie" in h)) h["X-UGC-Token"] = srv.token;
    const r = http.request({ host: "127.0.0.1", port: port || srv.port, method, path: p, headers: h }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({
          status: res.statusCode, headers: res.headers, buf, text: buf.toString("utf8"),
          json: () => JSON.parse(buf.toString("utf8")),
        });
      });
    });
    r.on("error", reject);
    if (body !== undefined) r.write(body);
    r.end();
  });
}
const getJson = async (srv, p) => {
  const r = await req(srv, { path: p });
  assert.equal(r.status, 200, `GET ${p} -> ${r.status} ${r.text}`);
  return r.json();
};
const accion = async (srv, acciones) => {
  const r = await req(srv, {
    method: "POST", path: "/api/acciones", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acciones }),
  });
  assert.equal(r.status, 200, r.text);
  return r.json().resultados;
};
const leer = (s, rel) => JSON.parse(fs.readFileSync(path.join(s, rel), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperar(fn, ms = 4000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) { last = e; }
    await sleep(40);
  }
  assert.fail("timed out waiting: " + (last && last.message ? last.message : String(last)));
}
const todos = (s) => fs.readdirSync(s, { recursive: true }).map(String);

// ---------- /datos.js (compatibility with the old index) ----------

describe("/datos.js", () => {
  test("has the shape sincronizar.sh used to build, for the same fixture", async () => {
    const s = estudioBasico();
    const srv = await iniciar(s);
    const r = await req(srv, { path: "/datos.js" });
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /javascript/);
    assert.ok(r.text.startsWith("window.ESTUDIO = "));
    const ctx = { window: {} };
    vm.runInNewContext(r.text, ctx);
    const e = JSON.parse(JSON.stringify(ctx.window.ESTUDIO)); // plain objects of this realm
    assert.deepEqual(Object.keys(e), ["generatedAt", "build", "studio", "entities"]);
    assert.match(e.generatedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.ok(e.build);
    assert.equal(e.studio, '{"credits": {"available": 10}}\n');
    assert.deepEqual(e.entities.map((x) => x.kind), ["actor", "product", "video"]);
    assert.deepEqual(e.entities[0], {
      kind: "actor", path: "actores/ana-v1", json: '{"id": "ana-v1", "name": "Ana"}\n', files: ["actor.json", "retrato.png"],
    });
    assert.deepEqual(e.entities[1], {
      kind: "product", path: "clientes/acme/MLA1", json: '{"title": "Producto"}\n', files: ["producto.json"],
    });
    assert.equal(e.entities[2].path, "clientes/acme/MLA1/videos/2026-01-01-x-y");
    assert.deepEqual(e.entities[2].files, ["video.json"]);
    assert.equal(JSON.parse(e.entities[2].json).status, "draft");
  });

  test("lists brands and creatives, product photos under fotos/, and odd file names", async () => {
    const s = estudioRico();
    write(s, `${C1}/comi"lla.png`, "");
    write(s, `${C1}/barra\\invertida.png`, "");
    write(s, `${C1}/.oculto.png`, "");
    const srv = await iniciar(s);
    const ctx = { window: {} };
    vm.runInNewContext((await req(srv, { path: "/datos.js" })).text, ctx);
    const e = JSON.parse(JSON.stringify(ctx.window.ESTUDIO)); // plain objects of this realm
    const kinds = e.entities.map((x) => x.kind);
    assert.deepEqual(kinds, ["actor", "product", "product", "brand", "video", "creative", "creative", "creative"]);
    const brand = e.entities.find((x) => x.kind === "brand");
    assert.equal(brand.path, "clientes/acme/marca");
    assert.deepEqual(brand.files, ["logo.png", "marca.json"]);
    const prod = e.entities.find((x) => x.path === "clientes/acme/MLA1");
    assert.deepEqual(prod.files, ["producto.json", "fotos/f1.png", "fotos/f2.png"]);
    const c1 = e.entities.find((x) => x.path === C1);
    assert.deepEqual(c1.files, ['4x5-v1.png', '4x5-v2.png', 'barra\\invertida.png', 'comi"lla.png', "creativo.json"]);
  });

  test("a broken JSON keeps its entity (raw text) and is marked broken in the API", async () => {
    const s = estudioBasico();
    write(s, "actores/ana-v1/actor.json", '{"name": "Ana",}');
    const srv = await iniciar(s);
    const ctx = { window: {} };
    vm.runInNewContext((await req(srv, { path: "/datos.js" })).text, ctx);
    const a = ctx.window.ESTUDIO.entities.find((x) => x.kind === "actor");
    assert.equal(a.json, '{"name": "Ana",}');
    const items = (await getJson(srv, "/api/elementos?tipo=actor")).items;
    assert.equal(items.length, 1);
    assert.equal(items[0].broken, true);
    const [r] = await accion(srv, [{ tipo: "archivar", ruta: "actores/ana-v1" }]);
    assert.equal(r.ok, false);
    assert.equal(fs.readFileSync(path.join(s, "actores/ana-v1/actor.json"), "utf8"), '{"name": "Ana",}');
  });

  test("GET / serves the plugin's galeria.html; studio files keep their relative paths", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const home = await req(srv, { path: "/" });
    assert.equal(home.status, 200);
    assert.match(home.headers["content-type"], /text\/html/);
    assert.equal(home.text, fs.readFileSync(path.join(PLUGIN, "galeria", "galeria.html"), "utf8"));
    const img = await req(srv, { path: "/clientes/acme/MLA1/fotos/f1.png" });
    assert.equal(img.status, 200);
    assert.equal(img.headers["content-type"], "image/png");
    assert.deepEqual(img.buf, PNG);
    const sp = write(s, "clientes/acme/MLA1/fotos/con espacio ñ.png", PNG);
    const r = await req(srv, { path: "/clientes/acme/MLA1/fotos/" + encodeURIComponent("con espacio ñ.png") });
    assert.equal(r.status, 200, sp);
    assert.equal((await req(srv, { path: "/clientes/acme/MLA1/fotos/nada.png" })).status, 404);
  });

  test("Range requests on a video (206, 416) and HEAD", async () => {
    const srv = await iniciar(estudioRico());
    const p = `/${V1}/borrador-v1.mp4`;
    const all = await req(srv, { path: p });
    assert.equal(all.headers["content-type"], "video/mp4");
    assert.equal(all.headers["accept-ranges"], "bytes");
    assert.equal(all.text, "0123456789abcdefghij");
    const part = await req(srv, { path: p, headers: { Range: "bytes=2-5" } });
    assert.equal(part.status, 206);
    assert.equal(part.headers["content-range"], "bytes 2-5/20");
    assert.equal(part.text, "2345");
    const tail = await req(srv, { path: p, headers: { Range: "bytes=-3" } });
    assert.equal(tail.status, 206);
    assert.equal(tail.text, "hij");
    const open = await req(srv, { path: p, headers: { Range: "bytes=15-" } });
    assert.equal(open.text, "fghij");
    const bad = await req(srv, { path: p, headers: { Range: "bytes=50-60" } });
    assert.equal(bad.status, 416);
    assert.equal(bad.headers["content-range"], "bytes */20");
    const head = await req(srv, { method: "HEAD", path: p });
    assert.equal(head.status, 200);
    assert.equal(head.headers["content-length"], "20");
    assert.equal(head.buf.length, 0);
  });
});

// ---------- security ----------

describe("token, cookie and Host", () => {
  test("requests without the token are rejected, with it they pass", async () => {
    const srv = await iniciar(estudioBasico());
    for (const p of ["/", "/datos.js", "/api/estudio", "/api/elementos", "/api/papelera", "/actores/ana-v1/actor.json"]) {
      const r = await req(srv, { path: p, auth: false });
      assert.equal(r.status, 401, p);
      assert.ok(!r.text.includes("ana-v1") && !r.text.includes("credits"), "no data in " + p);
    }
    assert.equal((await req(srv, { path: "/api/estudio", headers: { "X-UGC-Token": "x".repeat(64) } })).status, 401);
    assert.equal((await req(srv, { path: "/api/estudio", headers: { "X-UGC-Token": "" } })).status, 401);
    const ok = await req(srv, { path: "/api/salud" });
    assert.equal(ok.status, 200);
    const salud = ok.json();
    assert.equal(salud.ok, true);
    assert.equal(salud.entities, 3);
    assert.ok(salud.version);
    assert.equal(salud.studio, fs.realpathSync(srv.studio));
  });

  test("the token is random, 32 bytes (64 hex), different on every start", async () => {
    const s = estudioBasico();
    const a = await iniciar(s);
    const b = await iniciar(s);
    assert.match(a.token, /^[0-9a-f]{64}$/);
    assert.notEqual(a.token, b.token);
  });

  test("/?t=<token> sets an HttpOnly SameSite=Strict cookie and redirects to /; the cookie then works", async () => {
    const srv = await iniciar(estudioBasico());
    const r = await req(srv, { path: "/?t=" + srv.token, auth: false });
    assert.equal(r.status, 302);
    assert.equal(r.headers.location, "/");
    const cookie = [].concat(r.headers["set-cookie"])[0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.ok(cookie.includes(srv.token));
    const pair = cookie.split(";")[0];
    const withCookie = await req(srv, { path: "/api/estudio", auth: false, headers: { Cookie: pair } });
    assert.equal(withCookie.status, 200);
    assert.equal((await req(srv, { path: "/api/estudio", auth: false, headers: { Cookie: "ugc_galeria=" + "0".repeat(64) } })).status, 401);
    const bad = await req(srv, { path: "/?t=" + "0".repeat(64), auth: false });
    assert.equal(bad.status, 401);
    assert.equal(bad.headers["set-cookie"], undefined);
    // The token in the query string is only honored on "/".
    assert.equal((await req(srv, { path: "/api/estudio?t=" + srv.token, auth: false })).status, 401);
  });

  test("a Host header that is not 127.0.0.1:<port> or localhost:<port> is rejected (DNS rebinding)", async () => {
    const srv = await iniciar(estudioBasico());
    const p = srv.port;
    for (const host of ["evil.example", `evil.example:${p}`, `127.0.0.1:${p + 1}`, "127.0.0.1", `localhost:${p + 1}`, `127.0.0.1.evil.example:${p}`]) {
      const r = await req(srv, { path: "/api/salud", headers: { Host: host } });
      assert.equal(r.status, 403, `Host [${host}]`);
    }
    // No Host header at all (HTTP/1.0 over a raw socket).
    const sinHost = await new Promise((resolve, reject) => {
      const sock = net.connect(p, "127.0.0.1", () => sock.write(`GET /api/salud HTTP/1.0\r\nX-UGC-Token: ${srv.token}\r\n\r\n`));
      let out = "";
      sock.on("data", (d) => (out += d));
      sock.on("close", () => resolve(out));
      sock.on("error", reject);
    });
    assert.match(sinHost, /^HTTP\/1\.[01] 403/);
    // Even the cookie hand-off refuses a foreign Host.
    const r = await req(srv, { path: "/?t=" + srv.token, auth: false, headers: { Host: "evil.example" } });
    assert.equal(r.status, 403);
    assert.equal(r.headers["set-cookie"], undefined);
    assert.equal((await req(srv, { path: "/api/salud", headers: { Host: `localhost:${p}` } })).status, 200);
    assert.equal((await req(srv, { path: "/api/salud", headers: { Host: `127.0.0.1:${p}` } })).status, 200);
  });

  test("binds 127.0.0.1 only", async () => {
    const srv = await iniciar(estudioBasico());
    assert.equal(srv.server.address().address, "127.0.0.1");
  });

  test("a foreign Origin is rejected on mutations", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const before = fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8");
    const r = await req(srv, {
      method: "POST", path: "/api/acciones",
      headers: { "Content-Type": "application/json", Origin: "http://evil.example" },
      body: JSON.stringify({ acciones: [{ tipo: "estado", ruta: C1, valor: "approved" }] }),
    });
    assert.equal(r.status, 403);
    assert.equal(fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8"), before);
  });
});

describe("mutations need POST with application/json", () => {
  test("other content types and methods are rejected and change nothing", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const before = todos(s).sort();
    const file = fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8");
    const body = JSON.stringify({ acciones: [{ tipo: "papelera", ruta: C1 }] });
    for (const ct of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", undefined]) {
      const r = await req(srv, { method: "POST", path: "/api/acciones", headers: ct ? { "Content-Type": ct } : {}, body });
      assert.equal(r.status, 415, String(ct));
    }
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      const r = await req(srv, { method, path: "/api/acciones", headers: { "Content-Type": "application/json" }, body });
      assert.ok([400, 404, 405].includes(r.status), method + " -> " + r.status);
    }
    assert.equal((await req(srv, { method: "POST", path: "/api/papelera/vaciar", headers: { "Content-Type": "text/plain" }, body: "{}" })).status, 415);
    assert.deepEqual(todos(s).sort(), before);
    assert.equal(fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8"), file);
    const ok = await req(srv, { method: "POST", path: "/api/acciones", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ acciones: [] }) });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.json(), { resultados: [] });
    const bad = await req(srv, { method: "POST", path: "/api/acciones", headers: { "Content-Type": "application/json" }, body: "{no json" });
    assert.equal(bad.status, 400);
  });
});

describe("path traversal", () => {
  test("URL paths with .., encoded dots or slashes, and hidden folders are rejected", async () => {
    const s = estudioBasico();
    const srv = await iniciar(s);
    const secret = path.join(path.dirname(s), "ugc-secreto-" + path.basename(s));
    fs.writeFileSync(secret, "SECRETO");
    scratch.push(secret);
    const bad = [
      "/clientes/../studio.json",
      "/clientes/acme/../../studio.json",
      "/clientes/%2e%2e/studio.json",
      "/clientes/%2E%2E/%2E%2E/" + path.basename(s) + "/studio.json",
      "/clientes/acme%2f..%2f..%2fstudio.json",
      "/clientes/acme/MLA1/..%5C..%5Cstudio.json",
      "/actores/ana-v1/../../../../../../../../etc/hosts",
      "/..%2f..%2f..%2f..%2f..%2f..%2fetc/hosts",
      "/clientes/%00",
      "//etc/hosts",
      "/.galeria/servidor.json",
      "/.papelera/x",
      "/" + "%2e".repeat(1) + "galeria/servidor.json",
    ];
    for (const p of bad) {
      const r = await req(srv, { path: p });
      assert.ok([400, 403, 404].includes(r.status), `${p} -> ${r.status}`);
      assert.ok(!r.text.includes("SECRETO") && !r.text.includes("available") && !r.text.includes(srv.token), p);
    }
    for (const p of ["/miniatura/../studio.json", "/miniatura/%2e%2e/studio.json"]) {
      const r = await req(srv, { path: p });
      assert.ok([400, 403, 404].includes(r.status), p);
      assert.ok(!r.text.includes("available"));
    }
  });

  test("a symlink that escapes the studio is not served, thumbnailed or acted on", async () => {
    const s = estudioBasico();
    const outside = tmp("ugc-fuera-");
    fs.writeFileSync(path.join(outside, "secreto.txt"), "SECRETO");
    fs.writeFileSync(path.join(outside, "foto.png"), PNG);
    fs.mkdirSync(path.join(outside, "carpeta"));
    fs.writeFileSync(path.join(outside, "carpeta", "x.txt"), "X");
    fs.symlinkSync(path.join(outside, "secreto.txt"), path.join(s, "clientes/acme/MLA1/fotos/escape.txt"));
    fs.symlinkSync(path.join(outside, "foto.png"), path.join(s, "clientes/acme/MLA1/fotos/escape.png"));
    fs.symlinkSync(outside, path.join(s, "clientes/acme/MLA1/enlace"));
    fs.symlinkSync(path.join(outside, "carpeta"), path.join(s, "actores/enlace-actor"));
    const srv = await iniciar(s);
    for (const p of [
      "/clientes/acme/MLA1/fotos/escape.txt", "/clientes/acme/MLA1/enlace/secreto.txt",
      "/miniatura/clientes/acme/MLA1/fotos/escape.png?w=480", "/miniatura/clientes/acme/MLA1/enlace/foto.png?w=480",
    ]) {
      const r = await req(srv, { path: p });
      assert.ok([403, 404].includes(r.status), `${p} -> ${r.status}`);
      assert.ok(!r.text.includes("SECRETO"));
      assert.notDeepEqual(r.buf, PNG, p);
    }
    const r = await req(srv, { path: "/api/elemento?ruta=" + encodeURIComponent("clientes/acme/MLA1/enlace") });
    assert.ok([400, 403, 404].includes(r.status));
    const res = await accion(srv, [
      { tipo: "papelera", ruta: "clientes/acme/MLA1/fotos/escape.txt" },
      { tipo: "papelera", ruta: "clientes/acme/MLA1/enlace/carpeta" },
      { tipo: "papelera", ruta: "clientes/acme/MLA1/enlace" },
      { tipo: "papelera", ruta: "actores/enlace-actor" },
    ]);
    assert.deepEqual(res.map((x) => x.ok), [false, false, false, false]);
    assert.equal(fs.readFileSync(path.join(outside, "secreto.txt"), "utf8"), "SECRETO");
    assert.equal(fs.readFileSync(path.join(outside, "carpeta", "x.txt"), "utf8"), "X");
    assert.ok(fs.existsSync(path.join(s, "clientes/acme/MLA1/fotos/escape.txt")));
    assert.ok(!fs.existsSync(path.join(s, ".papelera")) || fs.readdirSync(path.join(s, ".papelera")).length === 0);
  });

  test("actions reject .., absolute paths and unknown paths", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const outside = tmp("ugc-fuera-");
    fs.writeFileSync(path.join(outside, "creativo.json"), "{}");
    const res = await accion(srv, [
      { tipo: "papelera", ruta: "../" + path.basename(outside) },
      { tipo: "papelera", ruta: `${C1}/../../../../MLA1` },
      { tipo: "papelera", ruta: outside },
      { tipo: "papelera", ruta: "/etc/hosts" },
      { tipo: "archivar", ruta: path.join(outside) },
      { tipo: "estado", ruta: "../" + path.basename(outside), valor: "draft" },
      { tipo: "papelera", ruta: "" },
      { tipo: "papelera" },
      { tipo: "papelera", ruta: "clientes/acme/no-existe" },
      { tipo: "papelera", ruta: `${C1}\\..` },
      { tipo: "restaurar", ruta: "../../studio.json" },
    ]);
    assert.ok(res.every((x) => x.ok === false && typeof x.error === "string"), JSON.stringify(res));
    assert.equal(fs.readFileSync(path.join(outside, "creativo.json"), "utf8"), "{}");
    assert.ok(fs.existsSync(path.join(s, C1)));
    const r = await req(srv, { path: "/api/elemento?ruta=" + encodeURIComponent("../x") });
    assert.equal(r.status, 400);
    assert.equal((await req(srv, { path: "/api/elemento?ruta=" + encodeURIComponent("/etc/hosts") })).status, 400);
  });

  test(".galeria, .papelera and studio.json are never deletable", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const [t] = await accion(srv, [{ tipo: "papelera", ruta: `${C3}` }]);
    assert.equal(t.ok, true);
    const id = fs.readdirSync(path.join(s, ".papelera"))[0];
    const res = await accion(srv, [
      { tipo: "papelera", ruta: ".galeria" },
      { tipo: "papelera", ruta: ".papelera" },
      { tipo: "papelera", ruta: `.papelera/${id}` },
      { tipo: "papelera", ruta: `.papelera/${id}/papelera.json` },
      { tipo: "papelera", ruta: "studio.json" },
      { tipo: "papelera", ruta: ".galeria/servidor.json" },
      { tipo: "papelera", ruta: "actores" },
      { tipo: "papelera", ruta: "clientes" },
      { tipo: "papelera", ruta: "clientes/acme" },
      { tipo: "papelera", ruta: "clientes/acme/MLA1/creativos" },
      { tipo: "papelera", ruta: `${C1}/creativo.json` },
    ]);
    assert.ok(res.every((x) => x.ok === false), JSON.stringify(res));
    for (const p of [".galeria", ".papelera", "studio.json", "actores", "clientes/acme", `.papelera/${id}/papelera.json`, `${C1}/creativo.json`]) {
      assert.ok(fs.existsSync(path.join(s, p)), p);
    }
  });
});

// ---------- actions ----------

describe("actions", () => {
  test("estado writes status atomically and keeps the other fields; invalid values change nothing", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const file = path.join(s, `${C1}/creativo.json`);
    const before = leer(s, `${C1}/creativo.json`);
    const inode = fs.statSync(file).ino;
    const files = todos(s).sort();
    const [r] = await accion(srv, [{ tipo: "estado", ruta: C1, valor: "approved" }]);
    assert.deepEqual(r, { ruta: C1, ok: true });
    const after = leer(s, `${C1}/creativo.json`);
    assert.equal(after.status, "approved");
    assert.match(after.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.ok(Date.now() - Date.parse(after.updatedAt) < 60_000, "updatedAt set to now");
    assert.notEqual(after.updatedAt, before.updatedAt);
    const { updatedAt: _a, ...restAfter } = after;
    const { updatedAt: _b, ...restBefore } = before;
    assert.deepEqual({ ...restAfter, status: "draft" }, restBefore);
    assert.deepEqual(Object.keys(after).filter((k) => k !== "updatedAt"), Object.keys(before).filter((k) => k !== "updatedAt"));
    const text = fs.readFileSync(file, "utf8");
    assert.equal(text, JSON.stringify(after, null, 2) + "\n");
    assert.notEqual(fs.statSync(file).ino, inode, "written to a temp file and renamed");
    assert.deepEqual(todos(s).sort(), files, "no temp file left behind");
    assert.equal((await getJson(srv, "/api/elementos?tipo=creative&estado=approved&cliente=acme")).total, 2);

    const keep = fs.readFileSync(file, "utf8");
    const bad = await accion(srv, [
      { tipo: "estado", ruta: C1, valor: "final" },
      { tipo: "estado", ruta: C1, valor: "" },
      { tipo: "estado", ruta: C1 },
      { tipo: "estado", ruta: C1, valor: 7 },
      { tipo: "estado", ruta: "actores/ana-v1", valor: "draft" },
      { tipo: "estado", ruta: "clientes/acme/MLA1", valor: "draft" },
    ]);
    assert.ok(bad.every((x) => x.ok === false && x.error), JSON.stringify(bad));
    assert.equal(fs.readFileSync(file, "utf8"), keep);
    assert.deepEqual(leer(s, "actores/ana-v1/actor.json"), { id: "ana-v1", name: "Ana María", createdAt: "2026-01-01T10:00:00Z" });

    const vids = await accion(srv, [
      { tipo: "estado", ruta: V1, valor: "storyboard" },
      { tipo: "estado", ruta: V1, valor: "final" },
      { tipo: "estado", ruta: V1, valor: "discarded" },
      { tipo: "estado", ruta: V1, valor: "approved" },
    ]);
    assert.deepEqual(vids.map((x) => x.ok), [true, true, true, false]);
    assert.equal(leer(s, `${V1}/video.json`).status, "discarded");
    assert.equal(leer(s, `${V1}/video.json`).hook, "¿Ustedes también tienen la cama pegada?");
  });

  test("archivar / desarchivar write and remove archived + archivedAt", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const before = leer(s, `${C1}/creativo.json`);
    assert.equal((await getJson(srv, "/api/elementos?tipo=creative&archivados=0")).total, 2);
    const [a] = await accion(srv, [{ tipo: "archivar", ruta: C1 }]);
    assert.equal(a.ok, true);
    const j = leer(s, `${C1}/creativo.json`);
    assert.equal(j.archived, true);
    assert.match(j.archivedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.deepEqual({ ...j, archived: undefined, archivedAt: undefined }, { ...before, archived: undefined, archivedAt: undefined });
    assert.equal((await getJson(srv, "/api/elementos?tipo=creative")).total, 1);
    const [u] = await accion(srv, [{ tipo: "desarchivar", ruta: C1 }]);
    assert.equal(u.ok, true);
    assert.deepEqual(leer(s, `${C1}/creativo.json`), before);
    assert.equal((await getJson(srv, "/api/elementos?tipo=creative")).total, 2);
    // Every kind with a JSON can be archived.
    const all = await accion(srv, ["actores/ana-v1", "clientes/acme/marca", "clientes/acme/MLA1", V1].map((ruta) => ({ tipo: "archivar", ruta })));
    assert.ok(all.every((x) => x.ok), JSON.stringify(all));
  });

  test("papelera moves a folder to .papelera/<id>/<path> with papelera.json; restaurar puts it back", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const antes = fs.readdirSync(path.join(s, C1)).sort();
    const json = fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8");
    const [r] = await accion(srv, [{ tipo: "papelera", ruta: C1 }]);
    assert.equal(r.ok, true);
    assert.ok(!fs.existsSync(path.join(s, C1)));
    const entries = fs.readdirSync(path.join(s, ".papelera"));
    assert.equal(entries.length, 1);
    const id = entries[0];
    assert.match(id, /^\d{4}-\d\d-\d\dT\d{6}Z-[0-9a-z]+$/);
    assert.deepEqual(fs.readdirSync(path.join(s, ".papelera", id, C1)).sort(), antes);
    const meta = leer(s, `.papelera/${id}/papelera.json`);
    assert.equal(meta.originalPath, C1);
    assert.match(meta.trashedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.equal((await getJson(srv, "/api/elementos?tipo=creative&archivados=1")).total, 2);
    const list = await getJson(srv, "/api/papelera");
    assert.equal(list.entries.length, 1);
    assert.equal(list.entries[0].id, id);
    assert.equal(list.entries[0].originalPath, C1);
    assert.equal((await req(srv, { path: `/${C1}/creativo.json` })).status, 404);

    const [back] = await accion(srv, [{ tipo: "restaurar", ruta: id }]);
    assert.deepEqual(back, { ruta: id, ok: true });
    assert.deepEqual(fs.readdirSync(path.join(s, C1)).sort(), antes);
    assert.equal(fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8"), json);
    assert.ok(!fs.existsSync(path.join(s, ".papelera", id)));
    assert.equal((await getJson(srv, "/api/papelera")).entries.length, 0);
    assert.equal((await getJson(srv, "/api/elementos?tipo=creative&archivados=1")).total, 3);
  });

  test("papelera of one file keeps its folder structure; restaurar fails if the original exists", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const rel = `${C1}/4x5-v2.png`;
    const [r] = await accion(srv, [{ tipo: "papelera", ruta: rel }]);
    assert.equal(r.ok, true);
    assert.ok(!fs.existsSync(path.join(s, rel)));
    assert.ok(fs.existsSync(path.join(s, C1, "4x5-v1.png")));
    const id = fs.readdirSync(path.join(s, ".papelera"))[0];
    assert.ok(fs.existsSync(path.join(s, ".papelera", id, rel)));
    // Conflict: the same name exists again.
    write(s, rel, "nuevo");
    const [c] = await accion(srv, [{ tipo: "restaurar", ruta: id }]);
    assert.equal(c.ok, false);
    assert.match(c.error, /exist/i);
    assert.equal(fs.readFileSync(path.join(s, rel), "utf8"), "nuevo");
    assert.ok(fs.existsSync(path.join(s, ".papelera", id, rel)), "still in the trash");
    assert.equal((await getJson(srv, "/api/papelera")).entries.length, 1);
    // Unknown entry.
    const [n] = await accion(srv, [{ tipo: "restaurar", ruta: "2020-01-01T000000Z-abcdef" }]);
    assert.equal(n.ok, false);
  });

  test("a batch goes item by item: one failure does not stop the others", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const res = await accion(srv, [
      { tipo: "estado", ruta: C1, valor: "approved" },
      { tipo: "estado", ruta: "clientes/nada/x", valor: "approved" },
      { tipo: "tipo-raro", ruta: C1 },
      { tipo: "archivar", ruta: C2 },
    ]);
    assert.deepEqual(res.map((x) => x.ok), [true, false, false, true]);
    assert.deepEqual(res.map((x) => x.ruta), [C1, "clientes/nada/x", C1, C2]);
    assert.ok(res[1].error && res[2].error);
    assert.equal(leer(s, `${C1}/creativo.json`).status, "approved");
    assert.equal(leer(s, `${C2}/creativo.json`).archived, true);
    assert.equal((await req(srv, { method: "POST", path: "/api/acciones", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acciones: "no" }) })).status, 400);
  });

  test("papelera/vaciar deletes entries (all, or only those before antesDe)", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    await accion(srv, [{ tipo: "papelera", ruta: C1 }, { tipo: "papelera", ruta: C2 }]);
    assert.equal((await getJson(srv, "/api/papelera")).entries.length, 2);
    const post = (b) => req(srv, { method: "POST", path: "/api/papelera/vaciar", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    const none = await post({ antesDe: "2020-01-01T00:00:00Z" });
    assert.equal(none.status, 200);
    assert.equal(none.json().eliminados, 0);
    assert.equal(fs.readdirSync(path.join(s, ".papelera")).length, 2);
    assert.equal((await post({ antesDe: "no es una fecha" })).status, 400);
    assert.equal(fs.readdirSync(path.join(s, ".papelera")).length, 2);
    const all = await post({});
    assert.equal(all.json().eliminados, 2);
    assert.equal(fs.readdirSync(path.join(s, ".papelera")).length, 0);
    assert.equal((await getJson(srv, "/api/papelera")).entries.length, 0);
    assert.ok(fs.existsSync(path.join(s, "studio.json")));
    assert.ok(fs.existsSync(path.join(s, C3)), "items outside the trash are untouched");
  });
});

// ---------- API: studio, items ----------

describe("API", () => {
  test("/api/estudio: studio.json, counts and clients", async () => {
    const srv = await iniciar(estudioRico());
    const e = await getJson(srv, "/api/estudio");
    assert.equal(e.studio.credits.available, 50);
    assert.equal(e.counts.byKind.creative, 2);
    assert.equal(e.counts.byKind.video, 1);
    assert.equal(e.counts.byKind.actor, 1);
    assert.equal(e.counts.byKind.product, 2);
    assert.equal(e.counts.status.creative.draft, 1);
    assert.equal(e.counts.status.creative.approved, 1);
    assert.equal(e.counts.archived, 1);
    assert.deepEqual(e.clients, [
      { profileId: "acme", name: "Acme SRL", products: 1, creatives: 2, videos: 1 },
      { profileId: "beta", name: "Beta Hogar", products: 1, creatives: 0, videos: 0 },
    ]);
  });

  test("/api/elementos item shape and /api/elemento resolves versions and slots", async () => {
    const srv = await iniciar(estudioRico());
    const l = await getJson(srv, "/api/elementos?tipo=creative&estado=draft");
    assert.deepEqual(Object.keys(l), ["total", "pagina", "porPagina", "items"]);
    assert.deepEqual(l.items[0], {
      kind: "creative", path: C1, title: "Agacharse ya no duele", status: "draft", archived: false, broken: false,
      profileId: "acme", productId: "MLA1", batch: "lote-1", actorId: "ana-v1", updatedAt: "2026-01-02T12:00:00Z",
      cover: `${C1}/4x5-v2.png`, coverThumb: `/miniatura/${C1}/4x5-v2.png?w=480`,
    });
    const v = (await getJson(srv, "/api/elementos?tipo=video")).items[0];
    assert.equal(v.cover, `${V1}/thumb-v1.jpg`);
    const p = (await getJson(srv, "/api/elementos?tipo=product&cliente=acme")).items[0];
    assert.equal(p.cover, "clientes/acme/MLA1/fotos/f1.png");
    const el = await getJson(srv, "/api/elemento?ruta=" + encodeURIComponent(C1));
    assert.equal(el.kind, "creative");
    assert.equal(el.json.title, "Agacharse ya no duele");
    assert.deepEqual(el.files, ["4x5-v1.png", "4x5-v2.png", "creativo.json"]);
    assert.equal(el.pieces[0].slot, "4x5");
    assert.deepEqual(el.pieces[0].current, { n: 2, src: `${C1}/4x5-v2.png` });
    assert.deepEqual(el.pieces[0].older, [{ n: 1, src: `${C1}/4x5-v1.png` }]);
    const ev = await getJson(srv, "/api/elemento?ruta=" + encodeURIComponent(V1));
    assert.equal(ev.versions[0].video, `${V1}/borrador-v1.mp4`);
    assert.equal(ev.versions[0].thumb, `${V1}/thumb-v1.jpg`);
    assert.equal((await req(srv, { path: "/api/elemento?ruta=" + encodeURIComponent("clientes/acme/nada") })).status, 404);
  });

  test("q matches case- and accent-insensitively across title, product, client, angle, hook, adName, actor", async () => {
    const srv = await iniciar(estudioRico());
    const q = async (text, extra = "") => {
      const r = await getJson(srv, `/api/elementos?archivados=1&${extra}q=${encodeURIComponent(text)}`);
      return r.items.map((i) => i.path.split("/").pop()).sort();
    };
    const creativos = ["2026-01-02-x-dolor", "2026-01-03-x-precio", "2026-01-04-x-viejo"];
    assert.deepEqual(await q("AGACHARSE", "tipo=creative&"), ["2026-01-02-x-dolor"]);
    assert.deepEqual(await q("agáchárse", "tipo=creative&"), ["2026-01-02-x-dolor"]);
    assert.deepEqual(await q("nandu", "tipo=creative&"), creativos, "product title");
    assert.deepEqual(await q("ÑANDÚ", "tipo=creative&"), creativos);
    assert.deepEqual(await q("acme srl", "tipo=creative&"), creativos, "client name");
    assert.deepEqual(await q("espalda", "tipo=creative&"), ["2026-01-02-x-dolor"], "angle");
    assert.deepEqual(await q("humor", "tipo=creative&"), ["2026-01-04-x-viejo"]);
    assert.deepEqual(await q("mla1_precio", "tipo=creative&"), ["2026-01-03-x-precio"], "adName");
    assert.deepEqual(await q("ana maria", "tipo=creative&"), ["2026-01-02-x-dolor"], "actor name");
    assert.deepEqual(await q("ana-v1", "tipo=creative&"), ["2026-01-02-x-dolor"], "actor id");
    assert.deepEqual(await q("cama pegada", "tipo=video&"), ["2026-01-01-cama-problema"], "hook (all words)");
    assert.deepEqual(await q("solucion problema", "tipo=video&"), ["2026-01-01-cama-problema"], "every word, in any order");
    assert.deepEqual(await q("problema", "tipo=video&"), ["2026-01-01-cama-problema"]);
    assert.deepEqual(await q("lampara", ""), ["MLB2"], "product of the other client");
    assert.deepEqual(await q("beta hogar", ""), ["MLB2"]);
    assert.deepEqual(await q("zzzz", ""), []);
  });

  test("filters: tipo, cliente, producto, estado, actor, dates and order", async () => {
    const srv = await iniciar(estudioRico());
    const paths = async (qs) => (await getJson(srv, "/api/elementos?" + qs)).items.map((i) => i.path.split("/").pop());
    assert.deepEqual((await paths("tipo=actor")), ["ana-v1"]);
    assert.deepEqual((await paths("tipo=brand")), ["marca"]);
    assert.equal((await getJson(srv, "/api/elementos")).total, 8 - 1, "archived hidden");
    assert.deepEqual(await paths("cliente=beta"), ["MLB2"]);
    assert.deepEqual(await paths("cliente=beta&tipo=creative"), []);
    assert.deepEqual(await paths("tipo=creative&producto=MLA1"), ["2026-01-03-x-precio", "2026-01-02-x-dolor"]);
    assert.deepEqual(await paths("tipo=creative&producto=MLB2"), []);
    assert.deepEqual(await paths("tipo=creative&estado=approved"), ["2026-01-03-x-precio"]);
    assert.deepEqual((await paths("estado=draft")).sort(), ["2026-01-01-cama-problema", "2026-01-02-x-dolor"]);
    assert.deepEqual((await paths("tipo=creative&actor=ana-v1")), ["2026-01-02-x-dolor"]);
    assert.deepEqual((await paths("tipo=video&actor=ana-v1")), ["2026-01-01-cama-problema"]);
    assert.deepEqual(await paths("tipo=creative&desde=2026-01-03"), ["2026-01-03-x-precio"]);
    assert.deepEqual(await paths("tipo=creative&hasta=2026-01-02"), ["2026-01-02-x-dolor"]);
    assert.deepEqual(await paths("tipo=creative&desde=2026-01-02&hasta=2026-01-03"), ["2026-01-03-x-precio", "2026-01-02-x-dolor"]);
    assert.deepEqual(await paths("tipo=creative&orden=antiguo"), ["2026-01-02-x-dolor", "2026-01-03-x-precio"]);
    assert.deepEqual(await paths("tipo=creative&orden=reciente"), ["2026-01-03-x-precio", "2026-01-02-x-dolor"]);
    assert.deepEqual(await paths("tipo=creative&orden=titulo"), ["2026-01-02-x-dolor", "2026-01-03-x-precio"]);
    assert.deepEqual(await paths("tipo=creative&cliente=acme&producto=MLA1&estado=draft&q=agacharse"), ["2026-01-02-x-dolor"]);
  });

  test("archivados: default hides archived, 1 shows both, solo shows only archived", async () => {
    const srv = await iniciar(estudioRico());
    const n = async (v) => (await getJson(srv, "/api/elementos?tipo=creative" + (v === undefined ? "" : "&archivados=" + v)));
    assert.equal((await n()).total, 2);
    assert.equal((await n(0)).total, 2);
    assert.equal((await n(1)).total, 3);
    const solo = await n("solo");
    assert.equal(solo.total, 1);
    assert.equal(solo.items[0].archived, true);
    assert.equal(solo.items[0].path, C3);
  });

  test("pagination: totals, pages, and out-of-range pages", async () => {
    const s = estudioRico();
    for (let i = 0; i < 9; i++) {
      const id = `2026-02-${String(10 + i)}-x-n${i}`;
      write(s, `clientes/acme/MLA1/creativos/${id}/creativo.json`,
        { id, title: `Pieza ${i}`, status: "draft", updatedAt: `2026-02-${String(10 + i)}T00:00:00Z` });
    }
    const srv = await iniciar(s);
    const p1 = await getJson(srv, "/api/elementos?tipo=creative&porPagina=4&pagina=1&orden=antiguo");
    assert.equal(p1.total, 11);
    assert.equal(p1.pagina, 1);
    assert.equal(p1.porPagina, 4);
    assert.equal(p1.items.length, 4);
    const p3 = await getJson(srv, "/api/elementos?tipo=creative&porPagina=4&pagina=3&orden=antiguo");
    assert.equal(p3.items.length, 3);
    assert.equal(p3.total, 11);
    const p4 = await getJson(srv, "/api/elementos?tipo=creative&porPagina=4&pagina=4&orden=antiguo");
    assert.equal(p4.items.length, 0);
    assert.equal(p4.total, 11);
    const seen = new Set();
    for (let pg = 1; pg <= 3; pg++) {
      for (const i of (await getJson(srv, `/api/elementos?tipo=creative&porPagina=4&pagina=${pg}&orden=antiguo`)).items) seen.add(i.path);
    }
    assert.equal(seen.size, 11, "pages do not overlap");
    const d = await getJson(srv, "/api/elementos?tipo=creative");
    assert.equal(d.porPagina, 48);
    assert.equal(d.pagina, 1);
    assert.equal((await getJson(srv, "/api/elementos?pagina=0&porPagina=-3")).pagina, 1);
    assert.ok((await getJson(srv, "/api/elementos?porPagina=100000")).porPagina <= 200);
  });
});

// ---------- freshness ----------

describe("index freshness", () => {
  for (const modo of ["watch", "fallback"]) {
    test(`a file change is reflected after the debounce (${modo})`, async () => {
      const s = estudioRico();
      const srv = await iniciar(s, modo === "watch" ? {} : { watch: false, checkMs: 150 });
      const total = async () => (await getJson(srv, "/api/elementos?tipo=creative&archivados=1")).total;
      assert.equal(await total(), 3);
      const build0 = (await getJson(srv, "/api/salud")).entities;
      const nuevo = "clientes/acme/MLA1/creativos/2026-03-01-x-nuevo";
      write(s, `${nuevo}/creativo.json`, { id: "2026-03-01-x-nuevo", title: "Nuevo concepto", status: "draft", slots: ["4x5"] });
      await esperar(async () => (await total()) === 4);
      assert.equal((await getJson(srv, "/api/salud")).entities, build0 + 1);
      assert.equal((await getJson(srv, "/api/elementos?q=nuevo+concepto")).total, 1);
      // A new image in an existing entity shows up as its cover.
      write(s, `${nuevo}/4x5-v1.png`, PNG);
      await esperar(async () => (await getJson(srv, "/api/elementos?q=nuevo+concepto")).items[0].cover === `${nuevo}/4x5-v1.png`);
      // In-place edit of a JSON (no rename).
      const f = path.join(s, `${nuevo}/creativo.json`);
      const j = JSON.parse(fs.readFileSync(f, "utf8"));
      j.title = "Titulo reescrito";
      fs.writeFileSync(f, JSON.stringify(j));
      await esperar(async () => (await getJson(srv, "/api/elementos?q=reescrito")).total === 1);
      // Broken JSON is kept, marked broken; fixing it clears the mark.
      fs.writeFileSync(f, "{rota");
      await esperar(async () => (await getJson(srv, `/api/elementos?tipo=creative&q=nuevo`)).items.some((i) => i.broken));
      fs.writeFileSync(f, JSON.stringify(j));
      await esperar(async () => (await getJson(srv, "/api/elementos?q=reescrito")).items.every((i) => !i.broken));
      // Removal.
      fs.rmSync(path.join(s, nuevo), { recursive: true });
      await esperar(async () => (await total()) === 3);
      // A whole product folder dropped in (as importar.sh does) with its creatives inside.
      write(s, "clientes/gamma/P9/producto.json", { title: "Producto gamma", clientName: "Gamma" });
      write(s, "clientes/gamma/P9/creativos/2026-03-02-x-g/creativo.json", { id: "2026-03-02-x-g", title: "Gamma creativo", status: "draft" });
      await esperar(async () => (await getJson(srv, "/api/elementos?q=gamma")).total === 2);
      const clients = (await getJson(srv, "/api/estudio")).clients.map((c) => c.profileId);
      assert.deepEqual(clients, ["acme", "beta", "gamma"]);
      // studio.json
      write(s, "studio.json", { credits: { available: 7 } });
      await esperar(async () => (await getJson(srv, "/api/estudio")).studio.credits.available === 7);
    });
  }

  test("the mtime fallback also sees product photos (watch off)", async () => {
    const s = estudioRico();
    const srv = await iniciar(s, { watch: false, checkMs: 150 });
    const P = "clientes/acme/MLA1";
    const fotos = async () => (await getJson(srv, `/api/elemento?ruta=${encodeURIComponent(P)}`)).photos;
    assert.deepEqual(await fotos(), [`${P}/fotos/f1.png`, `${P}/fotos/f2.png`]);
    write(s, `${P}/fotos/f3.png`, PNG);
    await esperar(async () => (await fotos()).length === 3);
    assert.ok((await fotos()).includes(`${P}/fotos/f3.png`));
    fs.rmSync(path.join(s, `${P}/fotos/f1.png`));
    await esperar(async () => (await fotos()).length === 2);
    assert.ok(!(await fotos()).includes(`${P}/fotos/f1.png`));
    // The new photo can become the cover when the product has none named.
    assert.ok((await getJson(srv, `/api/elementos?tipo=product&q=nandu`)).items[0].cover);
    // Photos of a product that had no fotos/ folder yet.
    const Q = "clientes/beta/MLB2";
    fs.rmSync(path.join(s, Q, "fotos"), { recursive: true });
    await esperar(async () => (await getJson(srv, `/api/elemento?ruta=${encodeURIComponent(Q)}`)).photos.length === 0);
    write(s, `${Q}/fotos/nueva.png`, PNG);
    await esperar(async () => (await getJson(srv, `/api/elemento?ruta=${encodeURIComponent(Q)}`)).photos.length === 1);
  });

  test("/datos.js changes its build id when the index changes", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const build = async () => {
      const ctx = { window: {} };
      vm.runInNewContext((await req(srv, { path: "/datos.js" })).text, ctx);
      return ctx.window.ESTUDIO.build;
    };
    const b1 = await build();
    assert.equal(await build(), b1, "stable while nothing changes");
    await accion(srv, [{ tipo: "estado", ruta: C1, valor: "approved" }]);
    assert.notEqual(await build(), b1);
  });
});

// ---------- thumbnails ----------

describe("thumbnails", () => {
  test("without sips or ffmpeg the original file is served", async () => {
    const srv = await iniciar(estudioRico(), { herramientas: [] });
    const r = await req(srv, { path: `/miniatura/${C1}/4x5-v1.png?w=480` });
    assert.equal(r.status, 200);
    assert.equal(r.headers["content-type"], "image/png");
    assert.deepEqual(r.buf, PNG);
    const v = await req(srv, { path: `/miniatura/${V1}/borrador-v1.mp4?w=240` });
    assert.equal(v.status, 200);
    assert.equal(v.headers["content-type"], "video/mp4");
    assert.equal(v.text, "0123456789abcdefghij");
    assert.equal((await req(srv, { path: `/miniatura/${C1}/nada.png?w=480` })).status, 404);
    assert.equal((await req(srv, { path: `/miniatura/${C1}/4x5-v1.png?w=500` })).status, 400);
    assert.equal((await req(srv, { path: `/miniatura/${C1}/4x5-v1.png`, auth: false })).status, 401);
    assert.equal(fs.existsSync(path.join(srv.studio, ".galeria", "miniaturas")) && fs.readdirSync(path.join(srv.studio, ".galeria", "miniaturas")).length, false);
  });

  test("with sips or ffmpeg a JPEG is made once and cached in .galeria/miniaturas", async (t) => {
    if (!hasTool("ffmpeg") && !hasTool("sips")) return t.skip("no ffmpeg or sips on this machine");
    const s = estudioRico();
    const srv = await iniciar(s);
    const p = `/miniatura/${C1}/4x5-v1.png?w=240`;
    const r = await req(srv, { path: p });
    assert.equal(r.status, 200);
    assert.equal(r.headers["content-type"], "image/jpeg");
    assert.deepEqual([...r.buf.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    const dir = path.join(s, ".galeria", "miniaturas");
    const files = fs.readdirSync(dir);
    assert.equal(files.length, 1);
    assert.match(files[0], /^[0-9a-f]{40}\.jpg$/);
    const mtime = fs.statSync(path.join(dir, files[0])).mtimeMs;
    const again = await req(srv, { path: p });
    assert.deepEqual(again.buf, r.buf);
    assert.equal(fs.statSync(path.join(dir, files[0])).mtimeMs, mtime);
    const etag = r.headers.etag;
    assert.ok(etag);
    assert.equal((await req(srv, { path: p, headers: { "If-None-Match": etag } })).status, 304);
    assert.equal(fs.readdirSync(dir).length, 1);
  });
});

// ---------- process: servidor.json, port, idle ----------

function lanzar(studio, env = {}) {
  const child = spawn(process.execPath, [SERVIDOR, "--studio", studio], {
    env: { ...process.env, UGC_GALERIA_PORT: "0", ...env }, stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const exited = new Promise((resolve) => child.on("exit", (code, sig) => resolve({ code, sig })));
  after(() => child.kill("SIGKILL"));
  return { child, exited, log: () => log };
}

describe("health and slow start", () => {
  test("GET /api/salud answers without a token, with only {ok, version, pid, listo}", async () => {
    const srv = await iniciar(estudioRico());
    const r = await req(srv, { path: "/api/salud", auth: false });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json()).sort(), ["listo", "ok", "pid", "version"]);
    assert.deepEqual({ ...r.json(), version: "x" }, { ok: true, version: "x", pid: process.pid, listo: true });
    assert.equal(r.json().version, JSON.parse(fs.readFileSync(path.join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).version);
    assert.ok(!r.text.includes(srv.studio), "no studio path");
    // The Host check still applies; every other API path still needs the token.
    assert.equal((await req(srv, { path: "/api/salud", auth: false, headers: { Host: "evil.example" } })).status, 403);
    assert.equal((await req(srv, { path: "/api/estudio", auth: false })).status, 401);
    assert.equal((await req(srv, { path: "/api/salud?x=1", auth: false })).status, 200);
    // With the token it keeps the details the tools use.
    const con = await getJson(srv, "/api/salud");
    assert.equal(con.ok, true);
    assert.equal(con.listo, true);
    assert.equal(con.entities, 8);
    assert.equal(con.studio, srv.studio);
  });

  test("servidor.json records the plugin root the server runs from", async () => {
    const s = estudioBasico();
    const srv = await iniciar(s);
    const j = leer(s, ".galeria/servidor.json");
    assert.equal(j.plugin, fs.realpathSync(PLUGIN));
    assert.equal(j.version, JSON.parse(fs.readFileSync(path.join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).version);
    assert.equal(srv.studio, fs.realpathSync(s));
  });

  test("it listens and writes servidor.json before the scan; until listo, data endpoints answer 503 + Retry-After and change nothing", async () => {
    const s = estudioRico();
    const srv = await iniciar(s, { scanDelayMs: 700, sinEsperar: true });
    assert.ok(fs.existsSync(path.join(s, ".galeria", "servidor.json")), "servidor.json written before the scan");
    const salud = await req(srv, { path: "/api/salud", auth: false });
    assert.equal(salud.json().listo, false);
    assert.equal(salud.json().ok, true);
    for (const p of ["/api/elementos", "/api/estudio", "/api/papelera", `/api/elemento?ruta=${encodeURIComponent(C1)}`, "/datos.js"]) {
      const r = await req(srv, { path: p });
      assert.equal(r.status, 503, p);
      assert.equal(r.headers["retry-after"], "1", p);
      assert.match(r.json().error, /indexing|retry/i, p);
    }
    const before = fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8");
    const post = await req(srv, {
      method: "POST", path: "/api/acciones", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acciones: [{ tipo: "estado", ruta: C1, valor: "approved" }] }),
    });
    assert.equal(post.status, 503);
    assert.equal(fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8"), before);
    // Not data: the page and the token rules keep working.
    assert.equal((await req(srv, { path: "/" })).status, 200);
    assert.equal((await req(srv, { path: "/api/elementos", auth: false })).status, 401);
    await srv.listo;
    assert.equal((await req(srv, { path: "/api/salud", auth: false })).json().listo, true);
    assert.equal((await getJson(srv, "/api/elementos?archivados=1")).total, 8);
    assert.equal((await req(srv, { path: "/datos.js" })).status, 200);
  });

  test("a change made while the index is not ready is picked up once it is", async () => {
    const s = estudioRico();
    const srv = await iniciar(s, { scanDelayMs: 500, sinEsperar: true, watch: false, checkMs: 100 });
    await srv.listo;
    write(s, "clientes/acme/MLA1/creativos/2026-03-09-x-tarde/creativo.json", { id: "2026-03-09-x-tarde", title: "Tarde", status: "draft" });
    await esperar(async () => (await getJson(srv, "/api/elementos?q=tarde")).total === 1);
  });

  test("the UGC_GALERIA_TEST_SCAN_DELAY_MS hook slows the scan of a real process; servidor.json is there first", async () => {
    const s = estudioBasico();
    const p = lanzar(s, { UGC_GALERIA_TEST_SCAN_DELAY_MS: "800" });
    const state = path.join(s, ".galeria", "servidor.json");
    await esperar(() => fs.existsSync(state), 8000);
    const j = JSON.parse(fs.readFileSync(state, "utf8"));
    const salud = () => req({ token: j.token, port: j.port }, { path: "/api/salud", auth: false });
    assert.equal((await salud()).json().listo, false);
    await esperar(async () => (await salud()).json().listo === true, 5000);
    assert.equal((await req({ token: j.token, port: j.port }, { path: "/api/elementos" })).status, 200);
    p.child.kill("SIGTERM");
    assert.equal((await p.exited).code, 0);
  });

  test("closing during the scan stops it cleanly and removes servidor.json", async () => {
    const s = estudioBasico();
    const srv = await iniciar(s, { scanDelayMs: 2000, sinEsperar: true });
    await srv.close();
    await srv.listo;
    assert.ok(!fs.existsSync(path.join(s, ".galeria", "servidor.json")));
  });
});

describe("process", () => {
  test("writes .galeria/servidor.json (mode 600) and removes it on idle shutdown", async () => {
    const s = estudioBasico();
    const p = lanzar(s, { UGC_GALERIA_IDLE_MIN: "0.03" });
    const state = path.join(s, ".galeria", "servidor.json");
    await esperar(() => fs.existsSync(state), 8000);
    const j = JSON.parse(fs.readFileSync(state, "utf8"));
    assert.deepEqual(Object.keys(j).sort(), ["pid", "plugin", "port", "startedAt", "token", "version"]);
    assert.equal(j.pid, p.child.pid);
    assert.ok(j.port > 0);
    assert.match(j.token, /^[0-9a-f]{64}$/);
    assert.match(j.startedAt, /^\d{4}-\d\d-\d\dT/);
    assert.equal(fs.statSync(state).mode & 0o777, 0o600);
    const salud = await req({ token: j.token, port: j.port }, { path: "/api/salud" });
    assert.equal(salud.status, 200);
    const t0 = Date.now();
    const r = await p.exited;
    assert.equal(r.code, 0, p.log());
    assert.ok(Date.now() - t0 < 6000, "stopped soon after the idle time");
    assert.ok(!fs.existsSync(state), "servidor.json removed");
  });

  test("a request restarts the idle countdown", async () => {
    const s = estudioBasico();
    const p = lanzar(s, { UGC_GALERIA_IDLE_MIN: "0.05" }); // 3 s
    const state = path.join(s, ".galeria", "servidor.json");
    await esperar(() => fs.existsSync(state), 8000);
    const j = JSON.parse(fs.readFileSync(state, "utf8"));
    const t0 = Date.now();
    while (Date.now() - t0 < 4500) {
      assert.equal((await req({ token: j.token, port: j.port }, { path: "/api/salud" })).status, 200);
      await sleep(500);
    }
    assert.ok(fs.existsSync(state), "still up after longer than the idle time, thanks to the requests");
    assert.equal((await p.exited).code, 0);
  });

  test("SIGTERM stops it gracefully and removes servidor.json", async () => {
    const s = estudioBasico();
    const p = lanzar(s);
    const state = path.join(s, ".galeria", "servidor.json");
    await esperar(() => fs.existsSync(state), 8000);
    p.child.kill("SIGTERM");
    assert.equal((await p.exited).code, 0);
    assert.ok(!fs.existsSync(state));
  });

  test("the port is the first free one from the base", async () => {
    const blocker = net.createServer();
    await new Promise((r) => blocker.listen(0, "127.0.0.1", r));
    const base = blocker.address().port;
    try {
      const srv = await crearServidor({ studio: estudioBasico(), port: base, idleMin: 0 });
      servers.push(srv);
      assert.ok(srv.port > base && srv.port <= base + 20, `port ${srv.port}`);
      assert.equal((await req(srv, { path: "/api/salud" })).status, 200);
    } finally {
      blocker.close();
    }
  });

  test("refuses a folder that is not a studio", async () => {
    const d = tmp("ugc-vacio-");
    const r = spawnSync(process.execPath, [SERVIDOR, "--studio", d], { env: { ...process.env, UGC_GALERIA_PORT: "0" }, encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /studio\.json/);
    assert.ok(!fs.existsSync(path.join(d, ".galeria", "servidor.json")));
  });
});
