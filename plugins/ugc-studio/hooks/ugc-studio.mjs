// UGC Studio mod: a spend guard for Higgsfield generations and a credits meter
// above the prompt. Both only act inside a studio (a folder with studio.json).
//
// tool.call (Higgsfield generate_*): price the call with get_cost: true, then
// hold it and ask the user: Generar, Pasar a borrador (direct videos only) or
// Cancelar. Anything but an explicit Generar or Pasar a borrador refuses it.
// After a generation runs, add its price to the session meter and refresh the
// Higgsfield balance.
// ui.render (AbovePrompt): one line with the session spend, the balance and
// the spend by actor and by product.
//
// The host reads on(...) and $.noun.method(...) from source, so they are
// spelled literally, and helpers that take $ are top-level functions.

const GENERATION = /^mcp__(.+)__(generate_video|generate_video_batch|generate_image|generate_image_batch)$/;

// User-facing choices (the studio speaks Spanish).
const GENERATE = "Generar";
const DRAFT = "Pasar a borrador";
const CANCEL = "Cancelar";

// Fallback prices from references/costs.md, used only when get_cost fails.
const VIDEO_PER_SECOND = { "480p": 3, "720p": 7, "1080p": 16 };
const IMAGE_PRICE = { gpt_image_2_6: 2.75 };

// Files whose last change tells which actor or product a generation is for.
const RECENT_WORK =
  "find clientes actores -type f -mmin -30 \\( -name '*.json' -o -name 'prompt-*' \\) 2>/dev/null" +
  " | head -200 | tr '\\n' '\\0' | xargs -0 ls -t 2>/dev/null | head -1";

// undefined: not checked yet; null: not a studio; else { root, balance, names }.
let studio = undefined;
// Spend of this session, in credits.
let spend = { total: 0, actors: {}, products: {} };

export function register(on) {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    studio = undefined;
    spend = { total: 0, actors: {}, products: {} };
    await loadStudio($);
    $.ui.invalidate("ui.render");
    return result;
  });

  // setup can create studio.json after the session started: look again after
  // any tool that writes files, so the band comes up without a new session.
  on("tool.call", { tool: /^(Write|Edit|MultiEdit|Bash)$/ }, async ($, e, next) => {
    const result = await next(e);
    if (!studio) {
      await loadStudio($);
      if (studio) {
        $.ui.invalidate("ui.render");
      }
    }
    return result;
  });

  on("tool.call", { tool: /^mcp__.+__generate_(video|image)(_batch)?$/ }, async ($, e, next) => {
    // Not a studio yet is checked again on every generation: a studio found
    // late must never let a generation through without the question.
    if (!studio) {
      await loadStudio($);
    }
    if (studio === null || isPriceCheck(e)) {
      return next(e);
    }
    const [, server, tool] = GENERATION.exec(e.tool);
    const plan = await planOf($, server, tool, e);

    let answer = CANCEL;
    try {
      answer = await $.ui.ask(question(plan), plan.draft ? [GENERATE, DRAFT, CANCEL] : [GENERATE, CANCEL]);
    } catch {
      // Dismissed, "Chat about this", or claude -p with nobody to ask.
      answer = null;
    }

    let run = null;
    if (answer === GENERATE) {
      run = { event: e, quote: plan.quote };
    } else if (answer === DRAFT && plan.draft) {
      run = { event: plan.draft.event, quote: plan.draft.quote };
    }
    if (run === null) {
      return { deny: refusal(answer) };
    }

    const result = await next(run.event);
    if (result.deny !== undefined || result.isError) {
      return result;
    }
    const charged = chargedCredits(run.quote, plan.items, resultText(result));
    if (charged > 0) {
      await record($, server, charged);
    }
    return run.event === e ? result : withNote(result, DRAFT_NOTE);
  }).catch(async ($, e, next) => {
    if (next.called) return next(e);
    return {
      deny: `The UGC Studio spend guard failed (${next.error.kind}), so this generation did not run and spent nothing. Tell the user, and do not retry until they say so.`,
    };
  });

  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {
    const props = e.props ?? e;
    if (!studio || props.hasSurvey) {
      return next(e);
    }
    const { Box, Text } = $.ui.resolve(e);
    return band(Box, Text, props.bodyColumns ?? 80);
  });
}

// ---- Studio ----------------------------------------------------------------

async function loadStudio($) {
  try {
    const root = await $.session.cwd();
    if (!(await $.fs.exists(`${root}/studio.json`))) {
      studio = null;
      return;
    }
    let balance = null;
    try {
      const settings = JSON.parse(await $.fs.read(`${root}/studio.json`));
      const available = Number(settings?.credits?.available);
      balance = Number.isFinite(available) ? available : null;
    } catch {
      // A broken studio.json: the sincronizar hook reports it; the meter starts without a balance.
    }
    studio = { root, balance, names: {} };
  } catch {
    studio = null;
  }
}

// ---- Reading a generation call ---------------------------------------------

/** The call's params as an object; Higgsfield also accepts them as a JSON string. */
function paramsOf(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? value : {};
}

