# Meta formats for e-commerce creatives

Used by `crear-creativos` step 3 (concepts), next to `meta-ads.md` (diversity rule, sizes,
policy) and `claims-rules.md`. Adapted from the ad-creative skill of Corey Haines'
marketingskills (MIT; the format tiers there follow Dara Denney's ranking of Meta formats).
The studio's mechanics win on any conflict: images by `gpt_image_2_6`, 4:5 and 9:16, text
≤ 7 words per element, claims only from `ficha.md`. Tiers are a starting guess; the account's own
results (`adName` → `leer-resultados`) override them.

## The one question

Is the format a **scaler** (opens cold audiences and holds as spend grows) or a **support**
(converts people who already know the product)? A support format is not bad: it is bad only when
you expect it to open cold reach. Build a portfolio: a few scalers and a bench of supports.
When the user wants new reach, weight the batch to scalers; when the product already has traffic,
to supports.

## Format map (statics and carousels the studio can make)

Route: **plantilla** = image without text + a layout of `plantillas/creativo.html` (the layout
is named); **integrado** = the model draws the text, checked letter by letter.

| Format | Role | Route | Notes for this studio |
|---|---|---|---|
| Grid (several SKUs, bundle, colors) | Scaler | integrado | Only with real variants or a real bundle in `ficha.md`; one reference photo per SKU. First static to try when there is range. |
| Customer-photo style (person using it) | Scaler / support | integrado or `titular` | The actor is synthetic: never add a quote or a name as if a real buyer said it. |
| Headline statement | Support | `titular` | One specific line from the buyer's words; the line is the visual. |
| Callout / ingredient spotlight | Support | `beneficios` or integrado | 2–4 labels of what buyers ask about (`Objeciones`, questions), not the spec sheet. |
| FAQ card | Support | `titular` | The buyer's question as the title, the allowed answer as subtitle. Works fast on objections. |
| Problem / solution | Support | `titular` | Pain in the buyer's words, then the product. No wording that points at the reader (`meta-ads.md`, Policy). |
| With / without | Support | `comparativa` | Two columns "Sin" / "Con" about the same task. Compare with the usual way or the category, never a named competitor. |
| Educational frame (how it works, how to use) | Support | `beneficios` or carousel | Only mechanisms the listing documents. |
| Lifestyle hero | Support | `titular` or no text | Product in a real moment, 5–8 words of identity at most. |
| Mood board (apparel, home) | Support | integrado | The vibe is the product; one identity line. |
| Review quote | Support | `titular` | Real review, verbatim, permitted; see below. |
| Real guarantee or policy | Support | `titular` | Only if the guarantee is in the allowed list of `ficha.md`; terms stated as the listing states them. |

Carousels stay first-class here, even though the upstream tier list ranks them low (several
assets, uncertain payoff). They earn it when the product has several true things to show: sizes
or variants (grid by cards), how to use it in steps, one objection per card, a "con / sin" story.
Rules in `meta-ads.md`, Carousel. Template mode uses `tarjeta` for each card.

## What the studio leaves out of the upstream catalog

| Upstream format | Why it is out |
|---|---|
| Press mention, "as seen in" | Rights problem, and we do not invent coverage. |
| Competitor callout, "us vs. them" with a name | `claims-rules.md`: no named competitors. |
| Fake-native UI (notes app, iMessage, notification, system alert, tweet or Reddit screenshot) | Fake interface is on the policy list; the familiar UI also qualifies the wrong people. |
| Stat callout, numbered lists, signs checklists with numbers | Numbers come only from the listing; "N reasons" lists lost their punch. A number the listing states can go in a `titular`. |
| Apology letter, important update, ugly or post-it sale, price or discount cards | Price, discount and urgency are the ad's job, not the image's (`claims-rules.md`, `meta-ads.md`). The `oferta` layout is only for an offer the user dictates now and confirms; never urgency or scarcity. |
| Founder message / origin story | Strong scaler upstream, but needs the founder's real story and text longer than 7 words. If the user brings the real story, put it in the primary text with a plain image; never invent a founder or a story. |
| SaaS, B2B, UI-screenshot templates; avatars as "experts"; celebrity | Not e-commerce, or impossible to do honestly. |
| Partnership and authority ads | Need real creators or real experts: another process, not this skill. |

## Review quotes (the review-screenshot style)

Allowed only with a real review the buyer left, **verbatim**, taken from `ficha.md`
("Lenguaje del cliente", with source and date) or pasted by the user, that passes the forbidden
list (`claims-rules.md`, "Buyer quotes") and that the user confirms may be shown. Typeset the
quote on the layout: no stars you were not given, no platform logos, no avatars, no counts, no
imitation of a review screen. Credit it as "opinión de un comprador" or with the name the
source shows. If there is no such review, do not make this format.

## Hypothesis that can lose

Every concept carries a hypothesis a result can prove wrong. "Va a resonar" cannot lose.

> `<metric>` de este concepto `<mayor / menor>` que `<comparison>` en `<audience>`, porque `<motivation of the angle>`.

- **Metric:** one the studio can read for a static: `ctr_percent`, `cpc`, `cpm`, `roas`,
  `conversion_rate_percent`, or cost per purchase from `spend` / `purchases`. Prefer the one the
  objective needs (CTR for attention, ROAS or cost per purchase for sales).
- **Comparison:** a named control (the previous ad by `adName`) or a sibling concept of the same
  batch. Not "the average".
- **Direction:** up or down. Add a magnitude only when a baseline exists.
- **Motivation:** it follows from the angle, so a win or a loss says something about the buyer,
  not only about the picture. Example: "CTR de #3 (objeción: ¿entra en mi sommier?) mayor que #1
  (deseo) entre quienes ya miraron el producto, porque la duda frena el clic."

## Grounded inputs

Each concept cites where it comes from, in one line, in this order of preference:

1. A buyer question or a verbatim quote from `ficha.md` ("Lenguaje del cliente", "Objeciones").
2. A force from `ficha.md` ("Fuerzas": Empuje, Atracción, Hábito, Ansiedad) with its confidence
   (`alta`, `media`, `baja` or `hipótesis (proxy)`).
3. A sales or visits fact (`meli_get_sales_by_item`, `meli_get_item_visits`) or an allowed claim
   with its source.
4. **Apuesta**: no evidence behind it. Say so, say what would make it a fact, keep the bets a
   minority of the batch.

Copy takes the buyer's words, never a paraphrase into marketing talk. Language evidence (what
they say) is not claim evidence: a quote about comfort does not make "cómodo" an allowed claim.

## Andromeda notes

- **Similarity.** Meta groups ads it judges too alike and limits their delivery. Another color,
  font, crop, button or headline synonym is the same creative. New reach comes from new
  concepts; use close variants only to localize a proven winner.
- **Concept × angle × awareness.** A concept is one product truth (a thing the listing really
  says); the angle is the way of saying it (`meta-ads.md`); awareness is who it is said to. Read
  the batch as that matrix and fill different cells before adding rows. If two concepts share
  concept and angle, they are one.
- **The creative does the targeting.** A specific moment or identity in the picture and the
  words ("la que arma el escritorio en el living") qualifies the right viewer better than a
  generic benefit.
- **Do not look like an ad.** Organic-looking statics (a real setting, natural light, a plain
  frame) tend to hold up better than catalog gloss. Never reach for it with fake interface.
- **Volume is of concepts, not polish.** Prefer more distinct concepts at the batch size the
  user chose over more versions of one.

## Per-concept record (the table in step 3)

`#`, angle, awareness, persona, visual, type, text mode (and layout), **format and role**,
**hypothesis**, **evidence**, copy, `adName`, why it differs. Keep it in one table row; the
hypothesis and the evidence are one short line each.
