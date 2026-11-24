---
name: setup
description: Set up UGC Studio in the current folder — check and install what is missing (the Higgsfield and BI-MCP MCP servers, Google Chrome, Node.js for the gallery, and on Linux ffmpeg), install the persistent memory (Engram), create the studio folders and studio.json, and open the local gallery. Use when the user asks to set up, install, configure or repair the studio or its gallery, or when another UGC Studio skill finds no studio.json.
---

# Set up UGC Studio

The user is usually not a programmer, working in the Claude desktop app. Talk to them in
Spanish (Rioplatense, warm, short). Never show them commands, JSON or file paths unless they ask.
Explain each step in one line and say what they have to do, if anything.

The workspace layout is defined in `${CLAUDE_PLUGIN_ROOT}/references/workspace.md`. Read it
first and follow it exactly: the gallery only shows files saved where it says.

## 1. Dependencies

Follow `${CLAUDE_PLUGIN_ROOT}/references/dependencias.md`: for each item, check whether it is
already there and install only what is missing (Higgsfield and BI-MCP MCP servers, Google Chrome,
Node.js 18+ for the gallery server, and on Linux ffmpeg). Engram is step 1b.

Then call both connectors, read-only:

- Higgsfield `balance` (tool `mcp__<higgsfield-segment>__balance`).
- BI-MCP `config_list_profiles` (tool `mcp__<bimcp-segment>__config_list_profiles`).

If you just added a server, it is not loaded yet: do steps 1b, 2 and 3 now, and at the end ask
the user to open a new session in this folder, sign in with `/mcp` and say "Configurá el
estudio" again to finish the check. If a server is there but asks to sign in, tell the user
exactly: "Falta iniciar sesión en <nombre>: escribí /mcp, elegí <nombre> e iniciá sesión. Avisame
cuando esté y sigo." Nothing that spends credits or reads client data runs until both answer.

## 1b. Persistent memory (Engram)

The memory is part of the setup: it lets Claude remember decisions, preferences and what worked
for each product across conversations. Follow the `configurar-memoria` skill
(`${CLAUDE_PLUGIN_ROOT}/skills/configurar-memoria/SKILL.md`). If it is already installed it only
verifies. If the user does not want it, or it cannot be installed, say so and go on: the studio
works without it. Remember whether it was installed now: a new session is needed at the end.

## 2. Create the studio

Work in the folder open in this session (the studio folder). If `studio.json` already exists, the
studio is set up: only repair what is missing and go to step 3. If it has a `dashboardUrl`, it was
set up with version 0.1.0: first follow "Upgrading a 0.1.0 studio" below.

Create `actores/`, `clientes/` and `studio.json`:

```json
{
  "connectors": { "higgsfield": "<connector name>", "bimcp": "<connector name>" },
  "storyboardScenes": null,
  "creativeConcepts": null,
  "credits": { "available": <balance from step 1>, "checkedAt": "<ISO date>" },
  "createdAt": "<ISO date>"
}
```

Product, video, brand kit and creative folders are created later by the other skills.

## 2b. Check Google Chrome (creatives only)

Creatives with template text are rendered by `scripts/componer.sh` with Google Chrome running
hidden. Check that one is installed: `ls -d "/Applications/Google Chrome.app"` (Chromium, Microsoft
Edge or Brave in `/Applications` also work). If none is there, do not stop the setup: tell the user
in one line that to make creatives with the brand's template they need Google Chrome
(google.com/chrome), and that videos and creatives with text drawn by the AI work without it.

## 3. Open the gallery

The gallery is a small local server that the plugin hooks keep running and the folders feed by
themselves. Run the hook once now (it validates the files and starts the server), then open the
gallery for the user:

```sh
sh "${CLAUDE_PLUGIN_ROOT}/scripts/sincronizar.sh" --resumen
sh "${CLAUDE_PLUGIN_ROOT}/scripts/galeria.sh" start
```

Check that `galeria.html` exists in the studio folder and that `galeria.sh start` printed an
address (`http://127.0.0.1:…`). It needs Node.js 18 or newer: if it says Node is missing, go back to
the Node item of `dependencias.md`.

The server also wrote `.claude/launch.json` with a `galeria` configuration pointing at that address
(`workspace.md`, Gallery server); do not write or edit it yourself. Open the gallery:

- In the Claude desktop app (the `preview_start` tool exists): call `preview_start` with name
  `galeria`. It opens in the app's browser pane, next to the chat.
- Otherwise, or if `preview_start` fails: run `sh "${CLAUDE_PLUGIN_ROOT}/scripts/galeria.sh" open`,
  which opens it in the system browser.

If the gallery does not start, tell the user the gallery could not be opened and give them the
exact error; do not continue as if it worked.

## 4. Hand over

Tell the user, in Spanish and in a few lines:

- The gallery opened (in the app's browser pane, or in their browser). To see it again, ask
  "abrí la galería" (open it as in step 3); double-clicking `galeria.html` does not work any more.
  It updates by itself while Claude works, from every session open on this folder: there is a
  single gallery per studio.
- Always open Claude on this same folder; otherwise it cannot find their actors and videos.
- Credits available (from step 1).
- If the memory was installed in this setup: open a new session in this same folder (and, on
  Mac, quit Claude Desktop with Cmd+Q and open it again) so it starts working.
- What they can ask next: "Quiero crear un actor", "¿A qué producto le conviene un video?",
  "Quiero crear un video para <producto>", "Haceme creativos para Meta de <producto>". To move work to or from another computer: "Exportá
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
