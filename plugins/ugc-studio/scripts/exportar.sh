#!/bin/sh
# Packs studio elements into a .zip that another computer imports with importar.sh.
#
#   exportar.sh [--plan] [--completo] [--nombre <name>] <element>...
#
# Elements, relative to the studio: actores/<actorId>, clientes/<profileId>,
# clientes/<profileId>/<productId>, clientes/<profileId>/<productId>/videos/<videoId>, or `todo`
# (every actor, product and video). A video brings its product and its actor; a product or a
# client brings its videos.
#
#   --plan       print what the package would hold and its size; write nothing
#   --completo   keep the drafts (borrador-vN.mp4) and the portrait candidates; by default they
#                are left out, and the drafts stay as Higgsfield links in video.json
#   --nombre     package name: lowercase letters, digits and `-` (default `paquete`)
#
# Writes exportaciones/<yyyy-mm-dd>-<name>.zip (numbered, never overwritten) and prints its path.
# Uses only tools that macOS ships with (zip), or python3 when zip is missing.

set -u
LC_ALL=C
export LC_ALL

die() { printf 'UGC Studio: %s\n' "$1" >&2; exit 1; }

ROOT=${CLAUDE_PROJECT_DIR:-$PWD}
[ -f "$ROOT/studio.json" ] || die "not a UGC Studio folder (no studio.json): $ROOT"
cd "$ROOT" || exit 1
PLUGIN=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}

PLAN=0
MODE=light
NAME=paquete
WORK=$(mktemp -d) || exit 1
trap 'rm -rf "$WORK"' EXIT
: >"$WORK/actors"
: >"$WORK/products"
: >"$WORK/videos"
: >"$WORK/missing"

while [ $# -gt 0 ]; do
  case $1 in
    --plan) PLAN=1 ;;
    --completo) MODE=complete ;;
    --nombre)
      [ $# -ge 2 ] || die "--nombre needs a name"
      NAME=$2
      shift
      ;;
    -*) die "unknown option: $1" ;;
    *) printf '%s\n' "${1%/}" >>"$WORK/elements" ;;
  esac
  shift
done
[ -s "$WORK/elements" ] || die "say what to export (actores/<id>, clientes/..., or todo)"
case $NAME in '' | -* | *[!a-z0-9-]*) false ;; esac ||
  die "package name must use lowercase letters, digits and -: $NAME"

add_video() {
  printf '%s\n' "$1" >>"$WORK/videos"
  product=$(printf '%s' "$1" | cut -d/ -f1-3)
  [ -f "$product/producto.json" ] && printf '%s\n' "$product" >>"$WORK/products"
  actor=$(sed -n 's/.*"actorId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1/video.json" | head -n 1)
  if [ -n "$actor" ]; then
    # Never follow an id that breaks the naming rules: it could point outside the studio.
    if case $actor in -* | *[!a-z0-9-]*) false ;; *) true ;; esac && [ -f "actores/$actor/actor.json" ]; then
      printf 'actores/%s\n' "$actor" >>"$WORK/actors"
    else
      printf '%s\n' "$actor" >>"$WORK/missing"
    fi
  fi
}

# Adds the products and videos under a folder (a client or a product).
add_under() {
  for f in "$1"/producto.json "$1"/*/producto.json; do
    [ -f "$f" ] && printf '%s\n' "${f%/producto.json}" >>"$WORK/products"
  done
  for f in "$1"/videos/*/video.json "$1"/*/videos/*/video.json; do
    [ -f "$f" ] && add_video "${f%/video.json}"
  done
}

