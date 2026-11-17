# Dependencies: check, then install only what is missing

Claude Code is the only thing the user installs by hand. Everything else below is checked by the
agent and installed only when it is missing. Followed by the `setup` skill and by an agent that
sets up a new computer from the README (readable straight from GitHub).

Rules for every item:

- **Check first.** If it is already there, say so in one line and move on. Never install a
  second copy or replace a working configuration.
- **Tell before installing:** one line saying what you will install and why.
- **Never print secrets** (tokens, keys, the contents of credential files).
- If something cannot be installed, say what failed in plain words and what the user can do.
  Only Higgsfield and BI-MCP are mandatory; the rest is reported and the setup goes on.

## 1. Higgsfield (official MCP) — mandatory

Images and videos are generated through it. Needs a Higgsfield account with credits (paid
subscription).

- **Address:** `https://mcp.higgsfield.ai/mcp` (remote, sign-in with the Higgsfield account; no
  API key).
- **Already there?** Any of these counts:
  - the session already has its tools (for example `balance`, `generate_image`);
  - `claude mcp list` shows a server with that address, or a claude.ai connector named
    Higgsfield (connectors added on claude.ai or in the desktop app show up in Claude Code too).
- **Install** (only if missing):

  ```sh
  claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
  ```

- **Sign in:** in a session, the user runs `/mcp`, chooses `higgsfield` and signs in in the
  browser. In the desktop app it can also be added as a custom connector
  (Settings › Connectors › Add custom connector) with the same address.

## 2. BI-MCP — mandatory

Product catalog and sales (Mercado Libre, Tiendanube, VTEX) for each client.

- **Address:** `https://bi-mcp-290271124805.us-east4.run.app/mcp`
- **Already there?** The session has the tool `config_list_profiles`, or `claude mcp list` shows
  a server with that address (under any name).
- **Install** (only if missing):

  ```sh
  claude mcp add --transport http --scope user bi-mcp https://bi-mcp-290271124805.us-east4.run.app/mcp
  ```

- **Sign in:** if it asks for it, the user runs `/mcp`, chooses `bi-mcp` and completes the sign-in.
  Access is given by whoever manages the clients: if the sign-in is refused, the user asks them.

## 3. Engram (persistent memory) — recommended

Follow [`engram.md`](engram.md). It checks first and only verifies when it is already installed.

## 4. Google Chrome — recommended

Renders the creatives with template text (`scripts/componer.sh`). Without it, videos and
creatives with text drawn by the AI still work.

- **Already there?** macOS: `/Applications/Google Chrome.app` (Chromium, Microsoft Edge or Brave
  in `/Applications` also work). Linux: `google-chrome`, `google-chrome-stable`, `chromium` or
  `chromium-browser` on the PATH.
- **Install** (only if missing): macOS with Homebrew: `brew install --cask google-chrome`;
  without Homebrew, ask the user to download it from https://www.google.com/chrome and wait.
  Linux: the distribution's package manager (for example `sudo apt install chromium` or
  `sudo pacman -S chromium`); it needs the user's password, so ask them to run it.

## 5. Node.js 18 or newer — recommended

Runs the gallery: a small local server (`scripts/galeria.sh`) that Claude starts by itself and the
browser talks to. On Linux it also validates the studio `.json` files. Without it the work is
saved all the same, but the gallery does not open.

- **Already there?** `node --version` prints 18 or higher, or an earlier setup left a portable one:
  `~/.ugc-studio/node/bin/node --version` prints 18 or higher. Either one is enough
  (`galeria.sh` uses the first it finds).
- **Install** (only if missing or older than 18): a portable copy of the official build in
  `~/.ugc-studio/node`. It needs no administrator password and touches nothing else on the
  computer. Tell the user first: "Voy a instalar Node.js (para la galería) en tu carpeta de usuario,
  sin permisos de administrador."

  ```sh
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) PLAT=darwin-arm64 ;;
    Darwin-x86_64) PLAT=darwin-x64 ;;
    Linux-x86_64) PLAT=linux-x64 ;;
    Linux-aarch64 | Linux-arm64) PLAT=linux-arm64 ;;
    *) echo "unsupported platform"; PLAT= ;;
  esac
  # Current LTS: the newest release of https://nodejs.org/dist/index.json with an LTS name.
  V=$(curl -fsSL https://nodejs.org/dist/index.json | grep '"lts":"' | sed 's/.*"version":"\([^"]*\)".*/\1/' | head -n 1)
  # Download into a new empty folder and verify the file against that release's SHASUMS256.txt.
  TMP=$(mktemp -d)
  curl -fsSL -o "$TMP/node-$V-$PLAT.tar.gz" "https://nodejs.org/dist/$V/node-$V-$PLAT.tar.gz"
  curl -fsSL -o "$TMP/SHASUMS256.txt" "https://nodejs.org/dist/$V/SHASUMS256.txt"
  (cd "$TMP" && grep " node-$V-$PLAT.tar.gz\$" SHASUMS256.txt >check.txt &&
    { sha256sum -c check.txt 2>/dev/null || shasum -a 256 -c check.txt; })
  ```

  Only if that check prints `OK` for the file, extract it (a previous portable copy that was too
  old is moved aside to `~/.ugc-studio/node.old` first, never deleted):

  ```sh
  [ -d ~/.ugc-studio/node ] && mv ~/.ugc-studio/node ~/.ugc-studio/node.old
  mkdir -p ~/.ugc-studio/node
  tar -xzf "$TMP/node-$V-$PLAT.tar.gz" -C ~/.ugc-studio/node --strip-components=1
  ~/.ugc-studio/node/bin/node --version
  ```

  If the download, the `SHASUMS256.txt` line or the check fails, install nothing: say in plain
  words that the gallery will not open until Node.js is installed, and that the user can install
  it from https://nodejs.org (the LTS version) and then ask again. Do not add it to the PATH or
  use `sudo`.

## 6. Linux only: ffmpeg

On macOS nothing else is needed: the scripts use tools macOS ships with. On Linux:

- **ffmpeg** makes the video thumbnails and the gallery's image thumbnails (`ffmpeg -version`).
  Without it the gallery shows the original images, which is slower with many pieces.
- **Install** (only if missing) with the package manager, for example `sudo apt install ffmpeg` or
  `sudo pacman -S ffmpeg`; it needs the user's password, so ask them to run it.

## After installing

MCP servers added with `claude mcp add` load in the next session. If anything was added, the user
opens a new session in the same folder (with the same `CLAUDE_CONFIG_DIR`, if they use one),
signs in with `/mcp` where needed, and continues the setup there.
