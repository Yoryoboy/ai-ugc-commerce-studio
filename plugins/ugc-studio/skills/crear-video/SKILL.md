---
name: crear-video
description: Create a UGC video for a product with one of the studio's virtual actors — load the product sheet and allowed claims, recommend an actor, propose three ideas with script and cost, let the user choose drafts or direct final, draw a storyboard frame per shot, generate with Seedance 2.5 on Higgsfield, review, finalize and save it in the studio so it shows in the gallery. Use when the user wants a video, ad, reel or UGC for a product.
---

# Create a UGC video

The user is usually not a programmer. Talk in Spanish (Rioplatense, warm, short). You
recommend, they pick. Never spend credits without telling them the exact cost first.

Shared files are in `${CLAUDE_PLUGIN_ROOT}/references/`: `claims-rules.md`, `costs.md`,
`prompts/ugc-video.md` and `workspace.md`, the contract for where every file goes. Save every
file exactly where it says: the gallery (`galeria.html`) shows the work from the folders and
updates by itself, so the user can follow along there. Read `studio.json` first; if it is
missing, run `setup`.

## 1. Product

If the product is not clear, ask which client (BI-MCP profile) and product, or offer to
recommend one with real sales data (`meli_get_sales_by_item`, or the platform's equivalent).

Load the product from its platform through BI-MCP (Mercado Libre: `meli_get_item_details` with
`includePictures: true` and `meli_get_item_description`; VTEX and Tiendanube: their product
tools). Then:

1. Check status and stock. If paused or without stock, warn before continuing (`claims-rules.md`).
2. Download the photos to `clientes/<profileId>/<productId>/fotos/` and look at them.
3. Write `clientes/<profileId>/<productId>/ficha.md`: title, price, key attributes, and the
   **allowed** and **forbidden** claims with their sources (`claims-rules.md`). Photo text counts
   as a source, but health or medical promises are always forbidden.
4. Write `clientes/<profileId>/<productId>/producto.json` if it does not exist (`workspace.md`),
   with the best photo as `cover`.

## 2. Actor

Read `actores/*/actor.json`. Recommend the best fit for the product and
its buyer, saying why in one line, using each actor's `fitsNiches` / `avoidNiches`. If none fits,
say so and offer to create one with the `crear-actor` skill.

## 3. Ideas → decision 1

Propose **3 ideas** with the question tool (`AskUserQuestion`; numbered options in chat if it is
not available), recommended first. Each idea has, in its description:

- the angle (problem → solution, before/after, discovery, tutorial…),
- the hook (first line),
- the full short script in Rioplatense Spanish (fits the duration: ~2.5 words per second),
- duration (15 s by default; 4–30 s possible),
- what changes between ideas: one dimension at a time (hook, angle or format).

Every product statement must be in the allowed list. Default duration 15 s unless the user asks.

Write lines the video model can pronounce: short everyday words, no uncommon conjugations or
technical terms when a simpler phrase says the same (the model mispronounced "se enroscan";
prefer phrasing like "las girás hasta que quedan firmes"). Do not add phonetic spellings to the
prompt: in a test, writing `"sommier" as so-MIÉR` made the model say "somotel" for a word it had
pronounced correctly before. If a word is risky, replace it ("la cama" instead of "el sommier").

Physical setups are hard for the model (a box that must NOT fit under a low bed came out fitting
twice). Show the problem with something the model handles reliably (a close-up of the tiny gap,
a hand that does not fit) rather than relying on an object being blocked.

## 4. Draft or direct → decision 2

Ask with real prices (`costs.md`, then confirm with `get_cost: true`):

- **Borrador 480p** (`draft: true`): ~1/5 of the price per attempt; finalizable to 1080p within
  7 days without regenerating. Recommended for new ideas and product handling.
- **Directo 1080p**: full price per attempt; for simple or proven ideas.

Explain the rule of thumb from `costs.md` in one line.

## 5. Storyboard → decision 3

Draw every shot as an image before generating the video, so the video model copies the staging
instead of improvising it. In a test (2026-11-10) three video attempts got the physical setup
wrong (a box that should not fit under a low bed fitted, legs upside down); the storyboard
version got every shot right on the first try. Ad Multiplier and `video_edit` did not fix it.

1. Upload product photos to Higgsfield if they are not there yet (`media_upload` → PUT →
   `media_confirm`; ≤ 3 photos, prefer clean product shots and one in use).
2. Choose the number of scenes. Recommend one per 3–5 seconds (4 for 15 s), or the default
   in `studio.json` (`storyboardScenes`) if set. Ask the user with the cost per scene (2.75): they
   can pick fewer (simple talking head) or more (several actions). If they say to always use a
   number, save it as `storyboardScenes` in `studio.json`. The script's shots follow this
   number: one shot per scene.
3. Write one image prompt per scene: the actor, the exact framing, the action frozen at its key
   moment, and the physical details that matter (what is on the floor, which way the product
   points, what fits where). Same room, light and wardrobe in every scene.
4. `generate_image_batch` with `gpt_image_2_6`, `aspect_ratio: 9:16`, quality high, 2k, and the
   actor portrait, character sheet and one product photo as references (2.75 per scene).
5. Create the video folder and its `video.json` with `status: storyboard`, the idea, hook,
   script, scene count and the credits spent so far. Save the frames as `escena-1.png` … and a
   side-by-side `storyboard.jpg`. Look at each one yourself; regenerate only the frame that is
   wrong.
6. Tell the user the storyboard is in the gallery (they can open `galeria.html` or ask you to) and
   ask: **Aprobar** (go to the video) or **Cambiar una escena** (say which; regenerate only that
   one and overwrite its `escena-N.png`).

## 6. Generate

1. Fill `prompts/ugc-video.md` with the actor, product, allowed claims and the chosen script,
   plus its storyboard section. Save it as `prompt-vN.md` in the video folder (N = the new
   version number).
2. `generate_video` with `seedance_2_5`, `mode: omni_reference`, `aspect_ratio: 9:16`,
   `generate_audio: true`, the duration, `draft` as chosen, and `medias`: frame 1 as
   `start_image`, then as `image_references` the actor portrait, character sheet, frames 2…n and
   one product photo. Higgsfield puts the start image first in the reference list, so number the
   references in the prompt counting it as image 1 (see the template).
3. Wait with `jobs_wait` until it finishes (a 15 s video takes about 2 minutes).
4. Download it as `borrador-vN.mp4`, make its thumbnail with
   `sh "${CLAUDE_PLUGIN_ROOT}/scripts/miniatura.sh" <video folder>/borrador-vN.mp4` (it writes
   `thumb-vN.jpg`), then update `video.json`: append the version (`n`, job id, Higgsfield URL,
   resolution, credits, short note, date), add its credits to the total, set `status` to `draft`
   (or `final` if it was direct 1080p) and `updatedAt`. Update `credits` in `studio.json` with
   the Higgsfield balance.

## 7. Review → decision 4

Look at frames yourself first (identity, product shape and color, hands, framing, visible phone).
Then tell the user what you saw, that it is in the gallery (every version stays there) and ask:

- **Aprobar** → if it was a draft, finalize it (`draft_job_id`, confirm the cost first), download
  it as `final.mp4`, and in `video.json` set `finalUrl`, add the cost and set `status: final`.
- **Pedir un cambio** → adjust only the part that failed, say the cost and generate again as the
  next version (`N + 1`) in the same video folder.
  - Staging or action wrong: fix that storyboard frame first, then regenerate the video.
  - Dialogue wrong: fix the line in the prompt and regenerate.
  - Do not use `mode: video_edit` or Ad Multiplier to fix a video. In tests (2026-11-10)
    `video_edit` returned a video the user found identical (53 credits) and Ad Multiplier on
    the hook gave no visible improvement (15 credits).
- **Descartar** → set `status: discarded` in `video.json`. Keep the files.

They judge the audio (voice, accent, lip-sync); you cannot hear it, so ask.

## 8. Close

Summarize: video, status, total credits for this video, and where to see it (the gallery, and
Higgsfield for the original files).
