# Studio workspace contract

The studio folder is the only source of truth. The gallery (`galeria.html`) shows whatever is in
it, so every file must be saved in the place and with the name this contract gives. Never invent
another layout: a file in the wrong place does not appear in the gallery. The gallery is served by a
small local server (see "Gallery server, archive and trash"); `galeria.html` only works through it.

## Layout

```txt
<studio>/
├── studio.json                     studio settings (see below)
├── galeria.html                    copied by the plugin hook; never edit (opened as a file it only
│                                   says to ask Claude to open the gallery)
├── .galeria/                       gallery server state; never edit (see Gallery server)
├── .papelera/                      the gallery's trash: restorable deleted items (see Trash)
├── exportaciones/                  packages made by `transferir` (see Packages)
├── importaciones/                  packages dropped here to import; optional
├── actores/
│   └── <actorId>/
│       ├── actor.json
│       ├── retrato.png             master portrait
│       ├── angulos.png             identity check, three angles
│       ├── character-sheet.png
│       ├── prompt-retrato.txt      optional
│       └── candidatos/             portrait candidates (candidato-N.png, comparacion.jpg)
└── clientes/
    └── <profileId>/
        ├── marca/                  brand kit of the client, for creatives
        │   ├── marca.json
        │   ├── logo.png            optional (.png, .jpg, .webp or .svg)
        │   ├── logo-<variant>.svg  optional other versions (blanco, negro, icono…)
        │   └── referencias/        originals the user gave: manual, PDFs, images, notas.md
        └── <productId>/
            ├── producto.json
            ├── ficha.md            product sheet: claims, customer language, objections, forces
            ├── fotos/              product photos, original names
            ├── creativos/          Meta Ads creatives (see creativo.json)
            │   └── <creativoId>/
            │       ├── creativo.json
            │       ├── prompt-vN.md            image prompts of version N
            │       ├── <slot>-base-vN.png      image from the model (template mode: no text)
            │       ├── <slot>-diseno-vN.html   filled template (template mode only)
            │       └── <slot>-vN.png           finished piece of version N
            └── videos/
                └── <videoId>/
                    ├── video.json
                    ├── escena-N.png       storyboard frame N (1, 2, 3…)
                    ├── storyboard.jpg     optional side-by-side of the frames
                    ├── prompt-vN.md       prompt of version N
                    ├── borrador-vN.mp4    video of version N (draft or direct)
                    ├── thumb-vN.jpg       thumbnail of version N
                    └── final.mp4          finalized 1080p video, when there is one
```

Rules:

- `actorId` and `videoId` use lowercase letters, digits and `-` only: `actorId` =
  `<name-slug>-v<n>` (`luna-v1`), `videoId` = `<yyyy-mm-dd>-<product-slug>-<idea-slug>`.
  `profileId` is the BI-MCP profile id and `productId` the id on its platform, both exactly as
  given (`MLA1234567890` keeps its uppercase letters). No folder name has spaces.
- `creativoId` = `<yyyy-mm-dd>-<product-slug>-<concept-slug>`, same characters as `videoId`.
  `marca` is a reserved name inside a client folder: never use it as a `productId`.
- Versions start at 1 and never overwrite each other. A new attempt is a new `N` with its own
  `prompt-vN.md`, `borrador-vN.mp4` and `thumb-vN.jpg`.
- Storyboard frames are overwritten when a scene is redrawn: they always show the current
  storyboard.
- Every video version gets a thumbnail (`scripts/miniatura.sh`).
- Write JSON as UTF-8, valid JSON (no comments, no trailing commas). The hook reports a broken
  file; fix it right away.
- Dates are ISO 8601 in UTC. Credits are Higgsfield credits as numbers.

## studio.json

```json
{
  "connectors": { "higgsfield": "Higgsfield", "bimcp": "bi-mcp" },
  "storyboardScenes": null,
  "creativeConcepts": null,
  "credits": { "available": 933.5, "checkedAt": "2026-11-11T13:00:00Z" },
  "createdAt": "2026-11-11T12:00:00Z"
}
```

