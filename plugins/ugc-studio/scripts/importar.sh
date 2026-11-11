#!/bin/sh
# Imports a package made by exportar.sh into the studio.
#
#   importar.sh <package.zip>
#       Preview: print every element of the package and its state, and write nothing.
#         new       not in the studio; it is copied
#         same      already in the studio with the same files; it is skipped
#         adds      in the studio, and the package only adds files (for example the drafts of a
#                   light export); the missing files are copied, nothing is replaced
#         conflict  in the studio with different content; needs a decision
#       Every conflict comes with a proposed decision.
#
#   importar.sh --aplicar [--omitir <path>]... [--renombrar <path>=<new-id>]... <package.zip>
#       Import. Every conflict needs --omitir (keep the studio's element) or --renombrar (import it
#       under a new id; actors and videos only). Nothing in the studio is ever replaced.
#
# The package is checked before anything is written: only manifest.json, actores/ and clientes/,
# no path that climbs out, no symbolic links, valid JSON. Uses only tools that macOS ships with.

set -u
LC_ALL=C
export LC_ALL

die() { printf 'UGC Studio: %s\n' "$1" >&2; exit 1; }

ROOT=${CLAUDE_PROJECT_DIR:-$PWD}
[ -f "$ROOT/studio.json" ] || die "not a UGC Studio folder (no studio.json): $ROOT"
PLUGIN=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}

APPLY=0
ZIP=""
WORK=$(mktemp -d) || exit 1
trap 'rm -rf "$WORK"' EXIT
: >"$WORK/omit"
: >"$WORK/rename"

while [ $# -gt 0 ]; do
  case $1 in
    --aplicar) APPLY=1 ;;
    --omitir)
      [ $# -ge 2 ] || die "--omitir needs a path"
      printf '%s\n' "${2%/}" >>"$WORK/omit"
      shift
      ;;
    --renombrar)
      [ $# -ge 2 ] || die "--renombrar needs <path>=<new-id>"
      case $2 in *=*) ;; *) die "--renombrar needs <path>=<new-id>: $2" ;; esac
      p=${2%%=*}
      printf '%s\t%s\n' "${p%/}" "${2#*=}" >>"$WORK/rename"
      shift
      ;;
    -*) die "unknown option: $1" ;;
    *) [ -z "$ZIP" ] || die "one package at a time, nothing imported: $ZIP and $1"; ZIP=$1 ;;
  esac
  shift
