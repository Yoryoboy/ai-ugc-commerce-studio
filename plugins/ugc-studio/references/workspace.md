# Studio workspace contract

The studio folder is the only source of truth. The gallery (`galeria.html`) shows whatever is in
it, so every file must be saved in the place and with the name this contract gives. Never invent
another layout: a file in the wrong place does not appear in the gallery.

## Layout

```txt
<studio>/
├── studio.json                     studio settings (see below)
├── galeria.html                    copied by the plugin hook; never edit
├── .galeria/datos.js               index rebuilt by the plugin hook; never edit
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
        │   └── logo.png            optional (.png, .jpg, .webp or .svg)
        └── <productId>/
            ├── producto.json
            ├── ficha.md            product sheet with allowed and forbidden claims
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
  "fonts": { "heading": "Montserrat", "body": "Inter", "google": true },
  "logo": "logo.png",
  "tone": "Cercano y directo, sin exagerar",
  "createdAt": "2026-11-16T12:00:00Z"
}
```

- Colors are `#rrggbb`. `primary` fills buttons and badges, `accent` highlights, `text` and
  `background` are for panels.
- `fonts.google: true` loads both fonts from Google Fonts when the template is rendered (needs
  internet); otherwise they must be installed on the computer. If a font fails, the template falls
  back to the system font.
- `logo` is a file name inside `marca/`, or `null`.

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
  "omitted": ["clientes/acme/MLA1234567890/videos/2026-11-10-patas-cama-problema-solucion/borrador-v1.mp4"]
}
```

- A video brings its product (everything in the product folder except `videos/`) and its actor;
  a product or a client brings its videos. `studio.json` never travels.
- `mode` is `light` (default: no `borrador-vN.mp4`, no `candidatos/`; the drafts are listed in
  `omitted` and stay reachable through the `jobId` of their version) or `complete`.
- Packages are named `exportaciones/<yyyy-mm-dd>-<name>.zip` and never overwritten.
- Importing never replaces a file. An element already in the studio with other content is a
  conflict: it is skipped (`--omitir`) or imported under a new id (`--renombrar`, actors and
  videos only). Renaming an actor updates `id` and `version` in its `actor.json` and `actorId` in
  the videos imported with it; renaming a video updates its `id`.
- Both computers must use the same Higgsfield account: the ids and links in the `.json` files
  belong to it.
- Creatives travel inside their product folder. Brand kits (`clientes/<profileId>/marca/`) and the
  actors that appear only in creatives do not travel yet: copy them by hand if needed.
