#!/bin/sh
# Tests for plugins/ugc-studio/scripts/sincronizar.sh, run against throwaway studios.
#
#   sh tests/sincronizar.test.sh
#
# Needs Node (to validate JSON and to parse the generated index). Prints one line per check and
# exits 1 if any fails.

set -u
REPO=$(cd "$(dirname "$0")/.." && pwd)
SCRIPT="$REPO/plugins/ugc-studio/scripts/sincronizar.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export CLAUDE_PLUGIN_ROOT="$REPO/plugins/ugc-studio"

fails=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; fails=$((fails + 1)); }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (expected [$3], got [$2])"; fi; }

# Runs the script in a studio; sets OUT, ERR and CODE.
run() {
  dir=$1
  shift
  CLAUDE_PROJECT_DIR=$dir sh "$SCRIPT" "$@" >"$TMP/out" 2>"$TMP/err"
  CODE=$?
  OUT=$(cat "$TMP/out")
  ERR=$(cat "$TMP/err")
}

# Prints a value from the index: node expression over `e` (window.ESTUDIO).
index() {
  node -e 'global.window = {}; require(process.argv[1]); const e = window.ESTUDIO;
    console.log(eval(process.argv[2]))' "$1/.galeria/datos.js" "$2"
}

# Pause so file times differ from the index (some file systems keep whole seconds).
tick() { sleep 1; }

new_studio() {
  s="$TMP/$1"
  mkdir -p "$s/actores/ana-v1" "$s/clientes/acme/MLA1/fotos" "$s/clientes/acme/MLA1/videos/2026-01-01-x-y"
  printf '{"credits": {"available": 10}}\n' >"$s/studio.json"
  printf '{"id": "ana-v1", "name": "Ana"}\n' >"$s/actores/ana-v1/actor.json"
  : >"$s/actores/ana-v1/retrato.png"
  printf '{"title": "Producto"}\n' >"$s/clientes/acme/MLA1/producto.json"
  printf '{"title": "Video", "status": "draft", "versions": [{"n": 1}]}\n' \
    >"$s/clientes/acme/MLA1/videos/2026-01-01-x-y/video.json"
  printf '%s' "$s"
}

# --- outside a studio --------------------------------------------------------------------------
mkdir -p "$TMP/plain"
run "$TMP/plain"
check "outside a studio: exit 0" "$CODE" "0"
check "outside a studio: no output" "$OUT$ERR" ""
[ -e "$TMP/plain/.galeria" ] && fail "outside a studio: no .galeria folder" || pass "outside a studio: no .galeria folder"

# --- first build -------------------------------------------------------------------------------
S=$(new_studio a)
run "$S" --resumen
check "summary: exit 0" "$CODE" "0"
case $OUT in *"Actors: 1. Products: 1. Videos: 1 (storyboard 0, draft 1"*) pass "summary: counts" ;; *) fail "summary: counts ($OUT)" ;; esac
cmp -s "$CLAUDE_PLUGIN_ROOT/galeria/galeria.html" "$S/galeria.html" && pass "gallery copied" || fail "gallery copied"
check "index: entity kinds" "$(index "$S" 'e.entities.map((x) => x.kind).join(",")')" "actor,product,video"
check "index: actor files" "$(index "$S" 'e.entities[0].files.join(",")')" "actor.json,retrato.png"
check "index: product without photos" "$(index "$S" 'e.entities[1].files.join(",")')" "producto.json"
check "index: studio json" "$(index "$S" 'JSON.parse(e.studio).credits.available')" "10"

# --- file names that need escaping -------------------------------------------------------------
V="$S/clientes/acme/MLA1/videos/2026-01-01-x-y"
: >"$V/comi\"lla.png"
: >"$V/barra\\invertida.png"
: >"$V/$(printf 'retorno\r').png"
tick
run "$S"
check "odd names: exit 0" "$CODE" "0"
check "odd names: index parses with every file" \
  "$(index "$S" 'e.entities[2].files.filter((f) => f.endsWith(".png")).sort().join("|")')" \
  'barra\invertida.png|comi"lla.png|retorno.png'

# --- unchanged studio --------------------------------------------------------------------------
before=$(ls -l --time-style=+%s.%N "$S/.galeria/datos.js" 2>/dev/null || ls -lT "$S/.galeria/datos.js")
tick
run "$S"
after=$(ls -l --time-style=+%s.%N "$S/.galeria/datos.js" 2>/dev/null || ls -lT "$S/.galeria/datos.js")
check "unchanged: exit 0" "$CODE" "0"
check "unchanged: index not rebuilt" "$after" "$before"

# --- broken JSON keeps being reported until fixed ----------------------------------------------
A="$S/actores/ana-v1/actor.json"
cp "$A" "$TMP/actor.ok"
tick
printf '{"name": "Ana",}' >"$A"
run "$S"
check "broken: exit 2" "$CODE" "2"
case $ERR in *"actores/ana-v1/actor.json:"*) pass "broken: path reported" ;; *) fail "broken: path reported ($ERR)" ;; esac
check "broken: still indexed for the gallery notice" "$(index "$S" 'e.entities.filter((x) => x.kind === "actor").length')" "1"