done
[ -n "$ZIP" ] || die "say which package to import"
[ -f "$ZIP" ] || die "Not found: $ZIP"
case $ZIP in /*) ;; *) ZIP="$PWD/$ZIP" ;; esac
cd "$ROOT" || exit 1

field() { sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$2" | head -n 1; }

# --- 1. Check the package before unpacking it ---------------------------------------------------
unzip -Z1 "$ZIP" >"$WORK/entries" 2>/dev/null ||
  die "Not a UGC Studio package (cannot read it as a zip): $ZIP"
bad=$(awk '
  $0 == "manifest.json" { next }
  /^(actores|clientes)\// && !/(^|\/)\.\.?(\/|$)/ && !/\\/ && !/\/\// { next }
  { print; exit }' "$WORK/entries")
[ -z "$bad" ] || die "Unsafe package, nothing imported: it holds $bad"
if unzip -Z "$ZIP" 2>/dev/null | grep -q '^l'; then
  die "Unsafe package, nothing imported: it holds a symbolic link"
fi
grep -qx manifest.json "$WORK/entries" || die "Not a UGC Studio package (no manifest.json): $ZIP"
dup=$(sed 's|/$||' "$WORK/entries" | sort | uniq -d | head -n 1)
[ -z "$dup" ] || die "Unsafe package, nothing imported: it holds $dup twice"

STAGE="$WORK/stage"
mkdir "$STAGE"
unzip -q -n "$ZIP" -d "$STAGE" </dev/null 2>"$WORK/unzip.err" ||
  die "could not unpack the package: $(head -n 3 "$WORK/unzip.err")"
[ -z "$(find "$STAGE" -type l | head -n 1)" ] ||
  die "Unsafe package, nothing imported: it holds a symbolic link"
grep -q '"format"[[:space:]]*:[[:space:]]*"ugc-studio-package"' "$STAGE/manifest.json" ||
  die "Not a UGC Studio package (unknown manifest): $ZIP"

validate() {
  if [ "$(uname)" = Darwin ] && command -v osascript >/dev/null 2>&1; then
    osascript -l JavaScript "$PLUGIN/scripts/validar-json.js" "$@" 2>&1 | grep -v '^$'
  elif command -v node >/dev/null 2>&1; then
    node "$PLUGIN/scripts/validar-json.js" "$@"
  fi
  return 0
}
broken=$(cd "$STAGE" && find . -type f -name '*.json' | sed 's|^\./||' | sort | {
  set --
  while IFS= read -r f; do set -- "$@" "$f"; done
  validate "$@"
})
[ -z "$broken" ] || die "the package has broken JSON, nothing imported:
$broken"

MODE=$(field mode "$STAGE/manifest.json")
EXPORTED=$(field exportedAt "$STAGE/manifest.json")

# --- 2. Elements and their state ----------------------------------------------------------------
# One line per element: kind, path, state, files that differ, files the studio lacks.
(
  cd "$STAGE" || exit 1
  for f in actores/*/actor.json; do [ -f "$f" ] && printf 'actor\t%s\n' "${f%/actor.json}"; done
  for f in clientes/*/*/producto.json; do [ -f "$f" ] && printf 'product\t%s\n' "${f%/producto.json}"; done
  for f in clientes/*/*/videos/*/video.json; do [ -f "$f" ] && printf 'video\t%s\n' "${f%/video.json}"; done
) >"$WORK/elements"
[ -s "$WORK/elements" ] || die "the package holds no actor, product or video: $ZIP"

# Actor and video ids follow the naming rules (workspace.md); the scripts rely on it.
valid_id() { case $1 in '' | -* | *[!a-z0-9-]*) return 1 ;; esac; }
while IFS="$(printf '\t')" read -r kind path; do
  [ "$kind" = product ] && continue
  valid_id "${path##*/}" || die "the package breaks the naming rules, nothing imported: $path"
  if [ "$kind" = video ]; then
    a=$(field actorId "$STAGE/$path/video.json")
    [ -z "$a" ] || valid_id "$a" || die "the package breaks the naming rules, nothing imported: actorId $a in $path"
  fi
done <"$WORK/elements"

# Files of an element in the package, relative to the studio.
files_of() {
  (cd "$STAGE" && case $1 in
    product) find "$2" -path "$2/videos" -prune -o -type f -print ;;
    *) find "$2" -type f ;;
  esac) | sort
}
marker() { case $1 in actor) echo actor.json ;; product) echo producto.json ;; video) echo video.json ;; esac; }

: >"$WORK/states"
while IFS="$(printf '\t')" read -r kind path; do
  differ=0
  missing=0
  files_of "$kind" "$path" >"$WORK/files"
  while IFS= read -r f; do
    if [ ! -e "$f" ]; then
      missing=$((missing + 1))
    elif ! cmp -s "$STAGE/$f" "$f"; then
      differ=$((differ + 1))
    fi
  done <"$WORK/files"
  if [ $differ -eq 0 ] && [ $missing -eq 0 ]; then
    state=same
  elif [ $differ -gt 0 ]; then
    state=conflict
  elif [ -f "$path/$(marker "$kind")" ]; then
    state=adds
  else
    state=new
  fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$kind" "$path" "$state" "$differ" "$missing" >>"$WORK/states"
done <"$WORK/elements"

taken() {
  [ -e "$1" ] || [ -e "$STAGE/$1" ] ||
    awk -F '\t' -v t="$1" '{ split($1, a, "/"); d = $1; sub(/\/[^\/]*$/, "", d) } d "/" $2 == t { f = 1 } END { exit !f }' "$WORK/rename"
}

# Proposes a free id: martin-v1 -> martin-v2, a video id -> <id>-2.
propose() {
  kind=$1
  path=$2
  dir=${path%/*}
  id=${path##*/}
  if [ "$kind" = actor ]; then
    stem=$(printf '%s' "$id" | sed 's/-v[0-9]*$//')
    n=$(printf '%s' "$id" | sed -n 's/.*-v\([0-9]*\)$/\1/p')
    n=$(awk -v n="${n:-1}" 'BEGIN { print n + 1 }')
    while taken "$dir/$stem-v$n"; do n=$((n + 1)); done
    printf '%s-v%s' "$stem" "$n"
  else
    n=2
    while taken "$dir/$id-$n"; do n=$((n + 1)); done
    printf '%s-%s' "$id" "$n"
  fi
}