/** A get_cost call only reads a price, so it passes without a question. */
function isPriceCheck(e) {
  return paramsOf(e.params).get_cost === true;
}

/** The single-generation params a call holds: one for generate_*, one per request for a batch. */
function itemsOf(tool, e) {
  if (tool.endsWith("_batch")) {
    const requests = Array.isArray(e.requests) ? e.requests : [];
    return requests.map((request) => paramsOf(request?.params));
  }
  return [paramsOf(e.params)];
}

const isVideo = (tool) => tool.startsWith("generate_video");

/** A direct video (not a draft, not a draft being finalized) can be turned into a draft. */
function canDraft(tool, params) {
  return isVideo(tool) && params.draft !== true && !params.draft_job_id && !["480p", "720p"].includes(params.resolution);
}

function asDraft(params) {
  const { resolution, ...rest } = params;
  return { ...rest, draft: true };
}

// ---- Pricing ---------------------------------------------------------------

/** What the question shows and what each answer runs. */
async function planOf($, server, tool, e) {
  const items = itemsOf(tool, e);
  const quote = await quoteOf($, server, tool, items);
  const plan = { tool, items, quote, balance: studio.balance, draft: null };

  if (items.length > 0 && items.every((params) => canDraft(tool, params))) {
    const drafts = items.map(asDraft);
    const event = tool.endsWith("_batch")
      ? { ...e, requests: e.requests.map((request, i) => ({ ...request, params: drafts[i] })) }
      : { ...e, params: drafts[0] };
    plan.draft = { event, quote: await quoteOf($, server, tool, drafts) };
  }
  return plan;
}

/** { credits, exact } for all items; credits is null when no price is known. */
async function quoteOf($, server, tool, items) {
  const single = isVideo(tool) ? "generate_video" : "generate_image";
  let credits = 0;
  let exact = true;
  for (const params of items) {
    let price = await priceCheck($, server, single, params);
    if (price === null) {
      price = estimate(single, params);
      exact = false;
    }
    if (price === null) {
      return { credits: null, exact: false };
    }
    credits += price;
  }
  return { credits: round(credits), exact };
}

/** The exact price from Higgsfield (get_cost: true spends nothing), or null. */
async function priceCheck($, server, tool, params) {
  try {
    const answer = await $.mcp.call(server, tool, { params: { ...params, get_cost: true } });
    if (answer.isError) {
      return null;
    }
    const cost = parseJson(blocksText(answer.content))?.cost;
    const credits = Number(cost?.credits_exact ?? cost?.credits);
    return Number.isFinite(credits) ? credits * Math.max(1, Number(params.count) || 1) : null;
  } catch {
    return null;
  }
}

function estimate(tool, params) {
  const count = Math.max(1, Number(params.count) || 1);
  if (tool === "generate_image") {
    const price = IMAGE_PRICE[params.model];
    return price === undefined ? null : price * count;
  }
  if (params.model !== "seedance_2_5") {
    return null;
  }
  const resolution = params.draft === true ? "480p" : params.resolution ?? "1080p";
  const perSecond = VIDEO_PER_SECOND[resolution];
  const seconds = Number(params.duration) || 5;
  return perSecond === undefined ? null : perSecond * seconds * count;
}

/** Credits actually spent: none when nothing was submitted, a share for a partial batch. */
function chargedCredits(quote, items, text) {
  if (quote.credits === null || /unlim_choice/.test(text)) {
    return 0;
  }
  const body = parseJson(text);
  const submitted = Number(body?.submitted_count);
  if (items.length > 0 && Number.isFinite(submitted)) {
    return round((quote.credits * Math.min(submitted, items.length)) / items.length);
  }
  return quote.credits;
}

// ---- The question ----------------------------------------------------------

function question(plan) {
  const { tool, items, quote, balance, draft } = plan;
  const first = items[0] ?? {};
  const what = isVideo(tool) ? "video" : items.length > 1 || Number(first.count) > 1 ? "imágenes" : "imagen";
  const details = [
    first.model,
    first.draft_job_id ? "finalizar borrador" : first.draft === true ? "borrador 480p" : first.resolution,
    first.duration ? `${first.duration} s` : null,
    items.length > 1 ? `${items.length} pedidos` : Number(first.count) > 1 ? `${first.count} unidades` : null,
  ].filter(Boolean);

  const lines = [`UGC Studio · ¿Generar ${what}? ${details.join(" · ")}`];
  lines.push(`Cuesta ${credits(quote)}${afterSpend(balance, quote)}.`);
  if (draft) {
    lines.push(
      `Si la idea es nueva, conviene un borrador: ${credits(draft.quote)}${afterSpend(balance, draft.quote)}, y se finaliza a 1080p dentro de 7 días sin regenerar.`,
    );
  }
  return lines.join("\n");
}

function credits(quote) {
  if (quote.credits === null) {
    return "un precio que no pude calcular";
  }
  return `${quote.exact ? "" : "~"}${fmt(quote.credits)} créditos`;
}

function afterSpend(balance, quote) {
  if (balance === null || quote.credits === null) {
    return "";
  }
  return ` (saldo ${fmt(balance)} → te quedan ${fmt(balance - quote.credits)})`;
}