tick
printf '{"title": "Producto 2"}\n' >"$S/clientes/acme/MLA1/producto.json"
run "$S"
check "broken, other file changed: exit 2" "$CODE" "2"
case $ERR in *"actores/ana-v1/actor.json:"*) pass "broken, other file changed: still reported" ;; *) fail "broken, other file changed: still reported ($ERR)" ;; esac

run "$S"
check "broken, nothing changed: exit 2" "$CODE" "2"
case $ERR in *"actores/ana-v1/actor.json: still not valid JSON"*) pass "broken, nothing changed: still reported" ;; *) fail "broken, nothing changed: still reported ($ERR)" ;; esac

tick
cp "$TMP/actor.ok" "$A"
run "$S"
check "fixed: exit 0" "$CODE" "0"
check "fixed: broken list empty" "$(cat "$S/.galeria/rotos.txt")" ""

tick
printf '{' >"$A"
run "$S"
check "broken again: exit 2" "$CODE" "2"
tick
rm -r "$S/actores/ana-v1"
run "$S"
check "broken file deleted: exit 0" "$CODE" "0"
check "broken file deleted: list empty" "$(cat "$S/.galeria/rotos.txt")" ""

# --- every build has its own id ----------------------------------------------------------------
b1=$(index "$S" 'e.build')
printf '{"credits": {"available": 11}}\n' >"$S/studio.json"
run "$S" --resumen
b2=$(index "$S" 'e.build')
[ -n "$b1" ] && [ "$b1" != "$b2" ] && pass "build id changes on every build" || fail "build id changes on every build ($b1 / $b2)"

# --- brand kits and creatives -----------------------------------------------------------------
C=$(new_studio c)
mkdir -p "$C/clientes/acme/marca" "$C/clientes/acme/MLA1/creativos/2026-01-02-x-dolor" \
  "$C/clientes/acme/MLA1/creativos/2026-01-02-x-precio" "$C/clientes/acme/MLA1/creativos/2026-01-02-x-huerfano"
printf '{"name": "Acme"}\n' >"$C/clientes/acme/marca/marca.json"
: >"$C/clientes/acme/marca/logo.png"
printf '{"title": "Dolor", "type": "static", "status": "draft"}\n' \
  >"$C/clientes/acme/MLA1/creativos/2026-01-02-x-dolor/creativo.json"
: >"$C/clientes/acme/MLA1/creativos/2026-01-02-x-dolor/4x5-v1.png"
printf '{"title": "Precio", "type": "carousel", "status": "approved"}\n' \
  >"$C/clientes/acme/MLA1/creativos/2026-01-02-x-precio/creativo.json"
run "$C" --resumen
check "creatives: summary exit 0" "$CODE" "0"
case $OUT in *"Actors: 1. Products: 1. Videos: 1 ("*) pass "creatives: video counts unchanged" ;; *) fail "creatives: video counts unchanged ($OUT)" ;; esac
case $OUT in *"Creatives: 2 (draft 1, approved 1, discarded 0). Brand kits: 1."*) pass "creatives: summary counts" ;; *) fail "creatives: summary counts ($OUT)" ;; esac
case $OUT in *"Creative folders without creativo.json (not shown in the gallery):"*"creativos/2026-01-02-x-huerfano"*) pass "creatives: orphan folder reported" ;; *) fail "creatives: orphan folder reported ($OUT)" ;; esac
check "creatives: entity kinds" "$(index "$C" 'e.entities.map((x) => x.kind).join(",")')" "actor,product,brand,video,creative,creative"
check "creatives: brand path and files" "$(index "$C" 'const b = e.entities.find((x) => x.kind === "brand"); b.path + "|" + b.files.join(",")')" "clientes/acme/marca|logo.png,marca.json"
check "creatives: creative files" "$(index "$C" 'e.entities.find((x) => x.kind === "creative").files.join(",")')" "4x5-v1.png,creativo.json"
check "creatives: brand folder is not a product" "$(index "$C" 'e.entities.filter((x) => x.kind === "product").length')" "1"

tick
printf '{"title": "Dolor",' >"$C/clientes/acme/MLA1/creativos/2026-01-02-x-dolor/creativo.json"
printf '{' >"$C/clientes/acme/marca/marca.json"
run "$C"
check "creatives: broken creativo.json exit 2" "$CODE" "2"
case $ERR in *"creativos/2026-01-02-x-dolor/creativo.json:"*) pass "creatives: broken creativo.json reported" ;; *) fail "creatives: broken creativo.json reported ($ERR)" ;; esac
case $ERR in *"clientes/acme/marca/marca.json:"*) pass "creatives: broken marca.json reported" ;; *) fail "creatives: broken marca.json reported ($ERR)" ;; esac

# --- the gallery copy follows the plugin --------------------------------------------------------
printf 'old' >"$S/galeria.html"
run "$S"
cmp -s "$CLAUDE_PLUGIN_ROOT/galeria/galeria.html" "$S/galeria.html" && pass "outdated gallery replaced" || fail "outdated gallery replaced"

printf '\n%s\n' "$([ $fails -eq 0 ] && echo 'All checks passed.' || echo "$fails check(s) failed.")"
[ $fails -eq 0 ]