- `storyboardScenes`: fixed number of storyboard scenes per video, or `null` to ask each time.
- `creativeConcepts`: default number of concepts per creative batch (the skill uses 8 when it is
  `null`). The user can change it for one batch or save a new default here.
- `credits`: update it whenever you read the Higgsfield balance, so the gallery shows it.

## actor.json

```json
{
  "id": "martin-v1",
  "name": "Martín",
  "version": "v1",
  "gender": "Hombre",
  "apparentAge": 38,
  "style": "Práctico, barba corta, buzo liso",
  "personality": "Práctico y con humor, cercano, directo",
  "fitsNiches": ["Hogar", "DIY"],
  "avoidNiches": ["Cosmética"],
  "createdFor": { "profileId": "acme", "productId": "MLA1234567890" },
  "higgsfield": {
    "elementId": "…",
    "portraitJobId": "…",
    "anglesJobId": "…",
    "characterSheetJobId": "…"
  },
  "credits": 13.75,
  "createdAt": "2026-11-10T14:20:00Z"
}
```

`createdFor` is optional. `crear-video` passes the portrait and character sheet job ids to
Seedance 2.5 as `image_references`; the Element is only for images.

## producto.json

```json
{
  "profileId": "acme",
  "clientName": "Acme",
  "platform": "mercadolibre",
  "productId": "MLA1234567890",
  "title": "Set de 4 patas de madera para cama",
  "price": 63529.41,
  "currency": "ARS",
  "status": "active",
  "url": "https://articulo.mercadolibre.com.ar/…",
  "cover": "fotos/foto-1.jpg",
  "createdAt": "2026-11-10T14:00:00Z"
}
```

`platform` is `mercadolibre`, `vtex` or `tiendanube`. `cover` is the photo the gallery shows,
relative to the product folder.

## video.json

```json
{
  "id": "2026-11-10-patas-cama-problema-solucion",
  "title": "La cama pegada al piso",
  "actorId": "martin-v1",
  "status": "draft",
  "angle": "Problema → solución",
  "hook": "¿Ustedes también tienen la cama pegada al piso?",
  "script": "…",
  "durationSec": 15,
  "scenes": 4,
  "credits": 56,
  "versions": [
    {
      "n": 1,
      "jobId": "…",
      "url": "https://higgsfield.ai/…",
      "resolution": "480p",
      "credits": 45,
      "note": "Primer borrador desde el storyboard",
      "createdAt": "2026-11-10T18:00:00Z"
    }
  ],
  "finalUrl": null,
  "createdAt": "2026-11-10T17:40:00Z",
  "updatedAt": "2026-11-10T18:05:00Z"
}
```

- `status`: `storyboard` (frames waiting for approval), `draft` (a version waiting for review),
  `final` (approved and finalized), `discarded`.
- `credits` is the total of the video: storyboard frames plus every version and the finalization
  (in the example, 4 frames × 2.75 = 11 plus the 45 of version 1). A version's `credits` is only
  its video generation.
- The last entry in `versions` is the current one. Its files are `borrador-vN.mp4` and
  `thumb-vN.jpg`.
- When finalized: download `final.mp4`, set `finalUrl`, add the cost to `credits` and set
  `status` to `final`.

The client and product come from the folder path, so `video.json` does not repeat them.

## ficha.md

Free-form Markdown the skills read; the gallery ignores it. Besides title, price, attributes and
the allowed and forbidden claims (`claims-rules.md`), it holds the customer evidence
(`producto.md` step 2.3):

- `## Lenguaje del cliente`: verbatim quotes, each with source (`pregunta ML`, `reseña ML`…),
  date and confidence. It is evidence of how buyers talk, never a claim.
- `## Objeciones`: what makes buyers hesitate, with confidence and sources.
- `## Fuerzas`: `Empuje` (what pushes them from what they use now), `Atracción` (what pulls them to
  this product), `Hábito` (what keeps them where they are), `Ansiedad` (what worries them about
  buying), each with confidence and sources.
