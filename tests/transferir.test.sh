#!/bin/sh
# Tests for plugins/ugc-studio/scripts/exportar.sh and importar.sh, run against throwaway studios.
#
#   sh tests/transferir.test.sh
#
# Needs unzip, and zip or python3 (to build packages and the unsafe ones). Prints one line per
# check and exits 1 if any fails.

set -u
REPO=$(cd "$(dirname "$0")/.." && pwd)
EXPORT="$REPO/plugins/ugc-studio/scripts/exportar.sh"
IMPORT="$REPO/plugins/ugc-studio/scripts/importar.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export CLAUDE_PLUGIN_ROOT="$REPO/plugins/ugc-studio"
TODAY=$(date +%Y-%m-%d)

fails=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; fails=$((fails + 1)); }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (expected [$3], got [$2])"; fi; }
has() { case $2 in *"$3"*) pass "$1" ;; *) fail "$1 (no [$3] in [$2])" ;; esac; }
lacks() { case $2 in *"$3"*) fail "$1 ([$3] found in [$2])" ;; *) pass "$1" ;; esac; }

# Runs a script in a studio; sets OUT, ERR and CODE.
run() {
  dir=$1
  script=$2
  shift 2
  CLAUDE_PROJECT_DIR=$dir sh "$script" "$@" >"$TMP/out" 2>"$TMP/err"
  CODE=$?
  OUT=$(cat "$TMP/out")
  ERR=$(cat "$TMP/err")
}

# Every file of a folder with its checksum, to prove a command changed nothing.
tree() { (cd "$1" && find . -type f | sort | while IFS= read -r f; do cksum "$f"; done); }
entries() { unzip -Z1 "$1" | sort | tr '\n' ' '; }

empty_studio() {
  mkdir -p "$TMP/$1/actores" "$TMP/$1/clientes"
  printf '{"credits": {"available": 5}}\n' >"$TMP/$1/studio.json"
  printf '%s' "$TMP/$1"
}

full_studio() {
  s=$(empty_studio "$1")
  mkdir -p "$s/actores/martin-v1/candidatos" "$s/actores/luna-v1"
  printf '{"id": "martin-v1", "name": "Martín", "version": "v1"}\n' >"$s/actores/martin-v1/actor.json"
  printf 'retrato' >"$s/actores/martin-v1/retrato.png"
  printf 'cand' >"$s/actores/martin-v1/candidatos/candidato-1.png"
  printf '{"id": "luna-v1", "name": "Luna", "version": "v1"}\n' >"$s/actores/luna-v1/actor.json"
  p="$s/clientes/acme/MLA1"
  mkdir -p "$p/fotos" "$p/videos/2026-01-01-patas-idea"
  printf '{"title": "Patas"}\n' >"$p/producto.json"
  printf '# Patas\n' >"$p/ficha.md"
  printf 'foto' >"$p/fotos/foto-1.jpg"
  v="$p/videos/2026-01-01-patas-idea"
  printf '{"id": "2026-01-01-patas-idea", "actorId": "martin-v1", "status": "final", "versions": [{"n": 1, "jobId": "j1"}, {"n": 2, "jobId": "j2"}]}\n' >"$v/video.json"
  printf 'escena' >"$v/escena-1.png"
  printf 'v1' >"$v/borrador-v1.mp4"
  printf 'v2' >"$v/borrador-v2.mp4"
  printf 't1' >"$v/thumb-v1.jpg"
  printf 'final' >"$v/final.mp4"
  mkdir -p "$s/clientes/acme/MLA2/fotos" "$s/clientes/beta/MLB1"
  printf '{"title": "Sommier"}\n' >"$s/clientes/acme/MLA2/producto.json"
  printf '{"title": "Otro"}\n' >"$s/clientes/beta/MLB1/producto.json"
  printf '%s' "$s"
}

VIDEO=clientes/acme/MLA1/videos/2026-01-01-patas-idea

# --- export: refusals ---------------------------------------------------------------------------
mkdir -p "$TMP/plain"
run "$TMP/plain" "$EXPORT" todo
check "export outside a studio: exit 1" "$CODE" "1"
has "export outside a studio: says why" "$ERR" "not a UGC Studio"

A=$(full_studio a)
run "$A" "$EXPORT" actores/nadie-v1
check "export unknown element: exit 1" "$CODE" "1"
has "export unknown element: names it" "$ERR" "Not found: actores/nadie-v1"
run "$A" "$EXPORT" ../afuera
check "export path outside the studio: exit 1" "$CODE" "1"
run "$A" "$EXPORT" --nombre 'Mal Nombre' todo
check "export bad package name: exit 1" "$CODE" "1"

