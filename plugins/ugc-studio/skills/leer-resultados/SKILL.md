---
name: leer-resultados
description: Read how the studio's Meta ads performed, read-only through BI-MCP — match each ad's results to the creative or video that made it (by adName), judge winners and losers with a minimum-data floor, explain it in plain Spanish with a short table, recommend the next batch (iterate, retire, test something new) and save the learnings to memory. Never edits, pauses or uploads anything. Use when the user asks for resultados, métricas, "cómo anduvo", "qué funcionó", ganadores, perdedores, "qué apago", qué escalar, ROAS, CPA, CTR or how the anuncios or creativos are doing.
---

# Read the results

The user is usually not a programmer. Talk in Spanish (Rioplatense, warm, short). You
recommend, they decide. This skill only reads: it spends no credits and changes nothing.

Shared files are in `${CLAUDE_PLUGIN_ROOT}/references/`: `workspace.md` (where creatives and
videos live, `adName`), `memoria.md`, `meta-ads.md` and, when it exists, `marketing/hooks.md` and
`marketing/formatos-meta.md` to pick the next tests. Read `studio.json` first; if it is missing,
run `setup`.

**Read only.** The only BI-MCP tools this skill calls are `meta_get_ads_performance`, and
optionally `meli_list_product_ads_advertisers`, `meli_search_product_ads_ads`,
`meli_get_item_visits` and `meli_get_sales_by_item`. Never call a write tool (`meta_create_*`,
`meta_upload_*`, `meli_update_*`, `meli_create_item`, `meli_pause_or_reactivate_item`,
`meli_answer_question`…), even if the user asks to "apagar" or "escalar" an ad: pausing and
scaling is theirs, in Ads Manager or another MCP, and you tell them which ads and why. If
BI-MCP is not connected, say so and stop: never estimate numbers.

**Memory.** Follow `memoria.md`, section "When results are read": search it first, save at the
end. Skip it silently if Engram is not available.

## 1. Client and dates

Ask which client (BI-MCP profile, `profileId`) and which dates. Recommend a range: from the day
the ads went live (or the last 14 days) until yesterday. Today's numbers are partial. If the
user does not know the profile, call `meta_get_ads_performance` without `profileId`: it lists
the profiles with a Meta account. Search memory (`memoria.md`) for the previous reading of this
client or product and keep it to compare.

## 2. What the studio made

Read `clientes/<profileId>/*/creativos/*/creativo.json` and
`clientes/<profileId>/*/videos/*/video.json` (`workspace.md`; archived ones too, they may still
run). Per piece keep: id, product, type, status, `adName`, angle, awareness, visual, actor and
the concept's `why` or hypothesis. A video has no `adName`: match it by the name the user gave
it in Meta (ask once, or use its `id` or `title` when that is what they used). If the client has
nothing in the studio, say so: you can still read the ads, but you cannot tie them to a concept.

## 3. The numbers

Call `meta_get_ads_performance` with `profileId`, `startDate`, `endDate` (`YYYY-MM-DD`) and
`limit: 100`. It returns per ad: `ad_name`, `effective_status`, `spend`, `impressions`,
`clicks`, `reach`, `purchases`, `purchase_value`, `ctr_percent`, `cpc`, `cpm`, `roas`,
`conversion_rate_percent`, plus the account's `currency_code`. The limit applies per ad account
before sorting, so if an account returns 100 ads, tell the user some may be missing and offer
a narrower date range.

Match each row to a studio piece by `ad_name`:

1. Exact against `adName` (ignore case and spaces at the ends).
2. If not, the ad name starts with the `adName` (Meta ads often get a suffix like `_v2`).
3. Several rows for one piece (same ad in several ad sets): add `spend`, `impressions`,
   `clicks`, `purchases` and `purchase_value`, and recompute CTR (`clicks ÷ impressions`), CPA
   (`spend ÷ purchases`) and ROAS (`purchase_value ÷ spend`). Never average ratios.