- Confidence is `alta` (3+ independent sources, recent), `media` or `baja`. With no evidence the
  items are `hipótesis (proxy)`, marked as such, never invented quotes.
- Add `Evidencia actualizada: AAAA-MM-DD` to the section; evidence older than ~30 days is refreshed
  when the user asks.

Old sheets without these sections stay valid.

## marca.json

One brand kit per client, in `clientes/<profileId>/marca/`. Creatives in template mode take their
colors, fonts and logo from it.

```json
{
  "name": "Acme",
  "colors": {
    "primary": "#0c6b62",
    "accent": "#f3c623",
    "text": "#142024",
    "background": "#ffffff"
  },
  "palette": [{ "name": "Arena", "hex": "#e8dcc4" }],
  "fonts": { "heading": "Montserrat", "body": "Inter", "google": true, "brand": "Gotham" },
  "logo": "logo.png",
  "logos": [
    { "file": "logo.png", "use": "main, on light backgrounds" },
    { "file": "logo-blanco.svg", "use": "on dark backgrounds or photos" }
  ],
  "tone": "Cercano y directo, sin exagerar",
  "audience": "Mujeres de 30 a 50 que cuidan su descanso",
  "dos": ["Hablar de vos", "Mostrar el producto en uso"],
  "donts": ["Nunca el logo sobre rojo", "No usar la palabra barato"],
  "voice": [
    { "attribute": "Cercana", "is": "Habla de vos, como una amiga", "isNot": "Informal al punto de la chabacanería" },
    { "attribute": "Concreta", "is": "Dice qué hace el producto", "isNot": "Promesas vagas o exageradas" }
  ],
  "avoidWords": ["barato", "oferta imperdible"],
  "sources": [
    { "type": "skill", "name": "acme-marca" },
    { "type": "file", "path": "referencias/manual-de-marca.pdf" },
    { "type": "url", "url": "https://acme.com.ar" }
  ],
  "createdAt": "2026-11-16T12:00:00Z"
}
```

- Colors are `#rrggbb`. `primary` fills buttons and badges, `accent` highlights, `text` and
  `background` are for panels.
- `fonts.google: true` loads both fonts from Google Fonts when the template is rendered (needs
  internet); otherwise they must be installed on the computer. If a font fails, the template falls
  back to the system font.
- `logo` is a file name inside `marca/`, or `null`. It is the one the template and the gallery use.
- Optional, read by the skills and ignored by the template and the gallery: `palette` (brand
  colors beyond the four roles), `fonts.brand` (the real brand font when it is not on Google
  Fonts; `heading`/`body` hold the closest Google Font), `logos` (every logo version with its use;
  files inside `marca/`), `audience`, `dos` and `donts` (brand rules for copy and images),
  `voice` (3 to 5 attributes, each `attribute` with `is` and `isNot`: what it means and what it
  does not), `avoidWords` (array of words and phrases the copy never uses) and
  `sources` (where the kit came from: a client skill by `name`, a file in `referencias/` by
  `path`, a `url`, or `"type": "proposed"` for what was proposed with no source).
- `referencias/` keeps the originals the user gave, with their original names; pasted text goes
  to `referencias/notas.md`. Nothing reads it automatically: it is there to rebuild or update
  the kit.

## creativo.json

One concept of a batch of Meta Ads creatives. A batch is all the concepts made together for a
product; they share `batch`.