# --- 3. Check the decisions ---------------------------------------------------------------------
while IFS= read -r p; do
  awk -F '\t' -v p="$p" '$2 == p { f = 1 } END { exit !f }' "$WORK/states" || die "Not in the package: $p"
done <"$WORK/omit"
while IFS="$(printf '\t')" read -r p new; do
  kind=$(awk -F '\t' -v p="$p" '$2 == p { print $1; exit }' "$WORK/states")
  [ -n "$kind" ] || die "Not in the package: $p"
  grep -qxF "$p" "$WORK/omit" && die "choose either --omitir or --renombrar for $p"
  [ "$kind" = product ] && die "a product keeps the id of its platform and cannot be renamed: $p (use --omitir)"
  valid_id "$new" || die "new id must use lowercase letters, digits and -: $new"
  if [ "$kind" = actor ]; then
    printf '%s' "$new" | grep -Eq -- '-v[0-9]+$' || die "an actor id ends in -v<number>: $new"
  fi
  target="${p%/*}/$new"
  { [ -e "$target" ] || [ -e "$STAGE/$target" ]; } && die "$target already exists"
  [ "$(awk -F '\t' -v t="$target" '{ d = $1; sub(/\/[^\/]*$/, "", d) } d "/" $2 == t' "$WORK/rename" | wc -l)" -gt 1 ] &&
    die "two elements renamed to $target"
  printf '%s' "${p##*/}" | grep -Eq '^[a-z0-9][a-z0-9-]*$' || die "cannot rename $p: its id breaks the naming rules"
done <"$WORK/rename"

renamed() { awk -F '\t' -v p="$1" '$1 == p { print $2; exit }' "$WORK/rename"; }
omitted() { grep -qxF "$1" "$WORK/omit"; }

# --- 4. Preview ---------------------------------------------------------------------------------
if [ $APPLY -eq 0 ]; then
  printf 'Package: %s\n' "${ZIP##*/}"
  printf 'Mode: %s. Exported: %s\n' "${MODE:-unknown}" "${EXPORTED:-unknown}"
  while IFS="$(printf '\t')" read -r kind path state differ missing; do
    case $state in
      conflict) note="  ($differ files differ, $missing new)" ;;
      adds) note="  ($missing new files, nothing replaced)" ;;
      *) note="" ;;
    esac
    printf '%-9s %-8s %s%s\n' "$state" "$kind" "$path" "$note"
    if [ "$state" = conflict ]; then
      if [ "$kind" = product ]; then
        printf '          Proposed: --omitir %s (keep the studio'"'"'s product; its videos still import)\n' "$path"
      else
        printf '          Proposed: --renombrar %s=%s\n' "$path" "$(propose "$kind" "$path")"
      fi
    fi
  done <"$WORK/states"
  n=$(sed -n '/"omitted"/,$p' "$STAGE/manifest.json" | grep -o 'borrador-v[0-9]*\.mp4' | wc -l | tr -d ' ')
  [ "${n:-0}" -gt 0 ] && printf 'Drafts left out of the package: %s (Higgsfield links in video.json)\n' "$n"
  exit 0
fi

# --- 5. Apply -----------------------------------------------------------------------------------
undecided=$(awk -F '\t' '$3 == "conflict" { print $2 }' "$WORK/states" | while IFS= read -r p; do
  omitted "$p" || [ -n "$(renamed "$p")" ] || printf '%s\n' "$p"
done)
[ -z "$undecided" ] || die "these conflicts need --omitir or --renombrar, nothing imported:
$undecided"

# Plan every copy first and make sure none would replace a file.
: >"$WORK/copies"
: >"$WORK/imported"
: >"$WORK/actor-renames"
while IFS="$(printf '\t')" read -r kind path state differ missing; do
  omitted "$path" && continue
  new=$(renamed "$path")
  [ "$state" = same ] && [ -z "$new" ] && continue
  target=$path
  [ -n "$new" ] && target="${path%/*}/$new"
  files_of "$kind" "$path" | while IFS= read -r f; do
    dest="$target${f#"$path"}"
    if [ -z "$new" ] && [ -e "$dest" ]; then continue; fi # already there and identical
    printf '%s\t%s\n' "$f" "$dest"
  done >>"$WORK/copies"
  printf '%s\t%s\t%s\n' "$kind" "$path" "$target" >>"$WORK/imported"
  [ "$kind" = actor ] && [ -n "$new" ] && printf '%s\t%s\n' "${path##*/}" "$new" >>"$WORK/actor-renames"
