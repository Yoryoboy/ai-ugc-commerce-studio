---
name: transferir
description: Move studio work between computers — export actors, products, videos, a whole client or the whole studio to a .zip package, and import a package from another computer, warning about collisions and proposing a fix. Use when the user wants to export, import, share, send, pass, copy or move actors, videos, images, products, clients or the studio to or from another computer or person, or drops a UGC Studio .zip in the chat.
---

# Move work between computers

The user is usually not a programmer. Talk in Spanish (Rioplatense, warm, short). Never show
them commands, JSON or option names; show them what goes or comes, in words.

The package is a `.zip` with the elements, the files they need and a `manifest.json`
(`${CLAUDE_PLUGIN_ROOT}/references/workspace.md`, "Packages"). Two scripts do the work, from the
studio folder:

- `sh "${CLAUDE_PLUGIN_ROOT}/scripts/exportar.sh" [--plan] [--completo] [--nombre <name>] <element>...`
- `sh "${CLAUDE_PLUGIN_ROOT}/scripts/importar.sh" [--aplicar] [--omitir <path>]... [--renombrar <path>=<new-id>]... <package.zip>`

Read `studio.json` first; if it is missing, run `setup`.

**Same Higgsfield account.** Actors and videos point to Higgsfield jobs (`elementId`, job ids,
version links) that only the account that made them can use. Say it every time, on export and on
import: "Ojo: quien lo importe tiene que usar la **misma cuenta de Higgsfield**. Si no, los
actores no van a servir para videos nuevos y los links pueden no abrir."

## Export

1. **What.** Turn the request into elements, reading the folders and the `.json` files:

   | The user says | Element |
   |---|---|
   | "exportá a Martín" | `actores/martin-v1` |
   | "exportá el video de las patas" | `clientes/<profileId>/<productId>/videos/<videoId>` |
   | "exportá las patas de sommier" (a product, with its videos) | `clientes/<profileId>/<productId>` |
   | "exportá el cliente Acme" | `clientes/<profileId>` |
   | "exportá todo el studio" | `todo` |

   Several at once is fine. If two match (two videos of the same product), ask which, showing
   their titles. A video always brings its product and its actor; a product or a client brings
   its videos.
2. **Plan.** Run `exportar.sh --plan <elements>` and tell the user what goes, in words: actors by
   name, products by title, videos by title. Offer the mode with both sizes from the plan:
   - **Liviano** (default): images, `.json`, product photos and final videos. Drafts stay as a
     link to Higgsfield and can be downloaded again on the other computer.
   - **Completo** (`--completo`): also every draft and the portrait candidates.

   Add the Higgsfield account warning. If the plan lists actors not in this studio, say that those
   videos go without their actor. Wait for the user to confirm.
3. **Create.** Run it without `--plan`, with `--nombre <name>`: a short slug of what goes
   (`video-patas-cama`, `actor-martin`, `cliente-acme`, `studio`). It prints `Package: <path>` and
   its size.
4. **Hand over.** Reveal it in Finder with `open -R "<path>"` and tell the user exactly where it
   is and how to send it:

   > Listo: `~/UGC Studio/exportaciones/2026-11-11-video-patas-cama.zip` (15 MB).
   > Te abrí la carpeta en Finder. Mandalo por AirDrop, WhatsApp o Drive.

   Show the path from the user's home (`~/…`). Packages stay in `exportaciones/`; they are never
   overwritten (a second one the same day gets `-2`).

## Import

1. **Which package.**
   - The user attached or dragged a `.zip` into the chat: use that file.
   - "importá lo que dejé" or just "importá": look in `importaciones/` in the studio, then in
     `~/Downloads`. Propose the most recent `.zip` by name and date and wait for a yes. If there is
     none, tell them to drop it in the studio's `importaciones/` folder (create it) or drag it into
     the chat.
2. **Preview, without touching anything.** Run `importar.sh <package>`. Each line is
   `<state> <kind> <path>`:
   - `new`: not in the studio; it comes in.
   - `same`: already there, identical ("ya lo tenés"); it is skipped. Not a conflict.
   - `adds`: already there, and the package only brings files that are missing (for example the
     drafts of a complete package over a light one). Nothing is replaced.
   - `conflict`: there is a different one with the same id. Never replace it.

   Read the `.json` files in the package if you need names or titles (`unzip -p <package>
   <path>/actor.json`). Tell the user what comes, in words, plus the Higgsfield account warning.
3. **Conflicts: warn and propose.** For each conflict, explain it and give the proposal from the
   preview:
   - Actor: "Ya tenés un actor `martin-v1` distinto. Te propongo importarlo como `martin-v2` y
     actualizar el video para que lo use. ¿Va?" (`--renombrar actores/martin-v1=martin-v2`). If
     it is clearly the same person (same name and portrait, only the credits or a note changed),
     propose using theirs instead (`--omitir`).
   - Video: import it as `<videoId>-2` (`--renombrar`), or skip it (`--omitir`).
   - Product: products keep their platform id, so propose keeping theirs (`--omitir`); the
     package's videos still come in under it.

   Wait for the user's answer on every conflict. Never decide one for them.
4. **Import.** Run `importar.sh --aplicar` with one `--omitir` or `--renombrar` per conflict. It
   refuses if a conflict has no decision, or if anything would be replaced, and writes nothing. A
   package that holds files outside `actores/` and `clientes/`, symbolic links or broken JSON is
   refused: tell the user it is not a valid UGC Studio package and ask who sent it.
5. **Close.** Run `sh "${CLAUDE_PLUGIN_ROOT}/scripts/sincronizar.sh" --resumen` and tell the user
   what came in and that it is already in the gallery (it refreshes by itself).
   - `Drafts left out:` lists drafts that stayed in Higgsfield. Offer to download them: "3
     borradores quedaron como link a Higgsfield; si querés, los bajo ahora." To download one, find
     its version in `video.json` (`n` = the number in `borrador-vN.mp4`), get the video with the
     Higgsfield connector from its `jobId` (`jobs_wait` returns the finished job and its media),
     save it as `borrador-vN.mp4` and make its thumbnail with
     `sh "${CLAUDE_PLUGIN_ROOT}/scripts/miniatura.sh" <file>` if `thumb-vN.jpg` is missing. If
     Higgsfield does not return it (other account, deleted or expired), say so; the version keeps
     its link.
   - `Videos whose actor is not in this studio:` say which videos show without an actor and that
     they can import that actor too.
6. Leave the package where it was; the user decides whether to delete it.