```json
{
  "id": "2026-11-16-patas-cama-dolor-espalda",
  "batch": "2026-11-16-patas-cama",
  "title": "Agacharse ya no duele",
  "type": "static",
  "status": "draft",
  "concept": {
    "angle": "Dolor",
    "awareness": "Consciente del problema",
    "visual": "Persona usando el producto",
    "why": "Le habla a quien sufre la cama baja; ninguno de los otros conceptos usa el dolor"
  },
  "actorId": "martin-v1",
  "textMode": "template",
  "layout": "titular",
  "slots": ["4x5", "9x16"],
  "copy": {
    "primaryText": "Subí la cama 10 cm y olvidate de agacharte para tender.",
    "headline": "Patas de madera para cama",
    "description": "Envío gratis",
    "cta": "Comprar"
  },
  "adName": "MLA1234567890_dolor_martin_estatica",
  "credits": 5.5,
  "versions": [
    {
      "n": 1,
      "slots": ["4x5", "9x16"],
      "jobIds": ["…", "…"],
      "credits": 5.5,
      "note": "Primera versión",
      "createdAt": "2026-11-16T12:30:00Z"
    }
  ],
  "createdAt": "2026-11-16T12:20:00Z",
  "updatedAt": "2026-11-16T12:30:00Z"
}
```

- `type`: `static` (slots `4x5` and/or `9x16`) or `carousel` (slots `tarjeta-1` … `tarjeta-N`,
  all 4:5, 2 to 10 cards).
- `status`: `draft` (waiting for review), `approved`, `discarded`.
- `textMode`: `integrated` (the image model writes the text; `<slot>-vN.png` is its image) or
  `template` (the model image has no text; `<slot>-base-vN.png` is the image, the filled template
  is `<slot>-diseno-vN.html` and `scripts/componer.sh` renders it to `<slot>-vN.png`). `layout`
  is the template layout, `null` in integrated mode.
- `actorId` is the actor that appears, or `null` (product only).
- `copy` is the ad text for Meta: `primaryText` (above the image), `headline` (below it),
  `description` (optional) and `cta` (the button). Every product statement in it must be an
  allowed claim.
- `adName` is the name to give the ad in Meta, so its results can be traced back to the concept:
  `<productId>_<angle>_<actor or producto>_<estatica|carrusel>`, lowercase except the
  `productId`, `_` between parts, no spaces.
- A version is one generation round. It lists only the slots it made: changing one card of a
  carousel makes version `N + 1` with just that slot. The current piece of a slot is its file with
  the highest `N`. `credits` is the total of the creative.

## Open the gallery

The one rule every skill follows to show the gallery to the user (the skills point here, never
copy it):

1. `sh "${CLAUDE_PLUGIN_ROOT}/scripts/galeria.sh" start` (starts the server or reuses the running
   one).
2. In the Claude desktop app (the `preview_start` tool exists): `preview_start` with name
   `galeria`. It opens in the app's browser pane, next to the chat.
3. Otherwise, or if `preview_start` fails: `sh "${CLAUDE_PLUGIN_ROOT}/scripts/galeria.sh" open`,
   which opens it in the system browser.

The user can also ask "abrí la galería" at any time. If the gallery does not start, give the user
the exact error; do not go on as if it opened.

## Gallery server, archive and trash

The gallery is a local server, not a file: `sh "${CLAUDE_PLUGIN_ROOT}/scripts/galeria.sh" open`
starts it if needed and opens it in the browser (`start`, `stop`, `status` and `url` also exist).
The session start hook starts it by itself (or reuses the one already running). One server serves
every session open on the studio, so closing a session does not stop it: it stops by itself after
30 minutes without requests (`UGC_GALERIA_IDLE_MIN`). An open gallery page keeps it alive, since it
polls the server. After it stopped, the next session start or file write starts it again, on the
same port when it is still free (see `.galeria/puerto`). It
needs Node 18 or newer (`references/dependencias.md`), listens on `127.0.0.1` only and indexes the
folders in memory, so nothing has to be rebuilt after saving a file. Double-clicking `galeria.html`
only shows a notice. A server of an older plugin version (or of the same version from another
plugin folder) is stopped and replaced the next time the hook or `galeria.sh` starts it; a server
of a newer plugin version is kept and used as it is, so two sessions with different plugin versions
do not keep replacing each other's server. The server listens before it has indexed the
studio: until then (a moment, longer in a huge studio) its data answers are `503` with
`Retry-After`, and `/api/salud` says `"listo": false`.

