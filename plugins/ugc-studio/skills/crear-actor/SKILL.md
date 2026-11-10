---
name: crear-actor
description: Create a new virtual actor (a recurring synthetic person for UGC videos) by offering the user ready-made options for each trait, then generating the master portrait, an identity check from three angles and a character sheet, and registering the actor in the studio. Use when the user wants a new actor, model, persona or "modelo", or when crear-video finds no actor that fits a product.
---

# Create an actor

The user is usually not a programmer. Talk in Spanish (Rioplatense, warm, short). They
should never have to invent a description: **you recommend, they pick.**

Shared files are in `../../references/` from this skill's base directory:
`prompts/actor-portrait.md`, `prompts/actor-angles.md`, `prompts/actor-character-sheet.md`,
`db-schema.md`, `dashboard-sync.md`. Read `studio.json` first; if it is missing, run `setup`.

## 1. Start from the reason

If the actor is for a product or audience (for example "no hay ningún actor para un suplemento
de gimnasio para hombres"), say it in one line and use it to choose your recommendations. If not,
ask in one question what kind of products the actor will promote, with 3–4 options.

## 2. Offer choices, trait by trait

Use the question tool (`AskUserQuestion`) when it is available: up to 4 questions per round,
3–4 options each, your recommended option first with "(Recomendado)" in its label, and a short
description that explains why it fits. The user can always write another answer. If the tool is
not available, show numbered options in the chat and accept the number.

Round 1:
1. **Identidad** — gender, approximate age and origin/style (for example "Hombre, 30, argentino, deportista urbano").
2. **Rostro** — face shape and eyes, described in plain words.
3. **Piel** — tone and texture (freckles, beard shadow, etc.).
4. **Pelo** — length, color and style.

Round 2:
1. **Maquillaje o arreglo** — natural by default; for men, beard and grooming.
2. **Personalidad de creador** — how the person comes across (cálida, experta, divertida, directa…).
3. **Vestuario base** — simple, neutral, no logos; fitting the niche.
4. **Nombre** — 3–4 short, common names that fit the origin.

Keep options concrete and visual, avoid celebrity look-alikes, and keep everyone clearly adult.

## 3. Master portrait

1. Fill `prompts/actor-portrait.md` with the choices, translated to English.
2. Check the cost with `generate_image` and `get_cost: true` (3 candidates). Tell the user the
   credits and wait for their OK before generating.
3. Generate (`count: 3`) and download the candidates to `actores/<actorId>/candidatos/`
   (`candidato-1.png`…). Show them: if you can build a side-by-side image, save it as
   `candidatos/comparacion.jpg`; otherwise give the three file names. Then ask which one they
   prefer, with your recommendation first and why, plus an option to regenerate with a change.

## 4. Identity check and character sheet

With the chosen candidate's job id as the only reference:

1. Generate the angles sheet from `prompts/actor-angles.md`. If the three views are not clearly
   the same person, say so and offer to go back to another candidate.
2. Generate the character sheet from `prompts/actor-character-sheet.md`.

Tell the cost of both before generating (one confirmation for the two), then generate both in
parallel. Look at both results yourself before showing them: confirm the face, beard or hair
and outfit match the portrait in every view.

## 5. Register the actor

`actorId` = `<name-slug>-v1`. Never overwrite an existing actor id; a new version is `-v2`.

1. Download portrait, angles and character sheet to `actores/<actorId>/` (`retrato.png`,
   `angulos.png`, `character-sheet.png`).
2. Create a Higgsfield character Element from the portrait (`manage_reference_elements`,
   `action: create`, `category: character`, media `type: image_job`). It is used for images.
3. Propose the actor profile and confirm it with the user in one question: gender, apparent age,
   style, personality, niches where the actor fits and niches where not.
4. Write `actores/<actorId>/actor.json` with the profile, the three job ids, the Element id and
   the prompts used.
5. Upload a 540 px JPEG of the portrait to the dashboard and write the `actores/<actorId>` row
   (see `dashboard-sync.md` and `db-schema.md`). For video, the portrait and the character sheet
   job ids are what `crear-video` passes to Seedance 2.5 as `image_references` (Seedance 2.5 does
   not use Elements).

## 6. Close

Tell the user the actor is ready, show the portrait, the credits used, and suggest the next step
("¿Hacemos un video con <nombre>?").
