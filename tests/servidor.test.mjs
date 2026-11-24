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
function req(srv, { method = "GET", path: p = "/", headers = {}, body, port } = {}) {
  return new Promise((resolve, reject) => {
    const h = { ...headers };
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

// ---------- the gallery page and the studio files ----------

describe("gallery page and studio files", () => {
  test("a broken JSON keeps its entity and is marked broken in the API", async () => {
    const s = estudioBasico();
    write(s, "actores/ana-v1/actor.json", '{"name": "Ana",}');
    const srv = await iniciar(s);
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

describe("no token: Host, Origin, Sec-Fetch-Site and JSON-only mutations", () => {
  const SF = (site, extra = {}) => ({ "Sec-Fetch-Site": site, ...extra });
  const NAV = { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document" };
  const FILE = "/clientes/acme/MLA1/fotos/f1.png";
  const THUMB = `/miniatura/${C1}/4x5-v1.png?w=480`;

  test("plain requests, with no token, are served", async () => {
    const srv = await iniciar(estudioRico());
    const home = await req(srv, { path: "/" });
    assert.equal(home.status, 200);
    assert.match(home.headers["content-type"], /text\/html/);
    assert.equal(home.headers["set-cookie"], undefined);
    for (const p of ["/api/estudio", "/api/elementos", "/api/papelera", FILE, THUMB]) {
      assert.equal((await req(srv, { path: p })).status, 200, p);
    }
    assert.equal(srv.token, undefined);
    assert.equal(srv.url, `http://127.0.0.1:${srv.port}/`);
  });

  test("/?t=<anything> redirects to / and sets no cookie; /datos.js is gone", async () => {
    const srv = await iniciar(estudioBasico());
    for (const t of ["x", "0".repeat(64), ""]) {
      const r = await req(srv, { path: "/?t=" + t });
      assert.equal(r.status, 302, t);
      assert.equal(r.headers.location, "/");
      assert.equal(r.headers["set-cookie"], undefined);
    }
    assert.equal((await req(srv, { path: "/datos.js" })).status, 404);
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
      const sock = net.connect(p, "127.0.0.1", () => sock.write("GET /api/salud HTTP/1.0\r\n\r\n"));
      let out = "";
      sock.on("data", (d) => (out += d));
      sock.on("close", () => resolve(out));
      sock.on("error", reject);
    });
    assert.match(sinHost, /^HTTP\/1\.[01] 403/);
    // The redirect of an old bookmark refuses a foreign Host too.
    assert.equal((await req(srv, { path: "/?t=x", headers: { Host: "evil.example" } })).status, 403);
    assert.equal((await req(srv, { path: "/api/salud", headers: { Host: `localhost:${p}` } })).status, 200);
    assert.equal((await req(srv, { path: "/api/salud", headers: { Host: `127.0.0.1:${p}` } })).status, 200);
  });

  test("binds 127.0.0.1 only", async () => {
    const srv = await iniciar(estudioBasico());
    assert.equal(srv.server.address().address, "127.0.0.1");
  });

  test("Sec-Fetch-Site cross-site and same-site are rejected on every kind of request", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const before = fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8");
    for (const site of ["cross-site", "same-site"]) {
      for (const p of ["/api/estudio", "/api/salud", "/api/elementos", FILE, THUMB]) {
        const r = await req(srv, { path: p, headers: SF(site) });
        assert.equal(r.status, 403, `${site} ${p}`);
        assert.deepEqual(r.json(), { error: "cross-site request not allowed" }, `${site} ${p}`);
      }
      const post = await req(srv, {
        method: "POST", path: "/api/acciones", headers: SF(site, { "Content-Type": "application/json" }),
        body: JSON.stringify({ acciones: [{ tipo: "estado", ruta: C1, valor: "approved" }] }),
      });
      assert.equal(post.status, 403, `${site} POST`);
      assert.equal(fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8"), before);
    }
  });

  test("Sec-Fetch-Site same-origin and none are served; no Sec-Fetch headers pass too", async () => {
    const srv = await iniciar(estudioRico());
    for (const site of ["same-origin", "none"]) {
      for (const p of ["/", "/api/estudio", FILE, THUMB]) {
        assert.equal((await req(srv, { path: p, headers: SF(site) })).status, 200, `${site} ${p}`);
      }
    }
    assert.equal((await req(srv, { path: "/api/estudio" })).status, 200);
    const [r] = await accion(srv, [{ tipo: "estado", ruta: C1, valor: "approved" }]);
    assert.equal(r.ok, true);
  });

  test("a cross-site top-level navigation to / opens the page; nothing else is allowed that way", async () => {
    const srv = await iniciar(estudioRico());
    for (const site of ["cross-site", "same-site"]) {
      for (const p of ["/", "/?t=old", "/?x=1"]) {
        const r = await req(srv, { path: p, headers: SF(site, NAV) });
        assert.equal(r.status, p === "/?t=old" ? 302 : 200, `${site} ${p}`);
        if (p === "/") assert.match(r.headers["content-type"], /text\/html/);
      }
      assert.equal((await req(srv, { method: "HEAD", path: "/", headers: SF(site, NAV) })).status, 200);
      for (const p of ["/api/estudio", "/api/salud", FILE, THUMB]) {
        assert.equal((await req(srv, { path: p, headers: SF(site, NAV) })).status, 403, `navigate ${site} ${p}`);
      }
      // Not a navigation, or not to a document: still refused on /.
      assert.equal((await req(srv, { path: "/", headers: SF(site, { "Sec-Fetch-Mode": "no-cors", "Sec-Fetch-Dest": "script" }) })).status, 403);
      assert.equal((await req(srv, { path: "/", headers: SF(site, { "Sec-Fetch-Mode": "no-cors", "Sec-Fetch-Dest": "image" }) })).status, 403);
      assert.equal((await req(srv, { path: "/", headers: SF(site, { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "iframe" }) })).status, 403);
      assert.equal((await req(srv, { path: "/", headers: SF(site) })).status, 403);
      // A POST is never a top-level navigation to the page.
      const post = await req(srv, { method: "POST", path: "/", headers: SF(site, { ...NAV, "Content-Type": "application/json" }), body: "{}" });
      assert.equal(post.status, 403);
    }
    // The old-bookmark redirect works from a link clicked anywhere, without a cookie.
    const old = await req(srv, { path: "/?t=old", headers: SF("cross-site", NAV) });
    assert.equal(old.status, 302);
    assert.equal(old.headers.location, "/");
    assert.equal(old.headers["set-cookie"], undefined);
  });

  test("a foreign or null Origin is rejected on mutations; the right one passes", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    const file = path.join(s, `${C1}/creativo.json`);
    const before = fs.readFileSync(file, "utf8");
    const post = (origin) => req(srv, {
      method: "POST", path: "/api/acciones",
      headers: { "Content-Type": "application/json", ...(origin === undefined ? {} : { Origin: origin }) },
      body: JSON.stringify({ acciones: [{ tipo: "estado", ruta: C1, valor: "approved" }] }),
    });
    for (const o of ["http://evil.example", "null", `http://127.0.0.1:${srv.port + 1}`, `https://127.0.0.1:${srv.port}`, `http://127.0.0.1.evil.example:${srv.port}`]) {
      const r = await post(o);
      assert.equal(r.status, 403, o);
      assert.equal(fs.readFileSync(file, "utf8"), before, o);
    }
    for (const o of [`http://127.0.0.1:${srv.port}`, `http://localhost:${srv.port}`]) {
      const r = await post(o);
      assert.equal(r.status, 200, o);
      assert.equal(r.json().resultados[0].ok, true);
      await accion(srv, [{ tipo: "estado", ruta: C1, valor: "draft" }]);
    }
    assert.equal((await post(undefined)).status, 200, "no Origin (curl, scripts) passes");
    assert.equal(leer(s, `${C1}/creativo.json`).status, "approved");
  });

  test("Host variants, a trailing-slash Origin, framing destinations and CORS/framing headers", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    for (const h of [`localhost.:${srv.port}`, `LOCALHOST:${srv.port}`, `[::1]:${srv.port}`, `127.1:${srv.port}`]) {
      assert.equal((await req(srv, { path: "/api/estudio", headers: { Host: h } })).status, 403, h);
    }
    const nav = { "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "navigate" };
    for (const d of ["embed", "object", "frame", "iframe"]) {
      assert.equal((await req(srv, { path: "/", headers: { ...nav, "Sec-Fetch-Dest": d } })).status, 403, d);
    }
    assert.equal((await req(srv, { path: "//", headers: { ...nav, "Sec-Fetch-Dest": "document" } })).status, 403);
    const before = fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8");
    const p = await req(srv, {
      method: "POST", path: "/api/acciones",
      headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${srv.port}/` },
      body: JSON.stringify({ acciones: [{ tipo: "estado", ruta: C1, valor: "approved" }] }),
    });
    assert.equal(p.status, 403);
    assert.equal(fs.readFileSync(path.join(s, `${C1}/creativo.json`), "utf8"), before);
    const page = await req(srv, { path: "/" });
    assert.equal(page.headers["x-frame-options"], "DENY");
    assert.equal(page.headers["access-control-allow-origin"], undefined);
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
      assert.ok(!r.text.includes("SECRETO") && !r.text.includes("available"), p);
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

  test("refreshing an item whose content did not change keeps it searchable (no 500 on the next search)", async () => {
    const s = estudioRico();
    const srv = await iniciar(s, { watch: false });
    const q = (t) => req(srv, { path: "/api/elementos?archivados=1&q=" + encodeURIComponent(t) });
    const [a1] = await accion(srv, [{ tipo: "archivar", ruta: C1 }]);
    assert.equal(a1.ok, true);
    // The detail view prepares the search data for the new index version without listing anything.
    assert.equal((await req(srv, { path: "/api/elemento?ruta=" + encodeURIComponent(C1) })).status, 200);
    const [a2] = await accion(srv, [{ tipo: "archivar", ruta: C1 }]); // same JSON, same files: the entity is read again
    assert.equal(a2.ok, true);
    const r = await q("dolor");
    assert.equal(r.status, 200, r.text);
    assert.equal((await q("zzz-nada")).json().total, 0);
  });

  describe("papelera/vaciar with ids", () => {
    const post = (srv, b) => req(srv, { method: "POST", path: "/api/papelera/vaciar", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    const enPapelera = (s) => fs.readdirSync(path.join(s, ".papelera")).sort();

    test("deletes exactly the ids given: an entry added after the snapshot survives", async () => {
      const s = estudioRico();
      const srv = await iniciar(s);
      const [a, b] = await accion(srv, [{ tipo: "papelera", ruta: C1 }, { tipo: "papelera", ruta: C2 }]);
      const snapshot = (await getJson(srv, "/api/papelera")).entries.map((e) => e.id).sort();
      assert.deepEqual(snapshot, [a.id, b.id].sort());
      const [c] = await accion(srv, [{ tipo: "papelera", ruta: C3 }]); // arrives after the confirmation dialog was drawn
      const r = await post(srv, { ids: snapshot });
      assert.equal(r.status, 200);
      assert.deepEqual(r.json(), { eliminados: 2, ids: snapshot, invalidos: [], noEncontrados: [], fallidos: [] });
      assert.deepEqual(enPapelera(s), [c.id]);
      assert.deepEqual((await getJson(srv, "/api/papelera")).entries.map((e) => e.id), [c.id]);
      assert.ok(fs.existsSync(path.join(s, `.papelera/${c.id}/${C3}/creativo.json`)), "the newer entry keeps its content");
    });

    test("unknown and invalid ids are reported, not fatal; the valid ones still go", async () => {
      const s = estudioRico();
      const srv = await iniciar(s);
      const [a, b] = await accion(srv, [{ tipo: "papelera", ruta: C1 }, { tipo: "papelera", ruta: C2 }]);
      const gone = "2020-01-01T000000Z-abcdef";
      const malos = ["..", ".", "../clientes", `../${a.id}`, `${a.id}/..`, `${a.id}/${C1}`, "/etc", "", "papelera.json", a.id.slice(0, -6) + "ABCDEF", 7, null, { id: a.id }, ["x"]];
      const r = await post(srv, { ids: [a.id, gone, ...malos, a.id] });
      assert.equal(r.status, 200);
      const j = r.json();
      assert.equal(j.eliminados, 1);
      assert.deepEqual(j.ids, [a.id]);
      assert.deepEqual(j.noEncontrados, [gone]);
      assert.equal(j.invalidos.length, malos.length);
      assert.deepEqual(j.fallidos, []);
      assert.deepEqual(enPapelera(s), [b.id]);
      for (const d of ["clientes", "actores", "studio.json"]) assert.ok(fs.existsSync(path.join(s, d)), d + " is untouched");
      assert.ok(fs.existsSync(path.join(s, C3)), "items outside the trash are untouched");
    });

    test("an id is one entry folder name: traversal and symlinks never delete outside the trash", async () => {
      const s = estudioRico();
      const srv = await iniciar(s);
      write(s, "fuera/importante.txt", "no tocar");
      const falso = "2021-02-03T040506Z-0a0b0c";
      fs.mkdirSync(path.join(s, ".papelera"), { recursive: true });
      fs.symlinkSync(path.join(s, "fuera"), path.join(s, ".papelera", falso)); // a link named like an entry
      const r = await post(srv, { ids: [falso, "../fuera", "..%2Ffuera", `${falso}/../../fuera`, "..\\fuera"] });
      assert.equal(r.status, 200);
      assert.equal(r.json().eliminados, 0);
      assert.ok(fs.existsSync(path.join(s, "fuera/importante.txt")));
      assert.ok(fs.lstatSync(path.join(s, ".papelera", falso)).isSymbolicLink(), "the link is left alone");
    });

    test("an empty list deletes nothing (it does not mean everything); ids must be an array of at most a sane size", async () => {
      const s = estudioRico();
      const srv = await iniciar(s);
      await accion(srv, [{ tipo: "papelera", ruta: C1 }]);
      const antes = enPapelera(s);
      const vacio = await post(srv, { ids: [] });
      assert.equal(vacio.status, 200);
      assert.equal(vacio.json().eliminados, 0);
      assert.deepEqual(enPapelera(s), antes);
      for (const mal of ["x", 5, {}, null]) {
        const r = await post(srv, { ids: mal });
        assert.equal(r.status, 400, JSON.stringify(mal));
        assert.deepEqual(enPapelera(s), antes);
      }
      assert.equal((await post(srv, { ids: Array.from({ length: 20001 }, () => "x") })).status, 400);
      assert.deepEqual(enPapelera(s), antes);
    });

    test("ids with antesDe: only the ids that are also older than the cutoff go", async () => {
      const s = estudioRico();
      const srv = await iniciar(s);
      const [a] = await accion(srv, [{ tipo: "papelera", ruta: C1 }]);
      const viejo = "2020-01-01T000000Z-abcdef";
      write(s, `.papelera/${viejo}/clientes/acme/viejo.txt`, "old");
      write(s, `.papelera/${viejo}/papelera.json`, JSON.stringify({ id: viejo, originalPath: "clientes/acme/viejo.txt", trashedAt: "2020-01-01T00:00:00Z", kind: "file" }));
      const otroViejo = "2020-01-02T000000Z-abcdef";
      write(s, `.papelera/${otroViejo}/clientes/acme/viejo2.txt`, "old");
      const r = await post(srv, { ids: [viejo, a.id], antesDe: "2021-01-01T00:00:00Z" });
      assert.equal(r.status, 200);
      assert.deepEqual(r.json().ids, [viejo]);
      assert.deepEqual(enPapelera(s), [otroViejo, a.id].sort(), "the recent entry and the old one not named stay");
    });

    test("without ids the old behaviour holds: everything, or only what is before antesDe", async () => {
      const s = estudioRico();
      const srv = await iniciar(s);
      await accion(srv, [{ tipo: "papelera", ruta: C1 }, { tipo: "papelera", ruta: C2 }]);
      const r = await post(srv, {});
      assert.equal(r.json().eliminados, 2);
      assert.deepEqual(enPapelera(s), []);
    });
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
      productTitle: "Ñandú de madera", clientName: "Acme SRL", type: "static", pieces: 1,
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

// ---------- T3: richer items, credits used, batch filter, cleaning old versions ----------

describe("T3 API fields and filters", () => {
  test("items carry productTitle, clientName, type and pieces (creatives: static|carousel, slots with a current file)", async () => {
    const s = estudioRico();
    const K = "clientes/acme/MLA1/creativos/2026-01-05-x-carrusel";
    write(s, `${K}/creativo.json`, {
      id: "2026-01-05-x-carrusel", batch: "lote-3", title: "Carrusel de pasos", type: "carousel", status: "draft",
      slots: ["tarjeta-1", "tarjeta-2", "tarjeta-3"], updatedAt: "2026-01-05T12:00:00Z",
    });
    write(s, `${K}/tarjeta-1-v1.png`, PNG);
    write(s, `${K}/tarjeta-2-v1.png`, PNG);
    write(s, `${K}/tarjeta-2-v2.png`, PNG);
    const srv = await iniciar(s);
    const por = async (qs) => Object.fromEntries((await getJson(srv, "/api/elementos?archivados=1&" + qs)).items.map((i) => [i.path.split("/").pop(), i]));
    const cr = await por("tipo=creative");
    assert.equal(cr["2026-01-05-x-carrusel"].type, "carousel");
    assert.equal(cr["2026-01-05-x-carrusel"].pieces, 2, "tarjeta-3 has no image yet");
    assert.equal(cr["2026-01-02-x-dolor"].type, "static");
    assert.equal(cr["2026-01-02-x-dolor"].pieces, 1);
    assert.equal(cr["2026-01-03-x-precio"].productTitle, "Ñandú de madera");
    assert.equal(cr["2026-01-03-x-precio"].clientName, "Acme SRL");
    const v = (await por("tipo=video"))["2026-01-01-cama-problema"];
    assert.deepEqual([v.productTitle, v.clientName, v.type, v.pieces], ["Ñandú de madera", "Acme SRL", null, null]);
    const p = (await por("tipo=product&cliente=beta")).MLB2;
    assert.deepEqual([p.productTitle, p.clientName, p.type, p.pieces], ["Lámpara de pie", "Beta Hogar", null, null]);
    const a = (await por("tipo=actor")) ["ana-v1"];
    assert.deepEqual([a.productTitle, a.clientName, a.type, a.pieces], [null, null, null, null]);
    // The detail view carries them too, and the names follow a rename without a restart.
    const el = await getJson(srv, "/api/elemento?ruta=" + encodeURIComponent(C1));
    assert.deepEqual([el.productTitle, el.clientName, el.type, el.pieces.length], ["Ñandú de madera", "Acme SRL", "static", 1]);
  });

  test("a renamed product shows its new title on its items (the view is rebuilt)", async () => {
    const s = estudioRico();
    const srv = await iniciar(s);
    await getJson(srv, "/api/elementos");
    const f = path.join(s, "clientes/acme/MLA1/producto.json");
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    j.title = "Nombre nuevo";
    fs.writeFileSync(f, JSON.stringify(j));
    await esperar(async () => (await getJson(srv, "/api/elementos?tipo=creative")).items.every((i) => i.productTitle === "Nombre nuevo"));
  });

  test("/api/estudio creditsUsed sums credits of actors, videos and creatives (archived ones too); products and brands do not count", async () => {
    const s = estudioRico();
    const edit = (rel, f) => { const j = leer(s, rel); f(j); fs.writeFileSync(path.join(s, rel), JSON.stringify(j, null, 2)); };
    edit("actores/ana-v1/actor.json", (j) => { j.credits = 13.75; });
    edit(`${V1}/video.json`, (j) => { j.credits = 56; });
    edit(`${C3}/creativo.json`, (j) => { j.credits = 1.1; });
    edit("clientes/acme/MLA1/producto.json", (j) => { j.credits = 1000; });
    edit("clientes/acme/marca/marca.json", (j) => { j.credits = 1000; });
    edit(`${C2}/creativo.json`, (j) => { j.credits = "mucho"; });
    const srv = await iniciar(s);
    // C1 has 5.5, C3 (archived) 1.1, C2 a non-number: 13.75 + 56 + 5.5 + 1.1
    assert.equal((await getJson(srv, "/api/estudio")).creditsUsed, 76.35);
    const vacio = await iniciar(estudioBasico());
    assert.equal((await getJson(vacio, "/api/estudio")).creditsUsed, 0);
  });

  test("/api/estudio trashCount is the number of entries in the trash", async () => {
    const srv = await iniciar(estudioRico());
    assert.equal((await getJson(srv, "/api/estudio")).trashCount, 0);
    await accion(srv, [{ tipo: "papelera", ruta: C1 }, { tipo: "papelera", ruta: C2 }]);
    assert.equal((await getJson(srv, "/api/estudio")).trashCount, 2);
  });

  test("lote filters by batch id (exact), together with the other filters; without it nothing changes", async () => {
    const srv = await iniciar(estudioRico());
    const paths = async (qs) => (await getJson(srv, "/api/elementos?" + qs)).items.map((i) => i.path.split("/").pop());
    assert.deepEqual(await paths("tipo=creative&lote=lote-1"), ["2026-01-02-x-dolor"]);
    assert.deepEqual(await paths("tipo=creative&lote=lote-2"), ["2026-01-03-x-precio"], "archived hidden by default");
    assert.deepEqual((await paths("tipo=creative&lote=lote-2&archivados=1")).sort(), ["2026-01-03-x-precio", "2026-01-04-x-viejo"]);
    assert.deepEqual(await paths("tipo=creative&lote=lote-"), [], "exact match, not a prefix");
    assert.deepEqual(await paths("tipo=creative&lote=nada"), []);
    assert.deepEqual(await paths("tipo=creative&lote=lote-2&estado=draft&archivados=1"), ["2026-01-04-x-viejo"]);
    assert.deepEqual(await paths("lote=lote-1"), ["2026-01-02-x-dolor"], "other kinds have no batch");
    const total = (await getJson(srv, "/api/elementos?lote=lote-1")).total;
    assert.equal(total, 1, "total follows the filter");
    assert.equal((await getJson(srv, "/api/elementos?tipo=creative")).total, 2);
    assert.equal((await getJson(srv, "/api/elementos?tipo=creative&lote=")).total, 2, "an empty lote is no filter");
  });
});

describe("limpiarVersiones", () => {
  const DRY = (ruta) => "/api/versiones-antiguas?ruta=" + encodeURIComponent(ruta);

  // V1 with three versions, final.mp4, prompts and a scene; C1 with versions in two slots.
  function estudioConVersiones() {
    const s = estudioRico();
    const j = leer(s, `${V1}/video.json`);
    j.versions = [{ n: 1 }, { n: 2 }, { n: 3 }];
    write(s, `${V1}/video.json`, j);
    for (const n of [2, 3]) { write(s, `${V1}/borrador-v${n}.mp4`, "video " + n); write(s, `${V1}/thumb-v${n}.jpg`, PNG); }
    write(s, `${V1}/final.mp4`, "final");
    write(s, `${V1}/prompt-v1.md`, "p1");
    write(s, `${V1}/prompt-v3.md`, "p3");
    write(s, `${V1}/escena-1.png`, PNG);
    const c = leer(s, `${C1}/creativo.json`);
    c.slots = ["4x5", "9x16"];
    write(s, `${C1}/creativo.json`, c);
    for (const f of ["4x5-base-v1.png", "4x5-base-v2.png", "4x5-diseno-v1.html", "4x5-diseno-v2.html", "9x16-v1.png", "9x16-v2.png", "9x16-v3.png", "prompt-v1.md", "prompt-v2.md"]) {
      write(s, `${C1}/${f}`, "x");
    }
    return s;
  }
  const lista = (s, rel) => fs.readdirSync(path.join(s, rel)).sort();

  test("dry run (GET) lists the files that would move and moves nothing", async () => {
    const s = estudioConVersiones();
    const srv = await iniciar(s);
    const antesV = lista(s, V1);
    const antesC = lista(s, C1);
    const v = await getJson(srv, DRY(V1));
    assert.deepEqual(v, {
      ruta: V1, total: 4,
      files: ["borrador-v1.mp4", "borrador-v2.mp4", "thumb-v1.jpg", "thumb-v2.jpg"].map((f) => `${V1}/${f}`),
    });
    const c = await getJson(srv, DRY(C1));
    assert.equal(c.total, 5);
    assert.deepEqual(c.files, ["4x5-base-v1.png", "4x5-diseno-v1.html", "4x5-v1.png", "9x16-v1.png", "9x16-v2.png"].map((f) => `${C1}/${f}`).sort());
    assert.deepEqual(lista(s, V1), antesV);
    assert.deepEqual(lista(s, C1), antesC);
    assert.ok(!fs.existsSync(path.join(s, ".papelera")), "no trash entry for a dry run");
    assert.deepEqual(await getJson(srv, DRY(C2)), { ruta: C2, total: 0, files: [] });
  });

  test("dry run errors: not an item (404), not a creative or video (400), bad path (400), POST not allowed", async () => {
    const srv = await iniciar(estudioConVersiones());
    assert.equal((await req(srv, { path: DRY("clientes/acme/nada") })).status, 404);
    assert.equal((await req(srv, { path: DRY("actores/ana-v1") })).status, 400);
    assert.equal((await req(srv, { path: DRY("clientes/acme/MLA1") })).status, 400);
    assert.equal((await req(srv, { path: DRY("../etc") })).status, 400);
    assert.equal((await req(srv, { path: DRY("/etc") })).status, 400);
    assert.equal((await req(srv, { path: "/api/versiones-antiguas" })).status, 400);
    const post = await req(srv, { method: "POST", path: DRY(V1), headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(post.status, 404, "like any other GET-only route");
  });

  test("a video keeps its last version, final.mp4, prompts and scenes; the old drafts and thumbs go to the trash", async () => {
    const s = estudioConVersiones();
    const srv = await iniciar(s);
    const [r] = await accion(srv, [{ tipo: "limpiarVersiones", ruta: V1 }]);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.ruta, V1);
    assert.equal(r.movidos, 4);
    assert.equal(r.ids.length, 4);
    assert.deepEqual(lista(s, V1), ["borrador-v3.mp4", "escena-1.png", "final.mp4", "prompt-v1.md", "prompt-v3.md", "thumb-v3.jpg", "video.json"]);
    const entries = (await getJson(srv, "/api/papelera")).entries;
    assert.equal(entries.length, 4);
    assert.deepEqual(entries.map((e) => e.originalPath).sort(), ["borrador-v1.mp4", "borrador-v2.mp4", "thumb-v1.jpg", "thumb-v2.jpg"].map((f) => `${V1}/${f}`));
    assert.ok(entries.every((e) => e.kind === "file" && r.ids.includes(e.id)));
    const el = await getJson(srv, "/api/elemento?ruta=" + encodeURIComponent(V1));
    assert.equal(el.current.video, `${V1}/borrador-v3.mp4`);
    assert.equal(el.finalVideo, `${V1}/final.mp4`);
    assert.equal(el.cover, `${V1}/thumb-v3.jpg`);
    assert.equal(leer(s, `${V1}/video.json`).versions.length, 3, "video.json is not touched");
    // Cleaning again finds nothing and adds no trash entries.
    const [again] = await accion(srv, [{ tipo: "limpiarVersiones", ruta: V1 }]);
    assert.deepEqual(again, { ruta: V1, ok: true, movidos: 0, ids: [] });
    assert.equal((await getJson(srv, "/api/papelera")).entries.length, 4);
  });

  test("a creative keeps the highest N per slot (piece, base and design) and the prompts; restaurar brings every file back", async () => {
    const s = estudioConVersiones();
    const srv = await iniciar(s);
    const antes = lista(s, C1);
    const contenido = Object.fromEntries(antes.map((f) => [f, fs.readFileSync(path.join(s, C1, f))]));
    const [r] = await accion(srv, [{ tipo: "limpiarVersiones", ruta: C1 }]);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.movidos, 5);
    assert.deepEqual(lista(s, C1), ["4x5-base-v2.png", "4x5-diseno-v2.html", "4x5-v2.png", "9x16-v3.png", "creativo.json", "prompt-v1.md", "prompt-v2.md"]);
    const el = await getJson(srv, "/api/elemento?ruta=" + encodeURIComponent(C1));
    assert.deepEqual(el.pieces.map((p) => [p.slot, p.current.n, p.older.length]), [["4x5", 2, 0], ["9x16", 3, 0]]);
    // The entries are the ordinary trash entries: papelera.json with the original path.
    const ids = r.ids;
    for (const id of ids) {
      const meta = leer(s, `.papelera/${id}/papelera.json`);
      assert.equal(meta.id, id);
      assert.equal(meta.kind, "file");
      assert.match(meta.trashedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
      assert.ok(fs.existsSync(path.join(s, ".papelera", id, meta.originalPath)));
    }
    const back = await accion(srv, ids.map((id) => ({ tipo: "restaurar", ruta: id })));
    assert.ok(back.every((x) => x.ok), JSON.stringify(back));
    assert.deepEqual(lista(s, C1), antes);
    for (const f of antes) assert.deepEqual(fs.readFileSync(path.join(s, C1, f)), contenido[f], f);
    assert.equal((await getJson(srv, "/api/papelera")).entries.length, 0);
    const el2 = await getJson(srv, "/api/elemento?ruta=" + encodeURIComponent(C1));
    assert.equal(el2.pieces.find((p) => p.slot === "9x16").older.length, 2);
  });

  test("never moves what could be current: a base newer than the finished piece, a slot with only bases, a version missing from disk", async () => {
    const s = estudioRico();
    write(s, `${C1}/1x1-v1.png`, PNG);
    write(s, `${C1}/1x1-base-v2.png`, PNG); // composing version 2 is still pending
    write(s, `${C1}/tarjeta-1-base-v1.png`, PNG);
    write(s, `${C1}/tarjeta-1-base-v2.png`, PNG);
    const j = leer(s, `${V1}/video.json`);
    j.versions = [{ n: 1 }, { n: 2 }, { n: 3 }]; // version 3 has no file yet
    write(s, `${V1}/video.json`, j);
    write(s, `${V1}/borrador-v2.mp4`, "v2");
    const srv = await iniciar(s);
    const c = await getJson(srv, DRY(C1));
    assert.deepEqual(c.files, [`${C1}/4x5-v1.png`, `${C1}/tarjeta-1-base-v1.png`].sort(), "only the 4x5 v1 and the old base");
    const v = await getJson(srv, DRY(V1));
    assert.deepEqual(v.files, [`${V1}/borrador-v1.mp4`, `${V1}/thumb-v1.jpg`], "version 2 is the newest on disk: kept even though the last entry says 3");
  });

  test("it applies to creatives and videos only, and fails per item without stopping the batch", async () => {
    const s = estudioConVersiones();
    const srv = await iniciar(s);
    const res = await accion(srv, [
      { tipo: "limpiarVersiones", ruta: "actores/ana-v1" },
      { tipo: "limpiarVersiones", ruta: "clientes/acme/MLA1" },
      { tipo: "limpiarVersiones", ruta: "clientes/acme/nada/x" },
      { tipo: "limpiarVersiones", ruta: "../fuera" },
      { tipo: "limpiarVersiones", ruta: V1 },
      { tipo: "limpiarVersiones", ruta: C2 },
    ]);
    assert.deepEqual(res.map((x) => x.ok), [false, false, false, false, true, true]);
    assert.ok(res.slice(0, 4).every((x) => x.error));
    assert.equal(res[4].movidos, 4);
    assert.equal(res[5].movidos, 0);
    assert.ok(fs.existsSync(path.join(s, "actores/ana-v1/actor.json")));
  });

  test("a file that is gone from disk fails alone, the others still go, and the failure says how many moved", async () => {
    const s = estudioConVersiones();
    const srv = await iniciar(s, { watch: false }); // the index still lists the file that is removed next
    fs.rmSync(path.join(s, V1, "thumb-v1.jpg"));
    const [r] = await accion(srv, [{ tipo: "limpiarVersiones", ruta: V1 }]);
    assert.equal(r.ok, false);
    assert.equal(r.movidos, 3);
    assert.equal(r.ids.length, 3);
    assert.match(r.error, /moved 3 of 4 files; failed: thumb-v1\.jpg \(not found\)/);
    assert.deepEqual(lista(s, V1), ["borrador-v3.mp4", "escena-1.png", "final.mp4", "prompt-v1.md", "prompt-v3.md", "thumb-v3.jpg", "video.json"]);
    assert.equal((await getJson(srv, "/api/papelera")).entries.length, 3);
  });

  test("an unexpected fs error midway still reports what moved (ok: false, movidos, ids, the error) so it can be restored", async () => {
    const s = estudioConVersiones();
    const antes = lista(s, V1);
    let n = 0;
    // Test-only hook: the 3rd file raises an fs error that is not one of the server's own checks.
    const srv = await iniciar(s, { alMover: () => { if (++n === 3) throw Object.assign(new Error("boom"), { code: "EIO" }); } });
    const [r] = await accion(srv, [{ tipo: "limpiarVersiones", ruta: V1 }]);
    assert.equal(r.ok, false);
    assert.equal(r.ruta, V1);
    assert.equal(r.movidos, 2);
    assert.equal(r.ids.length, 2);
    assert.match(r.error, /moved 2 of 4 files/);
    assert.match(r.error, /EIO/);
    assert.equal(lista(s, V1).length, antes.length - 2);
    const entries = (await getJson(srv, "/api/papelera")).entries;
    assert.deepEqual(entries.map((e) => e.id).sort(), [...r.ids].sort());
    // The ids are enough to put everything back.
    const back = await accion(srv, r.ids.map((id) => ({ tipo: "restaurar", ruta: id })));
    assert.ok(back.every((x) => x.ok), JSON.stringify(back));
    assert.deepEqual(lista(s, V1), antes);
  });

  test("a read-only item folder fails every file with a clear error, moves nothing and leaves no half-made trash entry", async (t) => {
    if (process.getuid && process.getuid() === 0) return t.skip("root ignores directory permissions");
    const s = estudioConVersiones();
    const srv = await iniciar(s, { watch: false });
    const dir = path.join(s, V1);
    fs.chmodSync(dir, 0o555);
    try {
      const [r] = await accion(srv, [{ tipo: "limpiarVersiones", ruta: V1 }]);
      assert.equal(r.ok, false);
      assert.equal(r.movidos, 0);
      assert.deepEqual(r.ids, []);
      assert.match(r.error, /moved 0 of 4 files/);
      assert.match(r.error, /EACCES/);
    } finally { fs.chmodSync(dir, 0o755); }
    assert.equal(lista(s, V1).length, 11);
    assert.equal((await getJson(srv, "/api/papelera")).entries.length, 0);
    assert.deepEqual(fs.existsSync(path.join(s, ".papelera")) ? fs.readdirSync(path.join(s, ".papelera")) : [], []);
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
  test("GET /api/salud answers its full shape {ok, version, pid, listo, studio, entities, scanMs}", async () => {
    const srv = await iniciar(estudioRico());
    const r = await req(srv, { path: "/api/salud" });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json()).sort(), ["entities", "listo", "ok", "pid", "scanMs", "studio", "version"]);
    const j = r.json();
    assert.equal(j.ok, true);
    assert.equal(j.pid, process.pid);
    assert.equal(j.listo, true);
    assert.equal(j.entities, 8);
    assert.equal(j.studio, srv.studio);
    assert.equal(typeof j.scanMs, "number");
    assert.equal(j.version, JSON.parse(fs.readFileSync(path.join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).version);
    // The Host check still applies.
    assert.equal((await req(srv, { path: "/api/salud", headers: { Host: "evil.example" } })).status, 403);
    assert.equal((await req(srv, { path: "/api/salud?x=1" })).status, 200);
    assert.equal((await req(srv, { method: "HEAD", path: "/api/salud" })).status, 200);
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
    const salud = await req(srv, { path: "/api/salud" });
    assert.equal(salud.json().listo, false);
    assert.equal(salud.json().ok, true);
    for (const p of ["/api/elementos", "/api/estudio", "/api/papelera", `/api/elemento?ruta=${encodeURIComponent(C1)}`]) {
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
    // Not data: the page keeps working, and the cross-site guard applies while indexing too.
    assert.equal((await req(srv, { path: "/" })).status, 200);
    assert.equal((await req(srv, { path: "/api/elementos", headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
    await srv.listo;
    assert.equal((await req(srv, { path: "/api/salud" })).json().listo, true);
    assert.equal((await getJson(srv, "/api/elementos?archivados=1")).total, 8);
    assert.equal((await req(srv, { path: "/datos.js" })).status, 404);
  });

  test("a change made while the index is not ready is picked up once it is", async () => {
    const s = estudioRico();
    const srv = await iniciar(s, { scanDelayMs: 500, sinEsperar: true, watch: false, checkMs: 100 });
    // Written while the index is not ready (the scan has not started): it is in the index once ready.
    assert.equal((await req(srv, { path: "/api/salud" })).json().listo, false);
    write(s, "clientes/acme/MLA1/creativos/2026-03-09-x-tarde/creativo.json", { id: "2026-03-09-x-tarde", title: "Tarde", status: "draft" });
    await srv.listo;
    await esperar(async () => (await getJson(srv, "/api/elementos?q=tarde")).total === 1);
  });

  test("the UGC_GALERIA_TEST_SCAN_DELAY_MS hook slows the scan of a real process; servidor.json is there first", async () => {
    const s = estudioBasico();
    const p = lanzar(s, { UGC_GALERIA_TEST_SCAN_DELAY_MS: "800" });
    const state = path.join(s, ".galeria", "servidor.json");
    await esperar(() => fs.existsSync(state), 8000);
    const j = JSON.parse(fs.readFileSync(state, "utf8"));
    const salud = () => req({ port: j.port }, { path: "/api/salud" });
    assert.equal((await salud()).json().listo, false);
    await esperar(async () => (await salud()).json().listo === true, 5000);
    assert.equal((await req({ port: j.port }, { path: "/api/elementos" })).status, 200);
    p.child.kill("SIGTERM");
    assert.equal((await p.exited).code, 0);
  });

  test("close removes servidor.json only while it still names this process", async () => {
    const s = estudioBasico();
    const state = path.join(s, ".galeria", "servidor.json");
    const own = await iniciar(s);
    await own.close();
    assert.ok(!fs.existsSync(state), "its own state is removed");
    for (const cambio of [{ pid: process.pid + 1 }, { startedAt: "2000-01-01T00:00:00Z" }]) {
      const srv = await iniciar(s);
      const j = leer(s, ".galeria/servidor.json");
      assert.equal(j.pid, process.pid);
      fs.writeFileSync(state, JSON.stringify({ ...j, ...cambio }));
      await srv.close();
      assert.ok(fs.existsSync(state), "the state of another server is kept: " + JSON.stringify(cambio));
      fs.rmSync(state);
    }
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
    assert.deepEqual(Object.keys(j).sort(), ["pid", "plugin", "port", "startedAt", "version"]);
    assert.equal(j.pid, p.child.pid);
    assert.ok(j.port > 0);
    assert.match(j.startedAt, /^\d{4}-\d\d-\d\dT/);
    assert.equal(fs.statSync(state).mode & 0o777, 0o600);
    const salud = await req({ port: j.port }, { path: "/api/salud" });
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
      assert.equal((await req({ port: j.port }, { path: "/api/salud" })).status, 200);
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

describe("stable port and .claude/launch.json", () => {
  // A base port with the whole range free, as far as can be told: the system picks one, then it is freed.
  async function baseLibre() {
    const s = net.createServer();
    await new Promise((r) => s.listen(0, "127.0.0.1", r));
    const p = s.address().port;
    await new Promise((r) => s.close(r));
    return Math.min(p, 65535 - 21);
  }
  const leerLaunch = (studio) => JSON.parse(fs.readFileSync(path.join(studio, ".claude", "launch.json"), "utf8"));

  test("a restarted server takes its last port again, even when a lower one is free", async () => {
    const studio = estudioBasico();
    const base = await baseLibre();
    const blocker = net.createServer();
    await new Promise((r) => blocker.listen(base, "127.0.0.1", r));
    let primero;
    try {
      const srv = await crearServidor({ studio, port: base, idleMin: 0 });
      primero = srv.port;
      await srv.close();
    } finally {
      await new Promise((r) => blocker.close(r));
    }
    assert.ok(primero > base, `port ${primero}`);
    assert.equal(fs.readFileSync(path.join(studio, ".galeria", "puerto"), "utf8").trim(), String(primero));
    const srv2 = await crearServidor({ studio, port: base, idleMin: 0 });
    servers.push(srv2);
    assert.equal(srv2.port, primero);
  });

  test("a last port outside the range is ignored", async () => {
    const studio = estudioBasico();
    const base = await baseLibre();
    write(studio, ".galeria/puerto", `${base + 500}\n`);
    const srv = await crearServidor({ studio, port: base, idleMin: 0 });
    servers.push(srv);
    assert.equal(srv.port, base);
  });

  test("writes the galeria configuration to .claude/launch.json", async () => {
    const studio = estudioBasico();
    const srv = await iniciar(studio);
    assert.deepEqual(leerLaunch(studio), {
      version: "0.0.1",
      configurations: [{ name: "galeria", port: srv.port, url: `http://127.0.0.1:${srv.port}` }],
    });
  });

  test("updates only the galeria entry and keeps the other configurations", async () => {
    const studio = estudioBasico();
    const otra = { name: "web", runtimeExecutable: "npm", runtimeArgs: ["run", "dev"], port: 3000 };
    write(studio, ".claude/launch.json", {
      version: "0.0.1",
      configurations: [otra, { name: "galeria", port: 1, url: "http://127.0.0.1:1" }],
    });
    const srv = await iniciar(studio);
    assert.deepEqual(leerLaunch(studio).configurations, [otra, { name: "galeria", port: srv.port, url: `http://127.0.0.1:${srv.port}` }]);
  });

  test("leaves a malformed launch.json untouched", async () => {
    const studio = estudioBasico();
    const roto = '{"configurations": [\n';
    write(studio, ".claude/launch.json", roto);
    const srv = await iniciar(studio);
    assert.equal((await req(srv, { path: "/api/salud" })).status, 200);
    assert.equal(fs.readFileSync(path.join(studio, ".claude", "launch.json"), "utf8"), roto);
  });
});