done <"$WORK/states"

if [ ! -s "$WORK/imported" ]; then
  printf 'Nothing to import: everything in the package is already in the studio or left out.\n'
  exit 0
fi
while IFS="$(printf '\t')" read -r src dest; do
  { [ -e "$dest" ] || [ -L "$dest" ]; } && die "$dest already exists, nothing imported"
done <"$WORK/copies"

while IFS="$(printf '\t')" read -r src dest; do
  mkdir -p "${dest%/*}" && cp "$STAGE/$src" "$dest" || die "could not copy $dest (import stopped halfway)"
done <"$WORK/copies"

# Replaces "<key>": "<old>" with "<key>": "<new>" in a JSON file (ids are [a-z0-9-]).
set_field() {
  sed "s/\"$2\"\\([[:space:]]*:[[:space:]]*\\)\"$3\"/\"$2\"\\1\"$4\"/" "$1" >"$1.tmp.$$" && mv "$1.tmp.$$" "$1"
}
while IFS="$(printf '\t')" read -r kind path target; do
  [ "$path" = "$target" ] && continue
  old=${path##*/}
  new=${target##*/}
  if [ "$kind" = actor ]; then
    set_field "$target/actor.json" id "$old" "$new"
    oldv=$(field version "$target/actor.json")
    printf '%s' "$oldv" | grep -Eq '^v[0-9]+$' && set_field "$target/actor.json" version "$oldv" "v${new##*-v}"
  else
    set_field "$target/video.json" id "$old" "$new"
  fi
done <"$WORK/imported"
# Only videos whose video.json this import wrote: a video already in the studio is never changed.
awk -F '\t' '$2 ~ /\/video\.json$/ { sub(/\/video\.json$/, "", $2); print $2 }' "$WORK/copies" | while IFS= read -r v; do
  while IFS="$(printf '\t')" read -r old new; do
    set_field "$v/video.json" actorId "$old" "$new"
  done <"$WORK/actor-renames"
done

# --- 6. Report ----------------------------------------------------------------------------------
printf 'Imported: %s\n' "$(cut -f3 "$WORK/imported" | paste -sd, - | sed 's/,/, /g')"
kept=$(awk -F '\t' '$3 == "same" { print $2 }' "$WORK/states" | paste -sd, - | sed 's/,/, /g')
[ -n "$kept" ] && printf 'Already in the studio: %s\n' "$kept"
[ -s "$WORK/omit" ] && printf 'Kept the studio'"'"'s: %s\n' "$(paste -sd, "$WORK/omit" | sed 's/,/, /g')"

# Drafts the light package left out, under their folder in this studio, when they are not here.
drafts=$(sed -n '/"omitted"/,$p' "$STAGE/manifest.json" | grep -o '"[^"]*borrador-v[0-9]*\.mp4"' | tr -d '"' |
  while IFS= read -r d; do
    dir=${d%/*}
    target=$(awk -F '\t' -v p="$dir" '$1 == "video" && $2 == p { print $3; exit }' "$WORK/imported")
    [ -n "$target" ] || continue
    [ -e "$target/${d##*/}" ] || printf '%s\n' "$target/${d##*/}"
  done | paste -sd, - | sed 's/,/, /g')
[ -n "$drafts" ] && printf 'Drafts left out: %s (download them from Higgsfield with the jobId in video.json)\n' "$drafts"

no_actor=$(awk -F '\t' '$1 == "video" { print $3 }' "$WORK/imported" | while IFS= read -r v; do
  a=$(field actorId "$v/video.json")
  [ -n "$a" ] && [ ! -f "actores/$a/actor.json" ] && printf '%s (%s)\n' "$v" "$a"
done | paste -sd, - | sed 's/,/, /g')
[ -n "$no_actor" ] && printf 'Videos whose actor is not in this studio: %s\n' "$no_actor"
exit 0
