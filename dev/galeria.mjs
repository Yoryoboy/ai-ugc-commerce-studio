// Gallery dev environment: a mock studio with fake clients, products, actors, creatives and videos
// (placeholder images and short color videos, no credits spent), served by the real gallery server.
//
//   node dev/galeria.mjs             generate the studio if missing, then serve it
//   node dev/galeria.mjs --reset     throw the mock studio away and generate it again
//   node dev/galeria.mjs --generar   only generate (no server)
//   node dev/galeria.mjs --seed 7    another random mix (with --reset)
//   node dev/galeria.mjs --port 4400 first port to try (default 4400, away from the real 4317)
//
// The studio lives in dev/.studio/ (git-ignored). The server reads galeria.html from disk on every
// request, so editing plugins/ugc-studio/galeria/galeria.html only needs a browser reload; files
// changed under dev/.studio/ show up by themselves, like in a real studio.
// Needs Node 18+, ImageMagick (`magick`) for labelled placeholders and ffmpeg for the videos;
// without them it falls back to plain color images and empty video files.

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUDIO = path.join(REPO, "dev", ".studio");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valor = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };

// ---------- random, but repeatable ----------

let semilla = Number(valor("--seed", 42)) >>> 0 || 42;
const rnd = () => { semilla = (semilla + 0x6d2b79f5) >>> 0; let t = semilla; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const uno = (xs) => xs[Math.floor(rnd() * xs.length)];
const algunos = (xs, n) => [...xs].sort(() => rnd() - 0.5).slice(0, n);
const peso = (pares) => { let r = rnd() * pares.reduce((s, [, w]) => s + w, 0); for (const [v, w] of pares) if ((r -= w) < 0) return v; return pares[0][0]; };
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const HOY = Date.parse("2026-11-26T12:00:00Z");
const fecha = (diasAtras, horas = 0) => new Date(HOY - diasAtras * 86400000 + horas * 3600000).toISOString().replace(/\.\d{3}Z$/, "Z");
const dia = (iso) => iso.slice(0, 10);

// ---------- the mock world ----------

const ACTORES = [
  { id: "martin-v1", name: "Martín", gender: "Hombre", apparentAge: 38, style: "Práctico, barba corta, buzo liso", fitsNiches: ["Hogar", "DIY"], color: "#7a5c43" },
  { id: "lucia-v1", name: "Lucía", gender: "Mujer", apparentAge: 29, style: "Natural, pelo atado, remera blanca", fitsNiches: ["Belleza", "Cuidado personal"], color: "#c98b6b" },
  { id: "lucia-v2", name: "Lucía", gender: "Mujer", apparentAge: 29, style: "Más arreglada, blazer beige", fitsNiches: ["Belleza", "Moda"], color: "#b9785a" },
  { id: "tomas-v1", name: "Tomás", gender: "Hombre", apparentAge: 24, style: "Deportivo, gorra, campera rompevientos", fitsNiches: ["Deportes", "Outdoor"], color: "#3b6ea5" },
  { id: "carmen-v1", name: "Carmen", gender: "Mujer", apparentAge: 52, style: "Cálida, anteojos, cárdigan", fitsNiches: ["Hogar", "Mascotas", "Cocina"], color: "#8a4f7d" },
  { id: "nico-v1", name: "Nico", gender: "Hombre", apparentAge: 33, style: "Barista, delantal, tatuajes finos", fitsNiches: ["Café", "Cocina"], color: "#5b3b2a" },
  { id: "sofi-v1", name: "Sofi", gender: "Mujer", apparentAge: 35, style: "Mamá práctica, jean y buzo", fitsNiches: ["Niños", "Hogar"], color: "#d4a017" },
];

const CLIENTES = [
  { id: "acme-hogar", name: "Acme Hogar", platform: "mercadolibre", primary: "#0c6b62", accent: "#f3c623", tone: "Cercano y práctico", actores: ["martin-v1", "carmen-v1"],
    productos: [["MLA1452367890", "Set de 4 patas de madera para cama", 63529], ["MLA1478812345", "Organizador bajo cama con ruedas", 28990], ["MLA1501122334", "Lámpara de pie nórdica con estante de madera y luz cálida regulable", 74500]] },
  { id: "nube-beauty", name: "Nube Beauty", platform: "tiendanube", primary: "#e8a0b4", accent: "#4a2040", tone: "Suave y honesta, sin promesas", actores: ["lucia-v1", "lucia-v2"],
    productos: [["sku-serum-vitc", "Sérum de vitamina C 30 ml", 18900], ["sku-fps50", "Protector solar FPS 50 toque seco", 15400], ["sku-bruma", "Bruma facial de rosas", 9800], ["sku-kit-noche", "Kit rutina de noche", 41200]] },
  { id: "kinetica", name: "Kinética Deportes", platform: "vtex", primary: "#1d2b53", accent: "#ff6b35", tone: "Energético y directo", actores: ["tomas-v1"],
    productos: [["KIN-1001", "Botella térmica 1 L", 22500], ["KIN-1002", "Mat de yoga antideslizante 6 mm", 31800], ["KIN-1003", "Bandas elásticas x5", 12900], ["KIN-1004", "Mochila running 12 L", 58700]] },
  { id: "pampa-mascotas", name: "Pampa Mascotas", platform: "mercadolibre", primary: "#3f7d20", accent: "#f2e8cf", tone: "Tierno y con humor", actores: ["carmen-v1", "martin-v1"],
    productos: [["MLA1399001122", "Cama para perro antidesgarro talle L", 45600], ["MLA1399003344", "Fuente de agua para gatos 2 L", 32100]] },
  { id: "cafe-del-sur", name: "Café del Sur", platform: "tiendanube", primary: "#5b3b2a", accent: "#e9c46a", tone: "Artesanal, sin snobismo", actores: ["nico-v1"],
    productos: [["cafe-500", "Café de especialidad 500 g", 16500], ["prensa-1l", "Prensa francesa 1 L", 27900], ["molinillo", "Molinillo manual de acero", 38400]] },
  { id: "luma-kids", name: "Luma Kids", platform: "vtex", primary: "#2a9d8f", accent: "#f4a261", tone: "Alegre, para mamás y papás cansados", actores: ["sofi-v1"], sinMarca: true,
    productos: [["LK-210", "Luz de noche proyector de estrellas", 19900], ["LK-305", "Mochila jardín impermeable", 24300]] },
];

const ANGULOS = [
  ["Dolor", "Consciente del problema"], ["Deseo", "No sabe del problema"], ["Precio/oferta", "Listo para comprar"],
  ["Prueba social", "Conoce el producto"], ["Comparación", "Conoce soluciones"], ["Cómo se usa", "Conoce el producto"],
  ["Objeción", "Conoce el producto"], ["Regalo/ocasión", "No sabe del problema"], ["Curiosidad", "No sabe del problema"],
  ["Identidad", "Conoce el problema"], ["Contrarian", "Conoce soluciones"],
];
const VISUALES = ["Producto solo en fondo limpio", "Persona usando el producto", "Detalle/textura", "Estilo foto de cliente (UGC)", "Flat lay", "Estilo captura de reseña"];
const LAYOUTS = ["titular", "beneficios", "comparativa", "oferta", "tarjeta"];
const CTAS = ["Comprar", "Comprar", "Comprar", "Más información", "Ver más", "Obtener oferta"];
const TITULOS = {
  "Dolor": ["Basta de agacharte", "Ya no duele", "Chau a eso que te molesta"], "Deseo": ["Tu rincón, mejor", "Lo que tenías ganas", "Así se ve en casa"],
  "Precio/oferta": ["Envío gratis hoy", "Cuotas sin interés", "Precio de lanzamiento"], "Prueba social": ["Lo que dicen los que ya lo tienen", "Más de 500 vendidos"],
  "Comparación": ["Con y sin", "Lo de siempre vs. esto"], "Cómo se usa": ["En 3 pasos", "Se arma en 5 minutos", "Así se usa"],
  "Objeción": ["¿Y si no me entra?", "¿Se limpia fácil?", "¿Aguanta?"], "Regalo/ocasión": ["Para regalar", "Para el Día de la Madre"],
  "Curiosidad": ["El detalle que nadie mira", "¿Por qué tiene esa forma?"], "Identidad": ["Para quien arma todo solo", "Para los de rutina corta"],
  "Contrarian": ["Más caro no es mejor", "No necesitás otro"],
};
const HOOKS = ["¿A ustedes también les pasa esto?", "Les muestro lo que compré la semana pasada", "Nadie me avisó de esto antes", "POV: por fin lo resolviste", "Probé esto durante un mes y les cuento", "Esto cambió mi mañana"];
const NOTAS = ["Primer borrador desde el storyboard", "Ajusté el diálogo del gancho", "Corregí la mano en la escena 2", "Producto más grande en el plano final", "Más luz natural", "Versión directa 1080p"];

// ---------- files ----------

const tareas = [];
const json = (rel, obj) => { const f = path.join(STUDIO, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(obj, null, 2) + "\n"); };
const texto = (rel, t) => { const f = path.join(STUDIO, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
const tiene = (bin) => spawnSync("sh", ["-c", `command -v ${bin}`]).status === 0;
const MAGICK = tiene("magick") ? "magick" : tiene("convert") ? "convert" : null;
const FFMPEG = tiene("ffmpeg");
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const correr = (bin, argv) => new Promise((resolve) => { const p = spawn(bin, argv, { stdio: "ignore" }); p.on("close", (c) => resolve(c === 0)); p.on("error", () => resolve(false)); });

// A placeholder image: a color with a label (falls back to ffmpeg's plain color, then to a 1-px PNG).
function imagen(rel, color, size, etiqueta) {
  const f = path.join(STUDIO, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  tareas.push(async () => {
    const [w] = size.split("x").map(Number);
    if (MAGICK && await correr(MAGICK, ["-size", size, "xc:" + color, "-fill", "white", "-stroke", "#00000055", "-strokewidth", "1",
      "-font", "DejaVu-Sans-Bold", "-pointsize", String(Math.max(14, Math.round(w / 16))), "-gravity", "center", "-annotate", "0", etiqueta, f])) return;
    if (FFMPEG && await correr("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=${color}:s=${size}`, "-frames:v", "1", f])) return;
    fs.writeFileSync(f, PNG_1PX);
  });
}

// Short videos are made once per color and copied, so a big studio stays fast to build.
const videosBase = new Map();
function video(rel, color) {
  const f = path.join(STUDIO, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (!FFMPEG) { fs.writeFileSync(f, "mock video"); return; }
  const base = path.join(STUDIO, ".mock", "video-" + color.slice(1) + ".mp4");
  if (!videosBase.has(base)) {
    fs.mkdirSync(path.dirname(base), { recursive: true });
    videosBase.set(base, correr("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=270x480:d=3:r=24", "-f", "lavfi", "-i", `color=c=${color}:s=270x480:d=3`,
      "-filter_complex", "[0][1]blend=all_mode=multiply", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", base]));
  }
  tareas.push(async () => { if (await videosBase.get(base)) fs.copyFileSync(base, f); else fs.writeFileSync(f, "mock video"); });
}

// A title as a sentence: a period only when it does not already end in one, ? or ! ("¿Aguanta?", not "¿Aguanta?.").
const oracion = (t) => (/[.!?…]$/.test(t) ? t : t + ".");
const tono = (hex, k) => "#" + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)))).map((n) => n.toString(16).padStart(2, "0")).join("");
const TAM = { "4x5": "540x675", "9x16": "405x720", tarjeta: "540x675", producto: "600x600", retrato: "512x640", escena: "270x480", thumb: "270x480" };

// ---------- build ----------

function generar() {
  fs.rmSync(STUDIO, { recursive: true, force: true });
  const cuenta = { actores: 0, productos: 0, creativos: 0, videos: 0, creditos: 0 };

  for (const a of ACTORES) {
    const credits = 13.75;
    json(`actores/${a.id}/actor.json`, { id: a.id, name: a.name, version: a.id.split("-").pop(), gender: a.gender, apparentAge: a.apparentAge, style: a.style,
      personality: "Cercano y directo", fitsNiches: a.fitsNiches, avoidNiches: [], higgsfield: { elementId: "mock", portraitJobId: "mock", anglesJobId: "mock", characterSheetJobId: "mock" },
      credits, createdAt: fecha(entre(30, 60)) });
    imagen(`actores/${a.id}/retrato.png`, a.color, TAM.retrato, `${a.name}\n${a.id}`);
    imagen(`actores/${a.id}/angulos.png`, tono(a.color, 0.8), "900x400", `${a.name} · ángulos`);
    imagen(`actores/${a.id}/character-sheet.png`, tono(a.color, 0.65), "900x600", `${a.name} · character sheet`);
    cuenta.actores++; cuenta.creditos += credits;
  }

  for (const c of CLIENTES) {
    if (!c.sinMarca) {
      json(`clientes/${c.id}/marca/marca.json`, { name: c.name, colors: { primary: c.primary, accent: c.accent, text: "#142024", background: "#ffffff" },
        fonts: { heading: "Montserrat", body: "Inter", google: true }, logo: "logo.png", tone: c.tone, audience: "Compradores online de Argentina",
        dos: ["Hablar de vos", "Mostrar el producto en uso"], donts: ["No usar mayúsculas sostenidas"], avoidWords: ["barato", "imperdible"],
        sources: [{ type: "proposed" }], createdAt: fecha(entre(20, 40)) });
      imagen(`clientes/${c.id}/marca/logo.png`, c.primary, "400x160", c.name);
    }
    for (const [productId, title, price] of c.productos) {
      const P = `clientes/${c.id}/${productId}`;
      const pslug = slug(title).split("-").slice(0, 3).join("-");
      json(`${P}/producto.json`, { profileId: c.id, clientName: c.name, platform: c.platform, productId, title, price, currency: "ARS",
        status: rnd() < 0.85 ? "active" : "paused", url: "https://example.com/" + pslug, cover: "fotos/foto-1.jpg", createdAt: fecha(entre(25, 45)) });
      texto(`${P}/ficha.md`, `# ${title}\n\n## Claims permitidos\n\n- Ejemplo de claim permitido (mock).\n\n## Claims prohibidos\n\n- Promesas de salud.\n`);
      imagen(`${P}/fotos/foto-1.jpg`, tono(c.primary, 1.1), TAM.producto, title.split(" ").slice(0, 4).join(" "));
      imagen(`${P}/fotos/foto-2.jpg`, tono(c.primary, 0.9), TAM.producto, "en uso");
      cuenta.productos++;

      // Creatives: 0 to 2 batches per product (an empty product on purpose now and then).
      const lotes = peso([[0, 1], [1, 4], [2, 3]]);
      for (let l = 0; l < lotes; l++) {
        const diasLote = entre(1, 25) + l * 7;
        const batch = `${dia(fecha(diasLote))}-${pslug}`;
        for (const [angle, awareness] of algunos(ANGULOS, entre(3, 8))) {
          const carrusel = rnd() < 0.25;
          const slots = carrusel ? Array.from({ length: peso([[2, 1], [3, 3], [4, 2], [5, 1], [10, 0.3]]) }, (_, i) => `tarjeta-${i + 1}`) : rnd() < 0.85 ? ["4x5", "9x16"] : ["4x5"];
          const actorId = rnd() < 0.55 ? uno(c.actores) : null;
          const status = peso([["draft", 4], ["approved", 4], ["discarded", 1.5]]);
          const textMode = rnd() < 0.6 ? "template" : "integrated";
          const titulo = uno(TITULOS[angle]);
          const id = `${dia(fecha(diasLote))}-${pslug}-${slug(angle)}-${slug(titulo).slice(0, 18)}`;
          const C = `${P}/creativos/${id}`;
          const versiones = []; let credits = 0;
          const nVersiones = status === "draft" && rnd() < 0.08 ? 0 : peso([[1, 6], [2, 3], [3, 1]]);
          for (let n = 1; n <= nVersiones; n++) {
            const cambia = n === 1 ? slots : algunos(slots, entre(1, slots.length));
            const cr = textMode === "template" && n > 1 && rnd() < 0.5 ? 0 : cambia.length * 2.75;
            credits += cr;
            versiones.push({ n, slots: cambia, jobIds: cambia.map(() => "mock"), credits: cr, note: n === 1 ? "Primera versión" : "Cambio pedido en la revisión", createdAt: fecha(diasLote - n * 0.1) });
            for (const s of cambia) {
              const etiqueta = `${c.name}\n${titulo}\n${s.replace("x", ":")} · v${n}`;
              imagen(`${C}/${s}-v${n}.png`, tono(c.primary, 0.75 + rnd() * 0.5), s.startsWith("tarjeta") ? TAM.tarjeta : TAM[s], etiqueta);
            }
            texto(`${C}/prompt-v${n}.md`, `# Prompt v${n} (mock)\n\n${titulo}\n`);
          }
          const archived = rnd() < 0.06;
          json(`${C}/creativo.json`, {
            id, batch, title: titulo, type: carrusel ? "carousel" : "static", status,
            concept: { angle, awareness, visual: uno(VISUALES), why: `Es el único del lote que usa ${angle.toLowerCase()} con este visual` },
            actorId, textMode, layout: textMode === "template" ? (carrusel ? "tarjeta" : uno(LAYOUTS.slice(0, 4))) : null, slots,
            copy: {
              primaryText: rnd() < 0.15 ? `${oracion(titulo)} ${title}: lo armás en minutos, queda firme y combina con lo que ya tenés en casa. Envío a todo el país.`.slice(0, 125) : `${oracion(titulo)} ${title}, listo para usar.`,
              headline: title.slice(0, 40), description: rnd() < 0.6 ? "Envío gratis" : undefined, cta: uno(CTAS),
            },
            adName: `${productId}_${slug(angle).replace(/-/g, "")}_${actorId ? actorId.replace(/-v\d+$/, "") : "producto"}_${carrusel ? "carrusel" : "estatica"}`,
            credits, versions: versiones, ...(archived ? { archived: true, archivedAt: fecha(1) } : {}),
            createdAt: fecha(diasLote, -1), updatedAt: fecha(diasLote - nVersiones * 0.1),
          });
          cuenta.creativos++; cuenta.creditos += credits;
        }
      }

      // Videos: 0 to 4 per product, in every status.
      for (let v = 0; v < peso([[0, 2], [1, 3], [2, 3], [3, 2], [4, 1]]); v++) {
        const [angle] = uno(ANGULOS);
        const actorId = uno(c.actores);
        const actor = ACTORES.find((a) => a.id === actorId);
        const dias = entre(1, 30);
        const status = peso([["storyboard", 1], ["draft", 3], ["final", 3], ["discarded", 1]]);
        const hook = uno(HOOKS);
        const id = `${dia(fecha(dias))}-${pslug}-${slug(angle)}-${v + 1}`;
        const V = `${P}/videos/${id}`;
        const escenas = peso([[3, 1], [4, 3], [5, 1]]);
        let credits = escenas * 2.75;
        for (let s = 1; s <= escenas; s++) imagen(`${V}/escena-${s}.png`, tono(actor.color, 0.7 + s * 0.08), TAM.escena, `Escena ${s}\n${actor.name}`);
        imagen(`${V}/storyboard.jpg`, tono(actor.color, 0.6), `${escenas * 135}x240`, "storyboard");
        const versions = [];
        const nVersiones = status === "storyboard" ? 0 : peso([[1, 4], [2, 3], [3, 2], [5, 0.5]]);
        for (let n = 1; n <= nVersiones; n++) {
          const directo = status === "final" && n === nVersiones && rnd() < 0.3;
          const cr = directo ? 90 : 18;
          credits += cr;
          versions.push({ n, jobId: "mock", url: "https://higgsfield.ai/mock/" + id + "-v" + n, resolution: directo ? "1080p" : "480p", credits: cr, note: n === 1 ? NOTAS[0] : uno(NOTAS.slice(1)), createdAt: fecha(dias - n * 0.05) });
          video(`${V}/borrador-v${n}.mp4`, tono(actor.color, 0.8 + n * 0.1));
          imagen(`${V}/thumb-v${n}.jpg`, tono(actor.color, 0.8 + n * 0.1), TAM.thumb, `${actor.name}\nv${n}`);
          texto(`${V}/prompt-v${n}.md`, `# Prompt v${n} (mock)\n\n${hook}\n`);
        }
        if (status === "final") { video(`${V}/final.mp4`, tono(actor.color, 1.2)); credits += 72; }
        const conTexto = status === "final" ? rnd() < 0.8 : status === "draft" ? rnd() < 0.2 : false;
        const titulo = uno(TITULOS[angle]);
        json(`${V}/video.json`, {
          id, title: titulo, actorId, status, angle, hook,
          adName: rnd() < 0.85 ? `${productId}_${slug(angle).replace(/-/g, "")}_${actorId.replace(/-v\d+$/, "")}_video` : undefined,
          ...(conTexto ? { copy: { primaryText: `${hook} ${title}, como lo ves en el video.`.slice(0, 125), headline: title.slice(0, 40), description: rnd() < 0.5 ? "Envío gratis" : undefined, cta: uno(CTAS) } } : {}),
          script: `${hook} Lo probé con ${title.toLowerCase()} y les cuento cómo me fue. (guion mock)`,
          durationSec: uno([10, 15, 15, 15, 20, 30]), scenes: escenas, credits, versions,
          finalUrl: status === "final" ? "https://higgsfield.ai/mock/" + id + "-final" : null,
          ...(rnd() < 0.05 ? { archived: true, archivedAt: fecha(2) } : {}),
          createdAt: fecha(dias, -1), updatedAt: fecha(dias - nVersiones * 0.05),
        });
        cuenta.videos++; cuenta.creditos += credits;
      }
    }
  }

  json("studio.json", { connectors: { higgsfield: "Higgsfield", bimcp: "bi-mcp" }, storyboardScenes: null, creativeConcepts: null,
    credits: { available: 1248.5, checkedAt: fecha(0, -2) }, createdAt: fecha(60), mock: true });
  return cuenta;
}

async function vaciarTareas() {
  let i = 0;
  const trabajador = async () => { while (i < tareas.length) await tareas[i++](); };
  await Promise.all(Array.from({ length: 8 }, trabajador));
}

// ---------- main ----------

const existe = fs.existsSync(path.join(STUDIO, "studio.json"));
if (flag("--reset") || flag("--generar") || !existe) {
  const t = Date.now();
  const c = generar();
  await vaciarTareas();
  console.log(`Mock studio in ${path.relative(REPO, STUDIO)}/: ${CLIENTES.length} clients, ${c.productos} products, ${c.actores} actors, ${c.creativos} creatives, ${c.videos} videos, ${tareas.length} media files (${((Date.now() - t) / 1000).toFixed(1)} s).`);
  if (!MAGICK) console.log("No ImageMagick: placeholders have no labels.");
  if (!FFMPEG) console.log("No ffmpeg: video files are empty placeholders.");
}
if (!flag("--generar")) {
  const { crearServidor } = await import(pathToFileURL(path.join(REPO, "plugins", "ugc-studio", "servidor", "servidor.mjs")).href);
  const srv = await crearServidor({ studio: STUDIO, port: Number(valor("--port", 4400)), idleMin: 0 });
  console.log(`Gallery (mock data) on http://127.0.0.1:${srv.port}/  ·  edit galeria.html and reload  ·  Ctrl+C to stop`);
  const parar = async () => { await srv.close(); process.exit(0); };
  process.on("SIGINT", parar);
  process.on("SIGTERM", parar);
}