while IFS= read -r e; do
  case $e in
    /* | . | ./* | */. | */./* | .. | ../* | */.. | */../* | *//*) die "Not found: $e" ;;
  esac
  if [ "$e" = todo ]; then
    for f in actores/*/actor.json; do
      [ -f "$f" ] && printf '%s\n' "${f%/actor.json}" >>"$WORK/actors"
    done
    for c in clientes/*/; do
      [ -d "$c" ] && add_under "${c%/}"
    done
  elif [ -f "$e/actor.json" ] && [ "${e%/*}" = actores ]; then
    printf '%s\n' "$e" >>"$WORK/actors"
  elif [ -f "$e/video.json" ] && [ "${e%/videos/*}" != "$e" ] && [ "${e#clientes/}" != "$e" ]; then
    add_video "$e"
  elif [ -d "$e" ] && case $e in clientes/*) true ;; *) false ;; esac; then
    before=$(cat "$WORK/products" "$WORK/videos" | wc -l)
    add_under "$e"
    [ "$(cat "$WORK/products" "$WORK/videos" | wc -l)" -gt "$before" ] || die "Not found: $e"
  else
    die "Not found: $e"
  fi
done <"$WORK/elements"

for list in actors products videos missing; do
  sort -u -o "$WORK/$list" "$WORK/$list"
done

# Files of every element: "keep" goes into the package in this mode, "all" is the complete one.
{
  while IFS= read -r d; do find "$d" -type f ! -name .DS_Store; done <"$WORK/actors"
  while IFS= read -r d; do find "$d" -path "$d/videos" -prune -o -type f ! -name .DS_Store -print; done <"$WORK/products"
  while IFS= read -r d; do find "$d" -type f ! -name .DS_Store; done <"$WORK/videos"
} | sort -u >"$WORK/all"
grep -E '^clientes/[^/]+/[^/]+/videos/[^/]+/borrador-v[0-9]+\.mp4$' "$WORK/all" >"$WORK/drafts"
grep -E '^actores/[^/]+/candidatos/' "$WORK/all" >"$WORK/candidates"
if [ $MODE = light ]; then
  cat "$WORK/drafts" "$WORK/candidates" | sort | comm -23 "$WORK/all" - >"$WORK/keep"
  cp "$WORK/drafts" "$WORK/omitted"
else
  cp "$WORK/all" "$WORK/keep"
  : >"$WORK/omitted"
fi

bytes() {
  [ -s "$1" ] || { echo 0; return; }
  tr '\n' '\0' <"$1" | xargs -0 ls -ln | awk '{ s += $5 } END { printf "%d\n", s }'
}
human() {
  awk -v b="$1" 'BEGIN {
    if (b >= 1048576) printf "%.1f MB\n", b / 1048576
    else printf "%d KB\n", (b + 1023) / 1024
  }'
}
# Joins the lines of stdin with ", ", or prints "none".
joined() { paste -sd, - | sed 's/,/, /g' | grep . || echo none; }
lines() { grep -c . "$1" || true; }

printf 'Mode: %s\n' "$MODE"
printf 'Actors: %s\n' "$(sed 's|^actores/||' "$WORK/actors" | joined)"
printf 'Products: %s\n' "$(joined <"$WORK/products")"
printf 'Videos: %s\n' "$(joined <"$WORK/videos")"
[ -s "$WORK/missing" ] &&
  printf 'Actors not in this studio (their videos go without them): %s\n' "$(joined <"$WORK/missing")"
if [ $MODE = light ]; then
  printf 'Left out: %s drafts (they stay as Higgsfield links), %s portrait candidates\n' \
    "$(lines "$WORK/drafts")" "$(lines "$WORK/candidates")"
fi
printf 'Size: %s\n' "$(human "$(bytes "$WORK/keep")")"
printf 'Size complete: %s\n' "$(human "$(bytes "$WORK/all")")"
[ $PLAN -eq 1 ] && exit 0
[ -s "$WORK/keep" ] || die "nothing to export"

# JSON array of the lines of a file.
json_list() {
  sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' "$1" |
    awk 'BEGIN { ORS = ""; print "[" } NF { if (n++) print ", "; print "\"" $0 "\"" } END { print "]" }'
}
version=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
  "$PLUGIN/.claude-plugin/plugin.json" | head -n 1)
sed 's|^actores/||' "$WORK/actors" >"$WORK/actor-ids"
{
  printf '{\n'
  printf '  "format": "ugc-studio-package",\n'
  printf '  "formatVersion": 1,\n'
  printf '  "plugin": "%s",\n' "$version"
  printf '  "mode": "%s",\n' "$MODE"
  printf '  "exportedAt": "%s",\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '  "actors": %s,\n' "$(json_list "$WORK/actor-ids")"
  printf '  "products": %s,\n' "$(json_list "$WORK/products")"
  printf '  "videos": %s,\n' "$(json_list "$WORK/videos")"
  printf '  "omitted": %s\n' "$(json_list "$WORK/omitted")"
  printf '}\n'
} >"$WORK/manifest.json"

mkdir -p exportaciones
base="exportaciones/$(date +%Y-%m-%d)-$NAME"
out="$base.zip"
n=2
while [ -e "$out" ]; do
  out="$base-$n.zip"
  n=$((n + 1))
done
out="$ROOT/$out"
partial="$out.partial"
rm -f "$partial"

if command -v zip >/dev/null 2>&1; then
  # Media is already compressed: store it as is, which is much faster.
  zip -q -X -n .mp4:.mov:.png:.jpg:.jpeg:.webp "$partial" -@ <"$WORK/keep" &&
    (cd "$WORK" && zip -q -X "$partial" manifest.json)
elif command -v python3 >/dev/null 2>&1; then
  python3 -c '
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED) as z:
    z.write(sys.argv[2], "manifest.json")
    for line in open(sys.argv[3], encoding="utf-8"):
        z.write(line.rstrip("\n"))
' "$partial" "$WORK/manifest.json" "$WORK/keep"
else
  false
fi || { rm -f "$partial"; die "could not create the package (no zip or python3 on this computer)"; }
mv "$partial" "$out"

printf 'Package: %s\n' "$out"
printf 'Package size: %s\n' "$(human "$(ls -ln "$out" | awk '{ print $5 }')")"
