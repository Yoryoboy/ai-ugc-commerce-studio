---
name: crear-creativos
description: Create Meta Ads creatives (anuncios, ads, creativos for Facebook and Instagram) for a product — statics in 4:5 and 9:16 and carousels, with several truly different concepts (variantes) so Meta does not group them, a brand kit per client, text drawn by the image model or laid over with a template, copy and ad names ready to upload, saved in the studio so they show in the gallery. Use when the user wants creativos, anuncios, ads, estáticas, carrusel, piezas o variantes para Meta, Facebook o Instagram.
---

# Create Meta Ads creatives

The user is usually not a programmer. Talk in Spanish (Rioplatense, warm, short). You
recommend, they pick. Never spend credits without telling them the exact cost first.

Shared files are in `${CLAUDE_PLUGIN_ROOT}/references/`: `workspace.md` (where every file goes),
`producto.md`, `meta-ads.md`, `claims-rules.md`, `costs.md`, `memoria.md` and `prompts/creativo-imagen.md`,
plus `marketing/formatos-meta.md`, `marketing/psicologia.md` and `marketing/copy.md`.
Save every file exactly where `workspace.md` says: the gallery shows the work from the folders
and updates by itself. Read `studio.json` first; if it is missing, run `setup`. We never upload
to Meta: another MCP does that.

**Memory.** Follow `memoria.md` at three moments: search it once the product is known, save
after every decision the user makes, and save the batch at the close. Skip it silently if Engram
is not available.

## 1. Product

Follow `references/producto.md` (client, product, status and stock, photos, `ficha.md` with the
allowed and forbidden claims, `producto.json`).

## 2. Brand kit

Look for `clientes/<profileId>/marca/marca.json`. If it exists, reuse it (tell the user in one
line) and go on. If the user brings new references for a client that already has a kit, update it
the same way as below: show what changes and write only after they confirm.

If there is no kit, build it from what the client already has defined, not from scratch:

1. **Client skill.** Many users keep each client's guidelines in a skill of their own. Look at
   the skills available in this session for one about this client (its name, store or
   `profileId` in the skill name or description). If there is one, say which and load it with
   the Skill tool. If there are several candidates, ask which one; if none, go on.
2. **Ask for every reference, in one message.** Anything helps, nothing is required: brand
   manual or guidelines (PDF, images), logos in every version they have (SVG, PNG, light and
   dark, icon), color codes, font names, text pasted from their Claude chats or artifacts (you
   cannot read those yourself: they paste it or attach the file), links to the site or Instagram.
3. **Save the originals.** Copy every file they give to `marca/referencias/` with its original
   name, and save pasted text as `marca/referencias/notas.md`. Copy the main logo to
   `marca/logo.<ext>` and the other versions to `marca/logo-<variant>.<ext>` (`blanco`,
   `negro`, `icono`…). Read the PDFs and look at the images.
4. **Extract the kit** (`workspace.md`, `marca.json`): map the brand palette to the four roles
   (`primary`, `accent`, `text`, `background`) and keep the rest in `palette`; fonts; `tone`;
   `audience`; brand rules in `dos` and `donts`; `voice` (3 to 5 attributes, each with `is` and
   `isNot`) and `avoidWords` (words and phrases the copy never uses), taken from the manual,
   the client skill or the pasted text, and proposed from `tone` and `donts` only when no source
   says it; the logo versions in `logos`; and every source in `sources`. If the brand font is not on Google Fonts, use the closest Google Font in
   `fonts` and write the real one in `fonts.brand`. When two sources disagree, ask.
5. **Fill the gaps** only for what no reference says: propose it from the product photos and the
   store (Google Fonts names, `google: true`), and mark it as proposed when you show it.
6. Show a short summary (colors with their hex, fonts, logo versions, tone, voice, words to
   avoid, rules, and what was
   proposed vs. taken from a source). When the user confirms, write `marca.json` and save the
   kit and the client's taste to memory (`memoria.md`). Do not ask again next time.

Use the kit in the rest of the batch: `tone`, `audience`, `voice`, `dos` and `donts` guide the copy
and the concepts, no copy uses a word of `avoidWords`, and the image prompts follow the colors and
rules. A kit made before `voice` and `avoidWords` existed still works: offer to add them when the
user next updates it, and do not block the batch.

## 3. Concepts → decision 1

Number of concepts: `creativeConcepts` in `studio.json`, or 8 if it is `null`. Say it and let
the user change it for this batch or save a new default (write it to `studio.json`).

Build the matrix following `meta-ads.md`: every pair of concepts differs in at least two of angle,
persona and visual, and no two share angle + visual. Meta groups near-identical creatives, so
variety of concept matters, not color tweaks. Check the rule yourself before showing it.

Read `marketing/formatos-meta.md` to choose each concept's format (scaler or support, and what
the studio can make), and `marketing/psicologia.md` when choosing angles. Ground each concept in
the buyer evidence of `ficha.md` (questions, quotes, objections, forces) or label it a bet; the
review-quote format needs a real, permitted review, never an invented one.

