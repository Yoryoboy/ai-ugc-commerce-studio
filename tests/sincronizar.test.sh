#!/bin/sh
# Tests for plugins/ugc-studio/scripts/sincronizar.sh, run against throwaway studios.
#
#   sh tests/sincronizar.test.sh
#
# Needs Node (to validate JSON and to run the gallery server). Prints one line per check and
# exits 1 if any fails. The hook starts the gallery server of every studio it runs in, so the
# studios get their own free port and the servers are stopped at the end.

set -u
REPO=$(cd "$(dirname "$0")/.." && pwd)
SCRIPT="$REPO/plugins/ugc-studio/scripts/sincronizar.sh"
TMP=$(mktemp -d)
export CLAUDE_PLUGIN_ROOT="$REPO/plugins/ugc-studio"
export UGC_GALERIA_PORT=0 # any free port: never touch a gallery the user may have open
export UGC_GALERIA_IDLE_MIN=2 # a server that leaks from a failed test stops by itself
cleanup() {
  for f in "$TMP"/*/.galeria/servidor.json; do
    [ -f "$f" ] && CLAUDE_PROJECT_DIR=$(dirname "$(dirname "$f")") sh "$REPO/plugins/ugc-studio/scripts/galeria.sh" stop >/dev/null 2>&1
  done
  rm -rf "$TMP"
}
trap cleanup EXIT

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

has() { case $2 in *"$3"*) pass "$1" ;; *) fail "$1 (no [$3] in [$2])" ;; esac; }

# Value of a field of the server state file of a studio.
state() { sed -n "s/^ *\"$2\": *\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\} *\$/\1/p" "$1/.galeria/servidor.json" | head -n 1; }

# Asks the studio's server (what the gallery shows): node expression `r` over the JSON answer of the path.
api() {
  node -e 'fetch("http://127.0.0.1:" + process.argv[1] + process.argv[3], { headers: { "X-UGC-Token": process.argv[2] } })
    .then((r) => r.json()).then((r) => console.log(eval(process.argv[4])))' \
    "$(state "$1" port)" "$(state "$1" token)" "$2" "$3"
}

# Pause so file times differ from the validation marker (some file systems keep whole seconds).
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
case $OUT in *"Gallery: http://127.0.0.1:"*"/?t="*) pass "summary: gallery URL" ;; *) fail "summary: gallery URL ($OUT)" ;; esac
[ -e "$S/.galeria/datos.js" ] && fail "no datos.js is built" || pass "no datos.js is built"
[ -f "$S/.galeria/validado" ] && pass "validation marker written" || fail "validation marker written"
has "the hook started the gallery server" "$(api "$S" /api/salud 'r.ok + " " + r.entities')" "true 3"
check "the server shows the same studio" "$(api "$S" '/api/elementos' 'r.items.map((i) => i.kind).sort().join(",")')" "actor,product,video"
PID1=$(state "$S" pid)
tick
run "$S"
check "hook: exit 0" "$CODE" "0"
check "hook: the running server is kept" "$(state "$S" pid)" "$PID1"

# An index left by an older version is removed.
printf 'window.ESTUDIO = {};' >"$S/.galeria/datos.js"
run "$S"
[ -e "$S/.galeria/datos.js" ] && fail "old datos.js removed" || pass "old datos.js removed"

# --- file names that need escaping -------------------------------------------------------------
V="$S/clientes/acme/MLA1/videos/2026-01-01-x-y"
: >"$V/comi\"lla.png"
: >"$V/barra\\invertida.png"
: >"$V/$(printf 'retorno\r').png"
tick
run "$S"
check "odd names: exit 0" "$CODE" "0"

# --- unchanged studio --------------------------------------------------------------------------
before=$(ls -l --time-style=+%s.%N "$S/.galeria/validado" 2>/dev/null || ls -lT "$S/.galeria/validado")
tick
run "$S"
after=$(ls -l --time-style=+%s.%N "$S/.galeria/validado" 2>/dev/null || ls -lT "$S/.galeria/validado")
check "unchanged: exit 0" "$CODE" "0"
check "unchanged: nothing validated again (marker untouched)" "$after" "$before"

# Only the JSON changed since the last check is validated: an old broken file is found by the
# session summary (every file), not by the hook.
printf '{"title": ' >"$S/clientes/acme/MLA1/producto.json"
touch -t 200001010000 "$S/clientes/acme/MLA1/producto.json"
run "$S"
check "hook validates only changed files: exit 0" "$CODE" "0"
run "$S" --resumen
case $OUT in *"Invalid JSON"*"clientes/acme/MLA1/producto.json:"*) pass "summary validates every file" ;; *) fail "summary validates every file ($OUT)" ;; esac
printf '{"title": "Producto"}\n' >"$S/clientes/acme/MLA1/producto.json"
tick
run "$S"
check "fixed product: exit 0" "$CODE" "0"
check "fixed product: broken list empty" "$(cat "$S/.galeria/rotos.txt")" ""

# --- broken JSON keeps being reported until fixed ----------------------------------------------
A="$S/actores/ana-v1/actor.json"
cp "$A" "$TMP/actor.ok"
tick
printf '{"name": "Ana",}' >"$A"
run "$S"
check "broken: exit 2" "$CODE" "2"
case $ERR in *"actores/ana-v1/actor.json:"*) pass "broken: path reported" ;; *) fail "broken: path reported ($ERR)" ;; esac
ok=""
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  ok=$(api "$S" '/api/elementos?tipo=actor' 'r.items.map((i) => i.broken).join(",")')
  [ "$ok" = true ] && break
  sleep 0.2
done
check "broken: the server keeps the actor, marked broken" "$ok" "true"

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

# --- the marker moves on when files change ----------------------------------------------------
m1=$(ls -l --time-style=+%s.%N "$S/.galeria/validado" 2>/dev/null || ls -lT "$S/.galeria/validado")
tick
printf '{"credits": {"available": 11}}\n' >"$S/studio.json"
run "$S"
m2=$(ls -l --time-style=+%s.%N "$S/.galeria/validado" 2>/dev/null || ls -lT "$S/.galeria/validado")
[ "$m1" != "$m2" ] && pass "marker moves forward after a change" || fail "marker moves forward after a change"

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
check "creatives: the server lists every kind" "$(api "$C" '/api/elementos?archivados=1' 'r.items.map((i) => i.kind).sort().join(",")')" "actor,brand,creative,creative,product,video"

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

# --- the gallery server is optional for the hook -----------------------------------------------
# Without a Node 18+ the hook still exits 0 and the summary says why; a failed start is not
# retried on every tool call.
BIN="$TMP/bin"
mkdir -p "$BIN" "$TMP/home"
for t in sh find grep sed awk sort tr xargs mkdir rm cmp cp mv date head wc uname cat dirname ps curl kill sleep rmdir tail touch ls; do
  p=$(command -v "$t" 2>/dev/null) && [ -x "$p" ] && ln -sf "$p" "$BIN/$t"
done
NN=$(new_studio nonode)
CLAUDE_PROJECT_DIR=$NN HOME="$TMP/home" PATH="$BIN" sh "$SCRIPT" --resumen >"$TMP/out" 2>"$TMP/err"
check "no node: summary exit 0" "$?" "0"
OUT=$(cat "$TMP/out")
case $OUT in *"Gallery: the server did not start:"*"Node.js 18"*) pass "no node: summary says the gallery is unavailable" ;; *) fail "no node: summary says the gallery is unavailable ($OUT)" ;; esac
case $OUT in *"Actors: 1."*) pass "no node: counts still printed" ;; *) fail "no node: counts still printed ($OUT)" ;; esac
[ -f "$NN/.galeria/sin-servidor" ] && pass "no node: failed start remembered" || fail "no node: failed start remembered"
printf '{"broken",}' >"$NN/actores/ana-v1/actor.json"
CLAUDE_PROJECT_DIR=$NN HOME="$TMP/home" PATH="$BIN" sh "$SCRIPT" >"$TMP/out" 2>"$TMP/err"
check "no node, hook after a broken JSON: exit 0 (no validator available)" "$?" "0"
check "no node: hook output is empty" "$(cat "$TMP/out")" ""

printf '\n%s\n' "$([ $fails -eq 0 ] && echo 'All checks passed.' || echo "$fails check(s) failed.")"
[ $fails -eq 0 ]