- `.galeria/servidor.json`: `{pid, port, startedAt, version, plugin}`, written by the server
  (mode 600; `plugin` is the plugin folder it runs from). There is no access token: the address
  `http://127.0.0.1:<port>/` opens directly in the browser, and `galeria.sh start`, `status`, `url`
  and the hook summary print it. `galeria.sh open` opens that address with the system's `open` /
  `xdg-open`; to show the gallery follow "Open the gallery" above. What protects the
  server is that it listens on `127.0.0.1` only and checks every request: the `Host` header must be
  `127.0.0.1:<port>` or `localhost:<port>` (DNS rebinding); a request the browser marks
  `Sec-Fetch-Site: cross-site` or `same-site` is refused with `403`, except a link followed to `/`
  itself (a top-level navigation), so a page of another site cannot read or change anything; and a
  mutation (`POST`) must come from the gallery's own `Origin` and be `application/json`. `/?t=…`
  (an old bookmark) redirects to `/`. `GET /api/salud` answers `{ok, version, pid, listo, studio,
  entities, scanMs}`. Trade-off: with no token, any other OS user of the same machine can reach the
  gallery on that port.
- `.galeria/puerto`: the last port the server used. It outlives the server: on start the server
  tries that port first (when it is inside 4317 … 4337) and only then the range from 4317, so the
  gallery keeps its address across restarts (after the idle stop) unless another
  program took the port meanwhile. Only one server runs per studio: every session reuses it through
  `servidor.json` and `.galeria/arranque.lock`.
- `.claude/launch.json`: on every start the server points its `galeria` configuration at the port
  it got (`{name: "galeria", port, url}`, a url and no command: it attaches to the running server,
  never starts one). Other configurations are kept; a file that is not valid JSON is left as it is
  (logged in `.galeria/servidor.log`). In the Claude desktop app, `preview_start` with name
  `galeria` opens the gallery in the browser pane. Never write this entry by hand.
- `.galeria/miniaturas/<sha1>.jpg`: thumbnail cache. It can be deleted at any time; it is rebuilt.
- `.galeria/validado`, `.galeria/rotos.txt`: state of the hook that validates the `.json` files.
- `archived` and `archivedAt`: any `actor.json`, `producto.json`, `marca.json`, `video.json` or
  `creativo.json` may carry `"archived": true` and `"archivedAt": "<ISO date>"`. The gallery hides
  archived items by default; removing both fields shows the item again. Never remove them
  yourself unless the user asks to unarchive.
- `.papelera/<yyyy-mm-ddTHHMMSSZ>-<rand>/<original path>`: what the user deletes from the gallery.
  An item folder (or one file) is moved there keeping its path, with a `papelera.json` next to it:
  `{"id": "…", "originalPath": "clientes/acme/MLA1/creativos/2026-11-16-x-y", "trashedAt": "2026-11-17T10:00:00Z", "kind": "folder"}`
  (`kind` is `folder` or `file`). Anything inside is not in the gallery. Restoring puts it back
  and fails if something already exists at the original path; emptying the trash deletes for good.
  Never write there or delete user work with `rm`: the gallery moves it to the trash. The gallery's
  Papelera view empties it for good (everything, or what is older than 30 days) after asking, and
  its tab shows how many entries it holds. Emptying deletes only what the confirmation listed:
  `POST /api/papelera/vaciar {ids: [<trash entry id>, …]}` deletes exactly those entries that still
  exist (an id is one entry folder name, `<yyyy-mm-ddTHHMMSSZ>-<rand>`; anything else is rejected)
  and answers `{eliminados, ids, invalidos, noEncontrados, fallidos}`: what was trashed after the
  list was drawn survives, and unknown or invalid ids are reported, not fatal. `ids: []` deletes
  nothing. Without `ids` it deletes everything, or what is before `antesDe`; with both, only the ids
  that are also before `antesDe`.
