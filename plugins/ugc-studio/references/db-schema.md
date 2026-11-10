# Studio data model

The dashboard artifact keeps three collections in its database. Claude writes them with the
`ArtifactData` tool; the dashboard only writes `productos` (when the user links a product).
The local folder keeps the files; the database keeps state and relations.

All dates are ISO 8601 strings in UTC.

## `actores/{actorId}`

`actorId` = `<slug>-v<version>`, e.g. `luna-v1`. Never overwrite an existing version: a changed
actor gets a new id (`luna-v2`).

| Field | Type | Notes |
|---|---|---|
| name | string | Display name, e.g. "Luna" |
| version | string | "v1", "v1.1"… |
| gender | string | As shown to the user, e.g. "Mujer", "Hombre" |
| apparentAge | number | Years |
| style | string | One line: look and vibe |
| personality | string | One line: how the creator comes across |
| fitsNiches | string[] | Product niches the actor fits |
| avoidNiches | string[] | Niches the actor does not fit |
| portraitAssetUrl | string | `/_blob/<id>` of the portrait uploaded to the dashboard |
| higgsfield.elementId | string | Higgsfield character Element (works with GPT Image 2.6) |
| higgsfield.portraitMediaId | string | Pass as `image_references` to Seedance 2.5 |
| higgsfield.anglesMediaId | string | Optional, same use |
| higgsfield.characterSheetMediaId | string | Pass as `image_references` to Seedance 2.5 |
| localPath | string | Folder of the actor, relative to the studio folder |
| createdAt | string | |

## `productos/{productKey}`

`productKey` = `<profileId>-<platform>-<productId>`, e.g. `acme-mercadolibre-MLA1234567890`.

| Field | Type | Notes |
|---|---|---|
| profileId | string | BI-MCP profile id |
| clientName | string | BI-MCP profile name |
| platform | string | `mercadolibre`, `vtex` or `tiendanube` |
| productId | string | Id on that platform |
| title | string | |
| price | number \| null | |
| currency | string \| null | |
| status | string \| null | Listing status at link time |
| imageAssetUrl | string | Optional product photo uploaded to the dashboard |
| linkedAt | string | |
| linkedBy | string | `dashboard` or `claude` |

## `videos/{videoId}`

`videoId` = `<yyyy-mm-dd>-<product-slug>-<idea-slug>`.

| Field | Type | Notes |
|---|---|---|
| title | string | Idea name shown in the dashboard |
| productKey | string | `productos` id, or `_` for tests without product |
| actorId | string | `actores` id |
| status | string | `idea`, `draft`, `approved`, `final`, `discarded` |
| hook | string | Optional |
| durationSec | number | |
| resolution | string | `480p`, `720p`, `1080p` |
| credits | number | Total credits spent on this video (all attempts) |
| jobId | string | Latest Higgsfield job id |
| versions | object[] | Every attempt, oldest first: `{ n, jobId, url, credits, note, thumbAssetUrl, createdAt }`. The last one is the current version. The dashboard shows every version as its own card (older ones as "Versión anterior", opening in Higgsfield) |
| draftUrl | string | Higgsfield URL of the latest draft |
| finalUrl | string | Higgsfield URL of the final |
| thumbAssetUrl | string | `/_blob/<id>` of the thumbnail (one frame, JPEG, ~100 KB). Every generated video has one |
| previewAssetUrl | string | `/_blob/<id>` of a playable copy, only while the video is under review (draft). Removed when it is approved or discarded |
| localPath | string | Video folder, relative to the studio folder |
| createdAt / updatedAt | string | |

The dashboard cannot load images or videos from Higgsfield URLs: the artifact frame blocks other
hosts (confirmed: Chrome reports `img-src` and `media-src` CSP violations). Anything it shows must
be uploaded as an artifact asset, and each dashboard has 1024 MB of asset storage. So the
dashboard keeps thumbnails, plus a playable preview only for drafts under review. Full videos are
watched in Higgsfield through the "Ver en Higgsfield" link.