# --- export: plan -------------------------------------------------------------------------------
run "$A" "$EXPORT" --plan "$VIDEO"
check "plan: exit 0" "$CODE" "0"
has "plan: light by default" "$OUT" "Mode: light"
has "plan: actor of the video" "$OUT" "Actors: martin-v1"
has "plan: product of the video" "$OUT" "Products: clientes/acme/MLA1"
has "plan: the video" "$OUT" "Videos: $VIDEO"
has "plan: drafts left out" "$OUT" "Left out: 2 drafts"
has "plan: both sizes" "$OUT" "Size complete:"
[ -e "$A/exportaciones" ] && fail "plan: writes nothing" || pass "plan: writes nothing"

# --- export: light video ------------------------------------------------------------------------
run "$A" "$EXPORT" --nombre video-patas "$VIDEO"
check "light export: exit 0" "$CODE" "0"
ZIP="$A/exportaciones/$TODAY-video-patas.zip"
has "light export: prints the absolute path" "$OUT" "Package: $ZIP"
E=$(entries "$ZIP")
has "light export: manifest" "$E" "manifest.json"
has "light export: actor portrait" "$E" "actores/martin-v1/retrato.png"
lacks "light export: no portrait candidates" "$E" "candidatos"
has "light export: product sheet" "$E" "clientes/acme/MLA1/ficha.md"
has "light export: product photo" "$E" "clientes/acme/MLA1/fotos/foto-1.jpg"
has "light export: final video" "$E" "$VIDEO/final.mp4"
lacks "light export: no drafts" "$E" "borrador-"
lacks "light export: no other product" "$E" "MLA2"
lacks "light export: no unrelated actor" "$E" "luna-v1"
M=$(unzip -p "$ZIP" manifest.json)
has "manifest: format" "$M" '"format": "ugc-studio-package"'
has "manifest: mode" "$M" '"mode": "light"'
has "manifest: omitted drafts" "$M" "$VIDEO/borrador-v2.mp4"
printf '%s' "$M" | node -e 'JSON.parse(require("fs").readFileSync(0, "utf8"))' 2>/dev/null &&
  pass "manifest: valid JSON" || fail "manifest: valid JSON"

run "$A" "$EXPORT" --nombre video-patas "$VIDEO"
has "same name again: numbered, never overwritten" "$OUT" "$TODAY-video-patas-2.zip"

# --- export: complete, actor, client, studio ----------------------------------------------------
run "$A" "$EXPORT" --completo --nombre completo "$VIDEO"
E=$(entries "$A/exportaciones/$TODAY-completo.zip")
has "complete export: drafts" "$E" "$VIDEO/borrador-v2.mp4"
has "complete export: candidates" "$E" "candidatos/candidato-1.png"

run "$A" "$EXPORT" --nombre actor actores/luna-v1
E=$(entries "$A/exportaciones/$TODAY-actor.zip")
has "actor export: the actor" "$E" "actores/luna-v1/actor.json"
lacks "actor export: nothing else" "$E" "clientes/"

run "$A" "$EXPORT" --nombre cliente clientes/acme
E=$(entries "$A/exportaciones/$TODAY-cliente.zip")
has "client export: first product" "$E" "clientes/acme/MLA1/producto.json"
has "client export: second product" "$E" "clientes/acme/MLA2/producto.json"
has "client export: its videos" "$E" "$VIDEO/video.json"
has "client export: actors its videos use" "$E" "actores/martin-v1/actor.json"
lacks "client export: no other client" "$E" "clientes/beta"
lacks "client export: no unused actor" "$E" "luna-v1"

run "$A" "$EXPORT" --nombre studio todo
E=$(entries "$A/exportaciones/$TODAY-studio.zip")
has "studio export: every actor" "$E" "actores/luna-v1/actor.json"
has "studio export: every client" "$E" "clientes/beta/MLB1/producto.json"
lacks "studio export: not the studio settings" "$E" "studio.json"
lacks "studio export: not earlier packages" "$E" "exportaciones/"