- Cleaning old versions: the action `limpiarVersiones` (gallery: "Limpiar versiones viejas" in the
  detail view and in multi-select, after a dry run that counts the files) moves the files of
  non-current versions of a creative or video to the trash, one ordinary trash entry per file
  (`kind: "file"`), so each one restores like any other file. A video keeps the last version's
  `borrador-vN.mp4` and `thumb-vN.jpg` (never fewer than its newest files on disk), `final.mp4`,
  prompts, scenes and `storyboard.jpg`. A creative keeps, per slot, the files of the highest `N`
  of its finished piece `<slot>-vN.png` (the `-base-` and `-diseno-` files of that `N` or newer too)
  and every `prompt-vN.md`; if a slot has no finished piece yet it keeps its highest `N` of any
  kind. The JSON files are never touched. The dry run is
  `GET /api/versiones-antiguas?ruta=<item path>` → `{ruta, total, files}`; the action is
  `POST /api/acciones {acciones: [{tipo: "limpiarVersiones", ruta}]}` → `{ruta, ok, movidos, ids}`.
  If a file cannot be moved the result is `ok: false` with `error` and the partial `movidos` / `ids`
  (restore them with `restaurar` if needed); an unexpected fs error stops the run there and still
  reports what already moved. In the gallery, a dry run that failed for an item (not the same as
  0 files) is named in the dialog or message with a hint to retry; "No hay versiones viejas para
  limpiar." only appears when every dry run answered 0.
- Reopening: the gallery's "Reabrir" sets `status` of a discarded creative or video back to
  `draft` (the `estado` action).
- What the gallery reads from the server, besides the JSON files: `/api/elementos` items carry
  `productTitle`, `clientName`, `type` (`static` or `carousel`, creatives only) and `pieces` (slots
  of a creative that have a current file); `lote=<batch>` filters creatives by `batch`;
  `/api/estudio` carries `creditsUsed` (the sum of `credits` of actors, videos and creatives, archived
  ones included) and `trashCount`.

## Packages

`transferir` moves work between computers as a `.zip` made by `scripts/exportar.sh` and read by
`scripts/importar.sh`. Inside, the files keep their studio paths (`actores/…`, `clientes/…`),
plus a `manifest.json` at the root:

```json
{
  "format": "ugc-studio-package",
  "formatVersion": 1,
  "plugin": "0.3.0",
  "mode": "light",
  "exportedAt": "2026-11-11T13:00:00Z",
  "actors": ["martin-v1"],
  "products": ["clientes/acme/MLA1234567890"],
  "videos": ["clientes/acme/MLA1234567890/videos/2026-11-10-patas-cama-problema-solucion"],
  "brands": ["clientes/acme/marca"],
  "omitted": ["clientes/acme/MLA1234567890/videos/2026-11-10-patas-cama-problema-solucion/borrador-v1.mp4"]
}
```

- A video brings its product (everything in the product folder except `videos/`) and its actor;
  a product or a client brings its videos. Anything of a client (the client, a product or a
  video) brings the client's brand kit, the whole `marca/` folder with its logos and
  `referencias/`, because its creatives use the kit's logo. `studio.json` never travels.
- `mode` is `light` (default: no `borrador-vN.mp4`, no `candidatos/`; the drafts are listed in
  `omitted` and stay reachable through the `jobId` of their version) or `complete`.
- Packages are named `exportaciones/<yyyy-mm-dd>-<name>.zip` and never overwritten.
- Importing never replaces a file. An element already in the studio with other content is a
  conflict: it is skipped (`--omitir`) or imported under a new id (`--renombrar`, actors and
  videos only: a product keeps the id of its platform and a brand kit belongs to its client, so
  both only take `--omitir`). Renaming an actor updates `id` and `version` in its `actor.json` and
  `actorId` in the videos imported with it; renaming a video updates its `id`.
- Both computers must use the same Higgsfield account: the ids and links in the `.json` files
  belong to it.
- Creatives travel inside their product folder. The actors that appear only in creatives do not
  travel yet: copy them by hand if needed.
