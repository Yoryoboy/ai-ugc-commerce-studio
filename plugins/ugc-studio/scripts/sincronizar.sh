#!/bin/sh
# Keeps a UGC Studio workspace in sync with its gallery.
#
#   sincronizar.sh             copy the gallery page if it changed, validate the .json files that
#                              changed (exit 2, message on stderr, if one is broken) and make sure
#                              the gallery server is running
#   sincronizar.sh --resumen   the same, validating every file, then print a summary of the studio
#                              for Claude (stdout), with the gallery address (never its access token)
#
# Runs from the plugin hooks (SessionStart and PostToolUse). Works in the folder given by
# CLAUDE_PROJECT_DIR, or the current folder. Does nothing outside a studio (no studio.json).
# The gallery data is not built here: the server (scripts/galeria.sh) indexes the folders itself.
# Uses only POSIX sh tools that macOS ships with.

set -u
LC_ALL=C
export LC_ALL

ROOT=${CLAUDE_PROJECT_DIR:-$PWD}
[ -f "$ROOT/studio.json" ] || exit 0
cd "$ROOT" || exit 0
ROOT=$(pwd) # absolute from here on: a relative CLAUDE_PROJECT_DIR no longer points anywhere

PLUGIN=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
SUMMARY=0
[ "${1:-}" = "--resumen" ] && SUMMARY=1

MARKER=.galeria/validado
BROKEN=.galeria/rotos.txt
NOSERVER=.galeria/sin-servidor
mkdir -p .galeria

# 1. Gallery page: keep the studio copy equal to the plugin's. Opened as a file it only says to
#    ask Claude for the gallery, which is served by the local server.
if ! cmp -s "$PLUGIN/galeria/galeria.html" galeria.html 2>/dev/null; then
  cp "$PLUGIN/galeria/galeria.html" galeria.html
fi
# The index used to be built here; the server keeps it in memory now.
rm -f .galeria/datos.js