List what did not match, both ways: ads in Meta with no piece in the studio ("no las hizo el
estudio, o les cambiaron el nombre") and pieces with no ad ("todavía no se subió, o tiene otro
nombre"). Ask if a pair is an obvious rename; never guess it silently.

For videos, if the rows carry retention metrics (thumbstop or 3-second views, hold rate; they
are pending in https://github.com/Yoryoboy/madeof-bi-mcp/issues/112), use them to diagnose.
Without them, do not invent them: read the video by CTR and purchases only.

Mercado Libre Product Ads is optional, only if the user asks or the product also advertises
there: `meli_list_product_ads_advertisers`, then `meli_search_product_ads_ads` for the dates.
Those ads are the listing's, not the studio's pieces: show them as a separate line, never mixed
into the creative ranking.

## 4. Judge, with a floor

Rules of thumb, not statistics: Meta does not split spend evenly between ads, so a comparison is
a signal, not proof.

- **Floor:** below about 1,000 impressions, no verdict, only "todavía no hay datos suficientes".
  For ROAS or CPA also ask for spend of at least about 2 times the product's price (or the
  user's target CPA) and a few purchases; with less, judge only by CTR and CPC, and say that
  sales are not readable yet. Retiring an ad too early is the common mistake.
- **Which metric:** the one the concept's hypothesis named (`creativo.json` `concept.why`,
  memory). If it named none: ROAS or CPA when there are purchases, CTR otherwise. If
  `purchase_value` is 0 for every ad, tell the user the sales may not be tracked and judge by
  CTR.
- **Winner:** clearly better than the other ads of the same product over the same dates (about
  20 % or more on the deciding metric), past the floor. A smaller gap is "empate", not a win.
  **Loser:** past the floor and clearly worse, or spending with no sales. Everything else is
  "seguir mirando". Say "ganador provisorio" when there are very few purchases.
- **Where the problem is** (do not blame the creative for everything): low CTR → the ad itself
  (hook, image, angle); good CTR but few sales → what comes after the click (price, listing,
  `ficha.md`, stock), not the creative. For videos with retention metrics: low thumbstop → the
  opening visual; good thumbstop but low hold → the seconds after the hook; fix one part.
- Compare like with like: very different dates, budgets or audiences make the table unfair; say
  it when that is the case.

## 5. Explain it

Short, plain, no jargon dump. A table of the pieces past the floor, best first: piece (title and
`adName`), type, angle, spend, impressions, CTR, purchases, ROAS or CPA, verdict (ganador /
perdedor / empate / seguir mirando / sin datos). Under it, 3 to 5 lines: what won and why it
may have (angle, format, hook), what lost, what has no data yet, and what did not match. Show
amounts in the account's currency. Never call a result "comprobado": it is what these dates
showed.

## 6. Next batch

Recommend, in this order, and let the user choose:

1. **Iterate the winner:** same angle with a new execution (new visual, new hook, another
   format: `marketing/hooks.md`, `marketing/formatos-meta.md`), as new concepts in
   `crear-creativos` or new ideas in `crear-video`. Keep a small slot for something new:
   winners tire.
2. **Retire the losers:** name the ads (with `adName`) that the user could pause. You do not
   pause them. Say what to avoid next time.
3. **Test one new dimension** (an untried angle, persona or format) with a hypothesis that can
   lose: the metric, the comparison and the expected direction.
4. **Wait** for the ads still under the floor, and say how many days or how much spend they need.

Offer to start the batch with `crear-creativos` or `crear-video` and pass the reading along; do
not start it yourself.

## 7. Save

When the user has seen the reading, save it to memory (`memoria.md`, section "When results are
read": what won and lost, the metric and numbers, dates, sample size, the user's decision). Do
not save readings below the floor as verdicts. There is no results file in the studio
(`workspace.md` defines none): the reading lives in the chat and in memory. Tell the user in
one line.
