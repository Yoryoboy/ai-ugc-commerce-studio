---
name: setup
description: Set up UGC Studio in the current folder — check the Higgsfield and BI-MCP connectors, create the studio folders, and publish the studio dashboard. Use when the user asks to set up, install, configure or repair the studio or its dashboard, or when another UGC Studio skill finds no studio.json.
---

# Set up UGC Studio

The user is usually not a programmer, working in the Claude desktop app. Talk to them in
Spanish (Rioplatense, warm, short). Never show them commands, JSON or file paths unless they ask.
Explain each step in one line and say what they have to do, if anything.

Files referenced below live next to this SKILL.md (this skill's base directory) or in
`../../references/` from it.

## 1. Check the connectors

Call both, read-only:

- Higgsfield `balance` (tool `mcp__<higgsfield-segment>__balance`).
- BI-MCP `config_list_profiles` (tool `mcp__<bimcp-segment>__config_list_profiles`).

Note each connector's tool prefix segment (the text between `mcp__` and the next `__`, for
example `claude_ai_Higgsfield`). You need it in step 3.

If a connector is missing or asks to authenticate, stop and tell the user exactly:
"Falta conectar <nombre> en Claude: Configuración › Conectores › <nombre> › Conectar. Avisame
cuando esté y sigo." Do not continue without both.

## 2. Create the studio folder

Work in the folder open in this session (the studio folder). If `studio.json` already exists,
read it: the studio is already set up. Only repair what is missing (folders, or the dashboard if
its URL no longer opens) and skip to step 5.

Create:

```txt
actores/
clientes/
.studio/
studio.json
```

Product and video folders are created later by the other skills:
`clientes/<profileId>/<productId>/fotos/` and
`clientes/<profileId>/<productId>/videos/<videoId>/`.

## 3. Publish the dashboard

1. Copy `dashboard.html` from this skill's base directory to `.studio/dashboard.html` in the
   studio folder. Always publish that copy, never the plugin file.
2. Publish it with the `Artifact` tool (load the `artifact-capabilities` skill first if it is not
   loaded) using:
   - `file_path`: the `.studio/dashboard.html` copy
   - `icon`: `video`
   - `description`: "Tablero de UGC Studio: videos por cliente y producto, actores, productos vinculados y créditos de Higgsfield."
   - `capabilities`:

     ```json
     {
       "db": {},
       "assets": {},
       "mcp": {
         "servers": [
           { "server": "<higgsfield-segment>", "tools": ["balance", "transactions"] },
           { "server": "<bimcp-segment>", "tools": ["config_list_profiles", "meli_search_items", "tiendanube_product", "vtex_list_products", "vtex_get_product"] }
         ]
       }
     }
     ```

3. The publish result names the display name each connector resolved to (for example
   `"claude_ai_Higgsfield" → "Higgsfield"`). Publish the same file again with `edits` that
   replace `__HIGGSFIELD_SERVER__` and `__BIMCP_SERVER__` with those exact display names.
4. Check the database once: `ArtifactData` `list` on `videos` must answer (empty is fine).

The dashboard must be published from the user's own account. A dashboard published by someone else
cannot use their connectors.

## 4. Save studio.json

```json
{
  "dashboardUrl": "<artifact url>",
  "dashboardFile": ".studio/dashboard.html",
  "connectors": { "higgsfield": "<display name>", "bimcp": "<display name>" },
  "storyboardScenes": null,
  "createdAt": "<ISO date>"
}
```

`storyboardScenes` is optional: a fixed number of storyboard scenes per video. `null` means
`crear-video` recommends one per 3–5 seconds and asks each time.

## 5. Hand over

Tell the user, in Spanish and in a few lines:

- The dashboard link, and that they can pin it in the Claude sidebar (offer to pin it).
- Credits available (from step 1).
- What they can ask next: "Quiero crear un actor", "¿A qué producto le conviene un video?",
  "Quiero crear un video para <producto>".

## Updating the dashboard later

When the plugin ships a newer `dashboard.html`, copy it again to `.studio/dashboard.html`, replace
the two connector placeholders with the names in `studio.json`, and publish to the same
`dashboardUrl`. The database and uploaded files are kept.