# Validates JSON files with whatever JavaScript runtime the machine has.
validate() {
  [ $# -gt 0 ] || return 0
  if [ "$(uname)" = Darwin ] && command -v osascript >/dev/null 2>&1; then
    osascript -l JavaScript "$PLUGIN/scripts/validar-json.js" "$@" 2>&1 | grep -v '^$'
  elif command -v node >/dev/null 2>&1; then
    node "$PLUGIN/scripts/validar-json.js" "$@"
  elif [ -x "$HOME/.ugc-studio/node/bin/node" ]; then
    "$HOME/.ugc-studio/node/bin/node" "$PLUGIN/scripts/validar-json.js" "$@"
  fi
  return 0
}

# Validates the paths on stdin (one per line), a few hundred per run so the argument list stays short.
validate_paths() {
  set --
  n=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    set -- "$@" "$f"
    n=$((n + 1))
    if [ $n -ge 300 ]; then
      validate "$@"
      set --
      n=0
    fi
  done
  [ $n -gt 0 ] && validate "$@"
  return 0
}

# Keeps the lines of stdin that are .json files of the studio contract (see references/workspace.md).
contract_only() {
  grep -E '^(studio\.json|actores/[^/]+/actor\.json|clientes/[^/]+/[^/]+/producto\.json|clientes/[^/]+/marca/marca\.json|clientes/[^/]+/[^/]+/videos/[^/]+/video\.json|clientes/[^/]+/[^/]+/creativos/[^/]+/creativo\.json)$'
}

# 2. Validation: every file at session start (or the first time); otherwise only the files changed
#    since the last check plus the ones still broken, so a broken file keeps being reported until
#    fixed. One `find` over the studio, however many creatives it has.
ALL=""
full=0
{ [ $SUMMARY -eq 1 ] || [ ! -f "$MARKER" ]; } && full=1

broken=""
changed=1
if [ $full -eq 1 ]; then
  ALL=$(find studio.json actores clientes -type f 2>/dev/null | contract_only)
  to_check=$ALL
else
  newer=$(find studio.json actores clientes -newer "$MARKER" 2>/dev/null)
  if [ -z "$newer" ]; then
    changed=0
  else
    to_check=$(
      {
        printf '%s\n' "$newer" | contract_only
        if [ -s "$BROKEN" ]; then
          while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done <"$BROKEN"
        fi
      } | sort -u
    )
  fi
fi

if [ $changed -eq 1 ]; then
  # Taken before validating: a file saved while this runs is checked again next time.
  newmark="$MARKER.new.$$"
  : >"$newmark"
  if [ -n "$to_check" ]; then
    # One path per line: folder names never contain newlines.
    broken=$(printf '%s\n' "$to_check" | validate_paths)
  fi

  # Remember which of the checked files are broken. Match each checked path against the start of
  # the validator lines instead of parsing them, so an error message can never change the path.
  checked="$BROKEN.check.$$"
  printf '%s\n' "$to_check" >"$checked"
  printf '%s\n' "$broken" |
    awk 'NR == FNR { if ($0 != "") paths[$0] = 1; next }
         { for (p in paths) if (index($0, p ": ") == 1) print p }' "$checked" - |
    sort -u >"$BROKEN"
  rm -f "$checked"
  mv "$newmark" "$MARKER"
fi

# Nothing changed since the last check: files that were broken then are still broken.
if [ $changed -eq 0 ] && [ -s "$BROKEN" ]; then
  broken=$(sed 's/$/: still not valid JSON/' "$BROKEN")
fi

# 3. The gallery server: start it if it is not running. Never fails the hook (Node may be
#    missing); after a failed start, PostToolUse waits a minute before trying again.
GALERIA_URL=""
GALERIA_NOTE=""
try_start=1
if [ $SUMMARY -eq 0 ] && [ -f "$NOSERVER" ] && [ -n "$(find "$NOSERVER" -mmin -1 2>/dev/null)" ]; then
  try_start=0
fi
if [ $try_start -eq 1 ]; then
  # The launcher prints the address without the access token; the token never goes into this
  # output, which ends up in the conversation.
  mkdir -p "$ROOT/.galeria"
  startlog="$ROOT/.galeria/arranque.err.$$"
  if started=$(CLAUDE_PROJECT_DIR="$ROOT" CLAUDE_PLUGIN_ROOT="$PLUGIN" sh "$PLUGIN/scripts/galeria.sh" start 2>"$startlog"); then
    GALERIA_URL=$started
    rm -f "$NOSERVER"
  else
    GALERIA_NOTE="$started $(cat "$startlog" 2>/dev/null)"
    : >"$NOSERVER"
  fi
  rm -f "$startlog"
fi

# 4. Report.
if [ $SUMMARY -eq 0 ]; then
  if [ -n "$broken" ]; then
    {
      printf 'UGC Studio: these files are not valid JSON and do not show in the gallery. Fix them now:\n'
      printf '%s\n' "$broken"
    } >&2
    exit 2
  fi
  exit 0
fi

count() { printf '%s\n' "$ALL" | grep -c "$1" || true; }
# Files by status in one pass: lines "<kind> <status> <count>" for videos and creatives.
STATUS_COUNTS=$(printf '%s\n' "$ALL" | grep -E '/(video|creativo)\.json$' | tr '\n' '\0' |
  xargs -0 grep -H -o '"status"[[:space:]]*:[[:space:]]*"[a-z]*"' 2>/dev/null |
  awk '{
    f = $0; sub(/:"status".*/, "", f)
    s = $0; sub(/^.*"status"[[:space:]]*:[[:space:]]*"/, "", s); sub(/".*$/, "", s)
    key = f SUBSEP s
    if (key in seen) next
    seen[key] = 1
    kind = (f ~ /\/creativo\.json$/) ? "creativo" : "video"
    n[kind " " s]++
  } END { for (k in n) print k, n[k] }')
# status_count <status> [json file name]: videos by default.
status_count() {
  kind=video
  [ "${2:-}" = creativo.json ] && kind=creativo
  printf '%s\n' "$STATUS_COUNTS" | awk -v k="$kind $1" '{ if ($1 " " $2 == k) { print $3; found = 1 } } END { if (!found) print 0 }'
}

printf 'UGC Studio workspace: %s\n' "$ROOT"
printf 'Contract: %s/references/workspace.md (save every file where it says).\n' "$PLUGIN"
if [ -n "$GALERIA_URL" ]; then
  printf 'Gallery: %s (local server, private: to open it for the user run `sh "%s/scripts/galeria.sh" open`, or ask Claude "abrí la galería"; never print or share the access link).\n' \
    "$GALERIA_URL" "$PLUGIN"
else
  printf 'Gallery: the server did not start: %s\n' "$(printf '%s' "$GALERIA_NOTE" | tr '\n' ' ')"
fi
printf 'Actors: %s. Products: %s. Videos: %s (storyboard %s, draft %s, final %s, discarded %s).\n' \
  "$(count '/actor.json')" "$(count '/producto.json')" "$(count '/video.json')" \
  "$(status_count storyboard)" "$(status_count draft)" "$(status_count final)" \
  "$(status_count discarded)"
printf 'Creatives: %s (draft %s, approved %s, discarded %s). Brand kits: %s.\n' \
  "$(count '/creativo.json')" "$(status_count draft creativo.json)" \
  "$(status_count approved creativo.json)" "$(status_count discarded creativo.json)" \
  "$(count '/marca.json')"

if [ -n "$broken" ]; then
  printf 'Invalid JSON (not shown in the gallery, fix it):\n%s\n' "$broken"
fi

orphans=$(for d in clientes/*/*/videos/*/; do
  [ -d "$d" ] && [ ! -f "${d}video.json" ] && printf '%s\n' "${d%/}"
done)
if [ -n "$orphans" ]; then
  printf 'Video folders without video.json (not shown in the gallery):\n%s\n' "$orphans"
fi

orphans=$(for d in clientes/*/*/creativos/*/; do
  [ -d "$d" ] && [ ! -f "${d}creativo.json" ] && printf '%s\n' "${d%/}"
done)
if [ -n "$orphans" ]; then
  printf 'Creative folders without creativo.json (not shown in the gallery):\n%s\n' "$orphans"
fi

stray=$(find . -path ./actores -prune -o -path ./clientes -prune -o -path ./.galeria -prune -o \
  -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \
  -o -iname '*.mp4' -o -iname '*.mov' \) -print 2>/dev/null)
if [ -n "$stray" ]; then
  printf 'Media outside actores/ and clientes/ (not shown in the gallery): %s files, e.g.\n' \
    "$(printf '%s\n' "$stray" | wc -l | tr -d ' ')"
  printf '%s\n' "$stray" | head -n 5
fi
exit 0