# --- import: refusals ---------------------------------------------------------------------------
B=$(empty_studio b)
printf 'not a zip' >"$TMP/falso.zip"
run "$B" "$IMPORT" "$TMP/falso.zip"
check "import a file that is not a package: exit 1" "$CODE" "1"
run "$B" "$IMPORT" "$TMP/no-existe.zip"
check "import a missing file: exit 1" "$CODE" "1"
run "$TMP/plain" "$IMPORT" "$ZIP"
check "import outside a studio: exit 1" "$CODE" "1"
run "$B" "$IMPORT" --aplicar "$ZIP" "$ZIP"
check "two packages at once: exit 1" "$CODE" "1"

# --- import: preview, apply, again --------------------------------------------------------------
before=$(tree "$B")
run "$B" "$IMPORT" "$ZIP"
check "preview: exit 0" "$CODE" "0"
has "preview: new actor" "$OUT" "new       actor    actores/martin-v1"
has "preview: new product" "$OUT" "new       product  clientes/acme/MLA1"
has "preview: new video" "$OUT" "new       video    $VIDEO"
has "preview: package mode" "$OUT" "Mode: light"
check "preview: writes nothing" "$(tree "$B")" "$before"

run "$B" "$IMPORT" --aplicar "$ZIP"
check "apply: exit 0" "$CODE" "0"
cmp -s "$A/$VIDEO/final.mp4" "$B/$VIDEO/final.mp4" && pass "apply: video copied" || fail "apply: video copied"
cmp -s "$A/actores/martin-v1/actor.json" "$B/actores/martin-v1/actor.json" && pass "apply: actor copied" || fail "apply: actor copied"
cmp -s "$A/clientes/acme/MLA1/fotos/foto-1.jpg" "$B/clientes/acme/MLA1/fotos/foto-1.jpg" && pass "apply: photo copied" || fail "apply: photo copied"
[ -e "$B/manifest.json" ] && fail "apply: manifest not copied" || pass "apply: manifest not copied"
has "apply: drafts to download from Higgsfield" "$OUT" "Drafts left out: $VIDEO/borrador-v1.mp4"
CLAUDE_PROJECT_DIR=$B sh "$CLAUDE_PLUGIN_ROOT/scripts/sincronizar.sh" >/dev/null 2>&1
check "apply: gallery sync accepts the result" "$?" "0"

before=$(tree "$B")
run "$B" "$IMPORT" "$ZIP"
has "again: actor already there" "$OUT" "same      actor    actores/martin-v1"
has "again: video already there" "$OUT" "same      video    $VIDEO"
run "$B" "$IMPORT" --aplicar "$ZIP"
check "again: exit 0" "$CODE" "0"
has "again: nothing to import" "$OUT" "Nothing to import"
check "again: writes nothing" "$(tree "$B")" "$before"

# --- import: a complete package over a light import only adds the drafts ------------------------
printf 'mio' >"$B/$VIDEO/notas.txt"
run "$B" "$IMPORT" "$A/exportaciones/$TODAY-completo.zip"
has "complete over light: video adds files" "$OUT" "adds      video    $VIDEO"
run "$B" "$IMPORT" --aplicar "$A/exportaciones/$TODAY-completo.zip"
check "complete over light: exit 0" "$CODE" "0"
cmp -s "$A/$VIDEO/borrador-v2.mp4" "$B/$VIDEO/borrador-v2.mp4" && pass "complete over light: drafts added" || fail "complete over light: drafts added"
check "complete over light: own files kept" "$(cat "$B/$VIDEO/notas.txt")" "mio"

# --- import: conflicts --------------------------------------------------------------------------
C=$(empty_studio c)
mkdir -p "$C/actores/martin-v1"
printf '{"id": "martin-v1", "name": "Otro Martín", "version": "v1"}\n' >"$C/actores/martin-v1/actor.json"
before=$(tree "$C")
run "$C" "$IMPORT" "$ZIP"
has "conflict: reported" "$OUT" "conflict  actor    actores/martin-v1"
has "conflict: proposes a free name" "$OUT" "Proposed: --renombrar actores/martin-v1=martin-v2"
run "$C" "$IMPORT" --aplicar "$ZIP"
check "undecided conflict: exit 1" "$CODE" "1"
has "undecided conflict: names it" "$ERR" "actores/martin-v1"
check "undecided conflict: writes nothing" "$(tree "$C")" "$before"

run "$C" "$IMPORT" --aplicar --renombrar clientes/acme/MLA1=otro "$ZIP"
check "rename a product: exit 1" "$CODE" "1"
run "$C" "$IMPORT" --aplicar --renombrar actores/martin-v1=martin-v1 "$ZIP"
check "rename to a taken name: exit 1" "$CODE" "1"
run "$C" "$IMPORT" --aplicar --renombrar actores/martin-v1=Martin "$ZIP"
check "rename to an invalid id: exit 1" "$CODE" "1"
check "refused renames: write nothing" "$(tree "$C")" "$before"

