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
        └── <productId>/
            ├── producto.json
            ├── ficha.md            product sheet with allowed and forbidden claims
            ├── fotos/              product photos, original names
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
  "credits": { "available": 933.5, "checkedAt": "2026-11-11T13:00:00Z" },
  "createdAt": "2026-11-11T12:00:00Z"
}
```

- `storyboardScenes`: fixed number of storyboard scenes per video, or `null` to ask each time.
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
