---
name: setup
description: Set up UGC Studio in the current folder — check the Higgsfield and BI-MCP connectors, create the studio folders and studio.json, and open the local gallery. Use when the user asks to set up, install, configure or repair the studio or its gallery, or when another UGC Studio skill finds no studio.json.
---

# Set up UGC Studio

The user is usually not a programmer, working in the Claude desktop app. Talk to them in
Spanish (Rioplatense, warm, short). Never show them commands, JSON or file paths unless they ask.
Explain each step in one line and say what they have to do, if anything.

The workspace layout is defined in `${CLAUDE_PLUGIN_ROOT}/references/workspace.md`. Read it
first and follow it exactly: the gallery only shows files saved where it says.

## 1. Check the connectors

Call both, read-only:

- Higgsfield `balance` (tool `mcp__<higgsfield-segment>__balance`).
- BI-MCP `config_list_profiles` (tool `mcp__<bimcp-segment>__config_list_profiles`).

If a connector is missing or asks to authenticate, stop and tell the user exactly:
"Falta conectar <nombre> en Claude: Configuración › Conectores › <nombre> › Conectar. Avisame
cuando esté y sigo." Do not continue without both.

## 2. Create the studio

Work in the folder open in this session (the studio folder). If `studio.json` already exists, the
studio is set up: only repair what is missing and go to step 3. If it has a `dashboardUrl`, it was
set up with version 0.1.0: first follow "Upgrading a 0.1.0 studio" below.

Create `actores/`, `clientes/` and `studio.json`:

```json
{
  "connectors": { "higgsfield": "<connector name>", "bimcp": "<connector name>" },
  "storyboardScenes": null,
  "credits": { "available": <balance from step 1>, "checkedAt": "<ISO date>" },
  "createdAt": "<ISO date>"
}
```

Product and video folders are created later by the other skills.

## 3. Build and open the gallery

The plugin hooks keep the gallery in sync on their own. Run them once now so it exists right away:

```sh
sh "${CLAUDE_PLUGIN_ROOT}/scripts/sincronizar.sh" --resumen
```

Check that `galeria.html` and `.galeria/datos.js` exist in the studio folder. Then open it for
the user with `open galeria.html` (UGC Studio supports macOS).

If the files are missing after running the script, tell the user the gallery could not be built
and give them the exact error; do not continue as if it worked.

## 4. Hand over

Tell the user, in Spanish and in a few lines:

- The gallery opened in their browser. To see it again: double-click `galeria.html` in the studio
  folder, or ask "abrí la galería". It updates by itself while Claude works.
- Always open Claude on this same folder; otherwise it cannot find their actors and videos.
- Credits available (from step 1).
- What they can ask next: "Quiero crear un actor", "¿A qué producto le conviene un video?",
  "Quiero crear un video para <producto>". To move work to or from another computer: "Exportá
  …" or "Importá …".

## Upgrading a 0.1.0 studio

Version 0.1.0 kept the work in a dashboard artifact (`dashboardUrl` in `studio.json`). Move it
into the folders so the gallery shows it, then drop the dashboard fields:

1. Read the dashboard rows with `ArtifactData` (`list` on `videos` and `productos`, `url` =
   `dashboardUrl`).
2. For each product row, write its `producto.json` (`workspace.md`).
3. For each video row with a `localPath`, write `video.json` in that folder from the row (title,
   actor, status, hook, duration, credits, and each entry of `versions` with its job id, URL,
   credits, note and date). Rename the files to the contract (do not delete any file):

   | 0.1.0 name | New name |
   |---|---|
   | `borrador.mp4`, `thumb.jpg` | `borrador-v1.mp4`, `thumb-v1.jpg` |
   | `borrador-vN.mp4`, `thumb-vN.jpg` (N ≥ 2) | unchanged |
   | `borrador-vN-<note>.mp4` (for example `borrador-v4-admultiplier.mp4`) | `borrador-vN.mp4` |
   | `prompt-vN.md` | unchanged |
   | `prompt.md` | `prompt-vN.md`, N = the last version made from that folder |

   A version whose files sit in another video folder (for example a storyboard attempt saved
   apart) is moved into this folder under its version number, together with its `escena-N.png`
   and `storyboard.jpg`; then delete the empty folder.
4. Remove `dashboardUrl` and `dashboardFile` from `studio.json`. Leave the dashboard artifact as
   it is; tell the user it is no longer updated.
5. Run step 3 and check that every video folder appears in the gallery (the summary lists
   folders without `video.json`).