run "$C" "$IMPORT" --aplicar --renombrar actores/martin-v1=martin-v2 "$ZIP"
check "rename: exit 0" "$CODE" "0"
check "rename: local actor untouched" "$(cat "$C/actores/martin-v1/actor.json")" '{"id": "martin-v1", "name": "Otro Martín", "version": "v1"}'
has "rename: new actor id" "$(cat "$C/actores/martin-v2/actor.json")" '"id": "martin-v2"'
has "rename: new actor version" "$(cat "$C/actores/martin-v2/actor.json")" '"version": "v2"'
cmp -s "$A/actores/martin-v1/retrato.png" "$C/actores/martin-v2/retrato.png" && pass "rename: actor files copied" || fail "rename: actor files copied"
has "rename: video uses the renamed actor" "$(cat "$C/$VIDEO/video.json")" '"actorId": "martin-v2"'

D=$(empty_studio d)
mkdir -p "$D/actores/martin-v1"
printf '{"id": "martin-v1", "name": "Mío"}\n' >"$D/actores/martin-v1/actor.json"
run "$D" "$IMPORT" --aplicar --omitir actores/martin-v1 "$ZIP"
check "omit: exit 0" "$CODE" "0"
check "omit: local actor kept" "$(cat "$D/actores/martin-v1/actor.json")" '{"id": "martin-v1", "name": "Mío"}'
has "omit: video still imported" "$(cat "$D/$VIDEO/video.json")" '"actorId": "martin-v1"'

V=$(empty_studio v)
mkdir -p "$V/$VIDEO"
printf '{"id": "2026-01-01-patas-idea", "title": "Mío"}\n' >"$V/$VIDEO/video.json"
run "$V" "$IMPORT" "$ZIP"
has "video conflict: proposes a free name" "$OUT" "Proposed: --renombrar $VIDEO=2026-01-01-patas-idea-2"
run "$V" "$IMPORT" --aplicar --renombrar "$VIDEO=2026-01-01-patas-idea-2" "$ZIP"
check "video rename: exit 0" "$CODE" "0"
has "video rename: new id" "$(cat "$V/$VIDEO-2/video.json")" '"id": "2026-01-01-patas-idea-2"'
has "video rename: drafts reported under the new folder" "$OUT" "$VIDEO-2/borrador-v1.mp4"

# --- import: unsafe or damaged packages ---------------------------------------------------------
# Builds a zip from "name=content" pairs; "link:name=target" stores a symbolic link.
make_zip() {
  python3 - "$@" <<'EOF'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], "w") as z:
    for spec in sys.argv[2:]:
        name, _, content = spec.partition("=")
        if name.startswith("link:"):
            info = zipfile.ZipInfo(name[5:])
            info.external_attr = (0o120777 << 16)
            z.writestr(info, content)
        else:
            z.writestr(name, content)
EOF
}
MAN='manifest.json={"format": "ugc-studio-package", "formatVersion": 1, "mode": "light", "omitted": []}'
E=$(empty_studio e)
before=$(tree "$E")
make_zip "$TMP/escape.zip" "$MAN" '../../afuera.txt=x'
run "$E" "$IMPORT" --aplicar "$TMP/escape.zip"
check "path climbing out: exit 1" "$CODE" "1"
has "path climbing out: unsafe" "$ERR" "Unsafe package"
[ -e "$TMP/afuera.txt" ] && fail "path climbing out: nothing written outside" || pass "path climbing out: nothing written outside"

make_zip "$TMP/raro.zip" "$MAN" 'otra-cosa/x.txt=x'
run "$E" "$IMPORT" --aplicar "$TMP/raro.zip"
check "file outside actores/ and clientes/: exit 1" "$CODE" "1"

make_zip "$TMP/link.zip" "$MAN" 'actores/x-v1/actor.json={}' 'link:actores/x-v1/retrato.png=/etc/passwd'
run "$E" "$IMPORT" --aplicar "$TMP/link.zip"
check "symbolic link: exit 1" "$CODE" "1"
has "symbolic link: unsafe" "$ERR" "Unsafe package"