Show a table in chat. Per concept: #, angle, awareness, persona (actor or only product), visual,
type (static, or carousel with N cards), text mode (template with its layout, or integrated),
format and its role (scaler or support), the hypothesis (metric, comparison and expected
direction, as in `formatos-meta.md`), the evidence it comes from (or "apuesta"), the copy
(primary text ≤ 125, headline ≤ 40, description ≤ 30, CTA), `adName`, and why it differs.
Every piece of copy passes the gate of `marketing/copy.md` (its three questions, the `[NEED: …]`
mark instead of invented proof) and respects the kit's `voice` and `avoidWords`.
Choose an actor with the `actores/*/actor.json` niches when a concept uses a person. Every product
statement must be an allowed claim, and nothing may break the policy list in `meta-ads.md`.
The user approves, removes or edits concepts; nothing is generated before that. Save what was
chosen and rejected, and why (`memoria.md`).

## 4. Cost → decision 2

Count images: a static is 2 slots (4:5 and 9:16), a carousel is N cards; 2.75 each (`costs.md`).
Confirm the exact total with `get_cost: true`, show it with the breakdown and ask for the OK.

## 5. Generate

1. Upload the product photos to Higgsfield if they are not there yet (`media_upload` → PUT →
   `media_confirm`; 1–2 photos: one clean, one in use or detail).
2. Per concept create `clientes/<profileId>/<productId>/creativos/<creativoId>/` and its
   `creativo.json` with `status: draft` (`workspace.md`; `batch` shared by the whole batch).
3. Write each image prompt from `prompts/creativo-imagen.md` and save them as `prompt-vN.md`.
   State in the prompt which reference image is which.
4. Order of calls (`generate_image_batch`, `gpt_image_2_6`, high, 2k): statics 4:5 first, then
   the 9:16 with the 4:5 as an extra reference; carousels card 1 first, then the other cards with
   card 1 as reference. Actor concepts add the portrait and character sheet job ids.
   Independent images of different concepts can go in one batch.
5. Download the image: `<slot>-base-vN.png` (template mode) or `<slot>-vN.png` (integrated).
6. **Template mode:** copy `${CLAUDE_PLUGIN_ROOT}/references/plantillas/creativo.html` to
   `<slot>-diseno-vN.html`, edit only the JSON in `<script id="datos">` (fields in its top
   comment; `marca` = the content of `marca.json` as it is, with `logo` as the path
   `../../../marca/<logo from marca.json>`), then run
   `sh "${CLAUDE_PLUGIN_ROOT}/scripts/componer.sh" <folder>/<slot>-diseno-vN.html`. It prints the
   PNG path (`<slot>-vN.png`). Exit 1: read the message (missing image or logo, broken JSON, no
   Chrome: tell the user to install Google Chrome); fix and run again. After exit 1 the previous
   PNG of that slot stays as it was: never report it as the new render. Exit 3: the PNG exists but
   the text does not fit; shorten it and render again.
7. **Integrated mode:** read the image and compare the text letter by letter with the quoted text
   (accents, ñ, prices). If it differs, regenerate that slot (never ship it) and say the extra 2.75.
8. Update `creativo.json` (version with its slots, job ids, credits, note, date; total `credits`;
   `updatedAt`) and `credits` in `studio.json` with the Higgsfield balance.

## 6. Self QA

Look at every piece before the user does. Check:

- Product: same shape, color and label as the photos.
- Actor: same identity as the portrait; hands with five fingers, natural grip.
- Text exact and readable; nothing in the safe zones (9:16: top 14 %, bottom 35 %).
- Claims are in `ficha.md`'s allowed list; nothing in the Meta policy list.
- Copy and image text have none of the AI-tell patterns of `marketing/copy.md` (contrast
  reveals, negation lists, self-answered questions, stock phrases), vary their shapes across the
  batch, use no word of `avoidWords` and no `[NEED: …]` left over.
- Different from its siblings (not near-identical to another concept); carousel cards look like
  one family and each makes sense alone.

Fix what fails (template text: free; images: 2.75 each, tell the user) before showing it. Say
honestly what you could not fix.

## 7. Review → decision 3

Tell the user the batch is in the gallery (Creativos) and what you saw. Per creative ask:

- **Aprobar** → `status: approved`.
- **Pedir un cambio** → change only what failed, as version `N + 1` with just the slots that
  change (new `prompt-vN.md`). Template text change: no new image, edit a new
  `<slot>-diseno-v(N+1).html`, render, 0 credits. Image change: say the cost first. Carousel: one
  card at a time; keep the same family.
- **Descartar** → `status: discarded`. Keep the files.

Update `creativo.json` and `credits` in `studio.json` after every change, and save each verdict
with what failed and what fixed it (`memoria.md`).

## 8. Close

For each approved creative list, ready for the MCP that uploads to Meta: the files in order (4:5
and 9:16, or cards 1…N), the `adName` and the copy (primary text, headline, description, CTA).
Save the batch summary to memory (`memoria.md`). Add total credits of the batch and where to see everything (the gallery: open it following `workspace.md`, "Open the gallery"). Do not upload anything.