function refusal(answer) {
  const said = answer && answer !== CANCEL ? ` The user answered: «${answer}».` : "";
  return `The user did not approve this Higgsfield generation in the UGC Studio spend guard, so it did not run and spent nothing.${said} Ask the user what to change before trying again.`;
}

const DRAFT_NOTE =
  "UGC Studio: the user switched this generation to a 480p draft (draft: true) in the spend guard. Record it as a draft; it can be finalized to 1080p with draft_job_id within 7 days.";

function withNote(result, note) {
  if (Array.isArray(result.result)) {
    return { ...result, result: [...result.result, { type: "text", text: note }] };
  }
  if (typeof result.result === "string") {
    return { ...result, result: `${result.result}\n\n${note}` };
  }
  return result;
}

// ---- The meter -------------------------------------------------------------

async function record($, server, charged) {
  spend.total = round(spend.total + charged);
  const owner = await ownerOf($);
  if (owner.actor) {
    spend.actors[owner.actor] = round((spend.actors[owner.actor] ?? 0) + charged);
  }
  if (owner.product) {
    spend.products[owner.product] = round((spend.products[owner.product] ?? 0) + charged);
  }
  studio.balance = await balanceOf($, server, studio.balance === null ? null : studio.balance - charged);
  $.ui.invalidate("ui.render");
}

async function balanceOf($, server, fallback) {
  try {
    const answer = await $.mcp.call(server, "balance", {});
    const credits = Number(parseJson(blocksText(answer.content))?.credits);
    return !answer.isError && Number.isFinite(credits) ? credits : fallback;
  } catch {
    return fallback;
  }
}

/** The actor and product names of the most recent work in the studio, when it can tell. */
async function ownerOf($) {
  const owner = { actor: null, product: null };
  try {
    const run = await $.process.run(["sh", "-c", RECENT_WORK], { cwd: studio.root, timeoutMs: 5000 });
    const path = run.stdout.trim().replace(/^\.\//, "");
    const product = /^clientes\/([^/]+)\/([^/]+)\//.exec(path);
    const item = /^(clientes\/[^/]+\/[^/]+\/(videos|creativos)\/[^/]+)\//.exec(path);
    const actor = /^actores\/([^/]+)\//.exec(path);
    if (product && product[2] !== "marca") {
      owner.product = await nameOf($, `clientes/${product[1]}/${product[2]}/producto.json`, "title", product[2]);
    }
    let actorId = actor ? actor[1] : null;
    if (item) {
      const file = item[2] === "videos" ? "video.json" : "creativo.json";
      actorId = parseJson(await $.fs.read(`${studio.root}/${item[1]}/${file}`))?.actorId ?? null;
    }
    if (actorId) {
      owner.actor = await nameOf($, `actores/${actorId}/actor.json`, "name", actorId);
    }
  } catch {
    // Unknown owner: the credits still count in the session total.
  }
  return owner;
}

async function nameOf($, file, field, fallback) {
  if (studio.names[file] === undefined) {
    let name = fallback;
    try {
      name = String(parseJson(await $.fs.read(`${studio.root}/${file}`))?.[field] ?? fallback);
    } catch {
      // keep the id
    }
    studio.names[file] = name;
  }
  return studio.names[file];
}

function band(Box, Text, columns) {
  const parts = [
    Text({ key: "title", color: "magenta", bold: true, children: "◆ UGC Studio" }),
    Text({ key: "spend", children: `  sesión ${fmt(spend.total)} cr` }),
  ];
  if (studio.balance !== null) {
    parts.push(Text({ key: "balance", dimColor: true, children: ` · saldo ${fmt(studio.balance)} cr` }));
  }
  let width = 13 + `  sesión ${fmt(spend.total)} cr`.length + (studio.balance === null ? 0 : ` · saldo ${fmt(studio.balance)} cr`.length);
  for (const [key, label, totals] of [
    ["actors", "actores", spend.actors],
    ["products", "productos", spend.products],
  ]) {
    const text = breakdown(label, totals);
    if (text !== "" && width + text.length <= columns - 2) {
      parts.push(Text({ key, dimColor: true, children: text }));
      width += text.length;
    }
  }
  return Box({ flexDirection: "row", paddingX: 1, children: parts });
}

function breakdown(label, totals) {
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return "";
  }
  return `   ${label}: ${entries.map(([name, n]) => `${short(name)} ${fmt(n)}`).join(" · ")}`;
}

// ---- Small helpers ---------------------------------------------------------

function blocksText(blocks) {
  return Array.isArray(blocks)
    ? blocks.filter((b) => b && b.type === "text").map((b) => String(b.text ?? "")).join("\n")
    : "";
}

function resultText(result) {
  if (Array.isArray(result.result)) return blocksText(result.result);
  if (typeof result.result === "string") return result.result;
  if (typeof result.text === "string") return result.text;
  return "";
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const round = (n) => Math.round(n * 100) / 100;
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));
const short = (name) => (name.length > 22 ? `${name.slice(0, 21)}…` : name);