make_zip "$TMP/roto.zip" "$MAN" 'actores/x-v1/actor.json={"id": "x-v1",}'
run "$E" "$IMPORT" --aplicar "$TMP/roto.zip"
check "broken JSON: exit 1" "$CODE" "1"
has "broken JSON: names the file" "$ERR" "actores/x-v1/actor.json"

make_zip "$TMP/sin-manifest.zip" 'actores/x-v1/actor.json={}'
run "$E" "$IMPORT" "$TMP/sin-manifest.zip"
check "no manifest: exit 1" "$CODE" "1"
check "damaged packages: write nothing" "$(tree "$E")" "$before"

# --- regressions found by verification ----------------------------------------------------------
R=$(empty_studio r)
make_zip "$TMP/l1.zip" "$MAN" 'actores/m-v1/actor.json={"id": "m-v1", "version": "v1"}' \
  'clientes/a/P/producto.json={}' 'clientes/a/P/videos/v/video.json={"id": "v", "actorId": "m-v1"}'
run "$R" "$IMPORT" --aplicar "$TMP/l1.zip"
make_zip "$TMP/c1.zip" "$MAN" 'actores/m-v1/actor.json={"id": "m-v1", "version": "v1", "note": "x"}' \
  'clientes/a/P/producto.json={}' 'clientes/a/P/videos/v/video.json={"id": "v", "actorId": "m-v1"}' \
  'clientes/a/P/videos/v/borrador-v1.mp4=D'
before=$(cksum <"$R/clientes/a/P/videos/v/video.json")
run "$R" "$IMPORT" --aplicar --renombrar actores/m-v1=m-v2 "$TMP/c1.zip"
check "rename actor over a video already here: exit 0" "$CODE" "0"
check "rename actor over a video already here: its video.json untouched" "$(cksum <"$R/clientes/a/P/videos/v/video.json")" "$before"
check "rename actor over a video already here: the draft is added" "$(cat "$R/clientes/a/P/videos/v/borrador-v1.mp4")" "D"

before=$(tree "$B")
run "$B" "$IMPORT" --aplicar --omitir same "$ZIP"
check "omit a value that is not a path: exit 1" "$CODE" "1"
check "omit a value that is not a path: writes nothing" "$(tree "$B")" "$before"

X=$(full_studio x)
printf '{"id": "v", "actorId": "../../a/actores/martin-v1"}\n' >"$X/$VIDEO/video.json"
run "$X" "$EXPORT" --nombre fuera "$VIDEO"
lacks "export: never follows an actorId out of the studio" "$(unzip -Z1 "$X/exportaciones/$TODAY-fuera.zip" 2>/dev/null)" "../"
run "$X" "$EXPORT" --nombre "$(printf 'a\nb')" todo
check "export: name with a newline refused" "$CODE" "1"
run "$X" "$EXPORT" clientes/acme/./MLA1
check "export: ./ in a path refused" "$CODE" "1"

before=$(tree "$E")
make_zip "$TMP/dup.zip" "$MAN" 'actores/x-v1/actor.json={}' 'actores/x-v1/actor.json={"id": "evil"}' 2>/dev/null
run "$E" "$IMPORT" --aplicar "$TMP/dup.zip" </dev/null
check "duplicate entries: exit 1" "$CODE" "1"
make_zip "$TMP/nombre.zip" "$MAN" 'actores/a(b)-v1/actor.json={}'
run "$E" "$IMPORT" --aplicar "$TMP/nombre.zip"
check "actor id breaking the naming rules: exit 1" "$CODE" "1"
make_zip "$TMP/actorid.zip" "$MAN" 'clientes/a/P/producto.json={}' 'clientes/a/P/videos/v/video.json={"actorId": "../x"}'
run "$E" "$IMPORT" --aplicar "$TMP/actorid.zip"
check "actorId breaking the naming rules: exit 1" "$CODE" "1"
check "refused packages: write nothing" "$(tree "$E")" "$before"

O=$(empty_studio o)
mkdir -p "$O/actores/m-v08"
printf '{"id": "m-v08"}\n' >"$O/actores/m-v08/actor.json"
make_zip "$TMP/v08.zip" "$MAN" 'actores/m-v08/actor.json={"id": "m-v08", "name": "otro"}'
run "$O" "$IMPORT" "$TMP/v08.zip"
has "proposal after a zero-padded version" "$OUT" "Proposed: --renombrar actores/m-v08=m-v9"

printf '\n%s\n' "$([ $fails -eq 0 ] && echo 'All checks passed.' || echo "$fails check(s) failed.")"
[ $fails -eq 0 ]
