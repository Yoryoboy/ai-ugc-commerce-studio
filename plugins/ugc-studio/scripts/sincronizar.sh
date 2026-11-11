#!/bin/sh
# Keeps a UGC Studio workspace in sync with its gallery.
#
#   sincronizar.sh             copy the gallery if it changed, rebuild the index when files
#                              changed, and report broken JSON (exit 2, message on stderr)
#   sincronizar.sh --resumen   the same, then print a summary of the studio for Claude (stdout)
#
# Runs from the plugin hooks (SessionStart and PostToolUse). Works in the folder given by
# CLAUDE_PROJECT_DIR, or the current folder. Does nothing outside a studio (no studio.json).
# Uses only POSIX sh tools that macOS ships with.

set -u
LC_ALL=C
export LC_ALL

ROOT=${CLAUDE_PROJECT_DIR:-$PWD}
[ -f "$ROOT/studio.json" ] || exit 0
cd "$ROOT" || exit 0

PLUGIN=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
SUMMARY=0
[ "${1:-}" = "--resumen" ] && SUMMARY=1

INDEX=.galeria/datos.js
BROKEN=.galeria/rotos.txt
mkdir -p .galeria

# 1. Gallery page: keep the studio copy equal to the plugin's.
if ! cmp -s "$PLUGIN/galeria/galeria.html" galeria.html 2>/dev/null; then
  cp "$PLUGIN/galeria/galeria.html" galeria.html
fi

# Prints a file, or stdin, as a JavaScript string literal.
js_string() {
  if [ $# -gt 0 ]; then cat "$1"; else cat; fi |
    tr -d '\r' |
    sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' |
    awk 'BEGIN { ORS = ""; print "\"" } NR > 1 { print "\\n" } { print } END { print "\"" }'
}

# Prints the files of a folder (and of extra subfolders) as a JS array of names.
# Escapes all names in one pass, so a folder costs the same few processes however many files it has.
js_files() {
  dir=$1
  shift
  for sub in "" "$@"; do
    for f in "$dir/$sub"*; do
      [ -f "$f" ] && printf '%s\n' "${f#"$dir"/}"
    done
  done |
    tr -d '\r' |
    sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' |
    awk 'BEGIN { ORS = ""; print "[" } { if (NR > 1) print ","; print "\"" $0 "\"" } END { print "]" }'
}

# Validates JSON files with whatever JavaScript runtime the machine has.
validate() {
  [ $# -gt 0 ] || return 0
  if [ "$(uname)" = Darwin ] && command -v osascript >/dev/null 2>&1; then
    osascript -l JavaScript "$PLUGIN/scripts/validar-json.js" "$@" 2>&1 | grep -v '^$'
  elif command -v node >/dev/null 2>&1; then
    node "$PLUGIN/scripts/validar-json.js" "$@"
  fi
  return 0
}

json_files() {
  for f in studio.json actores/*/actor.json clientes/*/*/producto.json \
    clientes/*/*/videos/*/video.json; do
    [ -f "$f" ] && printf '%s\n' "$f"
  done
}

# 2. Index: rebuild only when something in the studio changed after the last build.
changed=1
if [ -f "$INDEX" ] && [ $SUMMARY -eq 0 ]; then
  if [ -z "$(find studio.json actores clientes -newer "$INDEX" 2>/dev/null | head -n 1)" ]; then
    changed=0
  fi
fi

broken=""
if [ $changed -eq 1 ]; then
  # Validate every file at session start. Otherwise validate the files changed since the last
  # build plus the ones still broken last time, so a broken file keeps being reported until fixed.
  if [ $SUMMARY -eq 1 ] || [ ! -f "$INDEX" ]; then
    to_check=$(json_files)
  else
    to_check=$(
      {
        json_files | while IFS= read -r f; do
          [ "$f" -nt "$INDEX" ] && printf '%s\n' "$f"
        done
        [ -s "$BROKEN" ] && json_files | grep -xF -f "$BROKEN"
      } | sort -u
    )
  fi
  if [ -n "$to_check" ]; then
    # One path per line: folder names never contain newlines.
    broken=$(printf '%s\n' "$to_check" | {
      set --
      while IFS= read -r f; do set -- "$@" "$f"; done
      validate "$@"
    })
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

  tmp="$INDEX.tmp.$$"
  {
    printf 'window.ESTUDIO = {\n'
    # The process id makes two builds in the same second different, so the gallery picks up both.
    printf '  "generatedAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '  "build": "%s-%s",\n' "$(date -u +%s)" "$$"
    printf '  "studio": '
    js_string studio.json
    printf ',\n  "entities": [\n'
    for f in actores/*/actor.json; do
      [ -f "$f" ] || continue
      d=${f%/actor.json}
      printf '    { "kind": "actor", "path": '; printf '%s' "$d" | js_string; printf ', "json": '
      js_string "$f"
      printf ', "files": '
      js_files "$d"
      printf ' },\n'
    done
    for f in clientes/*/*/producto.json; do
      [ -f "$f" ] || continue
      d=${f%/producto.json}
      printf '    { "kind": "product", "path": '; printf '%s' "$d" | js_string; printf ', "json": '
      js_string "$f"
      printf ', "files": '
      js_files "$d" fotos/
      printf ' },\n'
    done
    for f in clientes/*/*/videos/*/video.json; do
      [ -f "$f" ] || continue
      d=${f%/video.json}
      printf '    { "kind": "video", "path": '; printf '%s' "$d" | js_string; printf ', "json": '
      js_string "$f"
      printf ', "files": '
      js_files "$d"
      printf ' },\n'
    done
    printf '  ]\n};\n'
  } >"$tmp" && mv "$tmp" "$INDEX"
fi

# Nothing changed since the last build: files that were broken then are still broken.
if [ $changed -eq 0 ] && [ -s "$BROKEN" ]; then
  broken=$(sed 's/$/: still not valid JSON/' "$BROKEN")
fi

# 3. Report.
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

count() { json_files | grep -c "$1" || true; }
status_count() {
  grep -l "\"status\"[[:space:]]*:[[:space:]]*\"$1\"" clientes/*/*/videos/*/video.json 2>/dev/null |
    wc -l | tr -d ' '
}

printf 'UGC Studio workspace: %s\n' "$ROOT"
printf 'Contract: %s/references/workspace.md (save every file where it says).\n' "$PLUGIN"
printf 'Gallery: %s/galeria.html (open it with `open galeria.html` on macOS).\n' "$ROOT"
printf 'Actors: %s. Products: %s. Videos: %s (storyboard %s, draft %s, final %s, discarded %s).\n' \
  "$(count '/actor.json')" "$(count '/producto.json')" "$(count '/video.json')" \
  "$(status_count storyboard)" "$(status_count draft)" "$(status_count final)" \
  "$(status_count discarded)"

if [ -n "$broken" ]; then
  printf 'Invalid JSON (not shown in the gallery, fix it):\n%s\n' "$broken"
fi

orphans=$(for d in clientes/*/*/videos/*/; do
  [ -d "$d" ] && [ ! -f "${d}video.json" ] && printf '%s\n' "${d%/}"
done)
if [ -n "$orphans" ]; then
  printf 'Video folders without video.json (not shown in the gallery):\n%s\n' "$orphans"
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
