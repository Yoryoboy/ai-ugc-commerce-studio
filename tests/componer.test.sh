#!/bin/sh
# Tests for plugins/ugc-studio/scripts/componer.sh and references/plantillas/creativo.html.
#
#   sh tests/componer.test.sh
#
# Needs Google Chrome or Chromium (set UGC_CHROME to pick one). Without a browser it says so and
# exits 1. Prints one line per check and exits 1 if any fails.

set -u
REPO=$(cd "$(dirname "$0")/.." && pwd)
SCRIPT="$REPO/plugins/ugc-studio/scripts/componer.sh"
TEMPLATE="$REPO/plugins/ugc-studio/references/plantillas/creativo.html"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fails=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; fails=$((fails + 1)); }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (expected [$3], got [$2])"; fi; }

# Runs the script; sets OUT, ERR and CODE.
run() {
  sh "$SCRIPT" "$@" >"$TMP/out" 2>"$TMP/err"
  CODE=$?
  OUT=$(cat "$TMP/out")
  ERR=$(cat "$TMP/err")
}

size() { file "$1" | sed -n 's/.*PNG image data, \([0-9]*\) x \([0-9]*\).*/\1x\2/p'; }

# A 1x1 PNG is enough as the model image: the template covers the canvas with it.
pixel() { printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPpfDwAE/gH+4sQeKQAAAABJRU5ErkJggg==' | base64 -d >"$1"; }

# Writes a copy of the template with the given JSON as its data: design <file> <json>
design() {
  J=$2 awk 'BEGIN { p = 1; j = ENVIRON["J"] }
    /<script type="application\/json" id="datos">/ { print; print j; p = 0; next }
    /<\/script>/ && p == 0 { p = 1 } p' "$TEMPLATE" >"$1"
}

D="$TMP/UGC Studio/creativos/c1"
mkdir -p "$D"
pixel "$D/4x5-base-v1.png"

# --- no browser ---------------------------------------------------------------------------------
design "$D/4x5-diseno-v1.html" '{"formato": "4x5", "diseno": "titular", "imagen": "4x5-base-v1.png", "titulo": "Hola"}'
UGC_CHROME=/nonexistent/chrome run "$D/4x5-diseno-v1.html"
check "no browser: exit 1" "$CODE" "1"
case $ERR in *"Google Chrome is not installed"*) pass "no browser: says so" ;; *) fail "no browser: says so ($ERR)" ;; esac

run "$D/4x5-diseno-v1.html"
if [ $CODE -ne 0 ] && case $ERR in *"not installed"*) true ;; *) false ;; esac; then
  printf 'No Chrome or Chromium found: install one or set UGC_CHROME.\n'
  exit 1
fi

# --- every format, default output name, folder with a space -------------------------------------
check "4x5: exit 0" "$CODE" "0"
check "4x5: prints the output" "$OUT" "$D/4x5-v1.png"
check "4x5: size" "$(size "$D/4x5-v1.png")" "1080x1350"

pixel "$D/9x16-base-v1.png"
design "$D/9x16-diseno-v1.html" '{"formato": "9x16", "diseno": "beneficios", "imagen": "9x16-base-v1.png", "titulo": "Por qué", "puntos": ["Uno", "Dos"]}'
run "$D/9x16-diseno-v1.html"
check "9x16: exit 0" "$CODE" "0"
check "9x16: size" "$(size "$D/9x16-v1.png")" "1080x1920"

design "$D/tarjeta-1-diseno-v1.html" '{"formato": "1x1", "diseno": "tarjeta", "imagen": "4x5-base-v1.png", "numero": "1/3", "titulo": "Tarjeta"}'
run "$D/tarjeta-1-diseno-v1.html"
check "1x1 card: exit 0" "$CODE" "0"
check "1x1 card: default name" "$OUT" "$D/tarjeta-1-v1.png"
check "1x1 card: size" "$(size "$D/tarjeta-1-v1.png")" "1080x1080"

# --- explicit output, every layout, text that needs escaping ------------------------------------
design "$D/a.html" '{"formato": "4x5", "diseno": "oferta", "imagen": "4x5-base-v1.png", "etiqueta": "-30%", "titulo": "Comillas \" y <b>etiquetas</b> & más", "precio": "$ 1.000", "precioAnterior": "$ 2.000", "boton": "Comprá"}'
run "$D/a.html" "$TMP/salida.png"
check "explicit output: exit 0" "$CODE" "0"
check "explicit output: size" "$(size "$TMP/salida.png")" "1080x1350"

design "$D/b.html" '{"formato": "4x5", "diseno": "comparativa", "imagen": "4x5-base-v1.png", "zona": "arriba", "titulo": "Antes y ahora", "columnas": [{"titulo": "Sin", "puntos": ["a"]}, {"titulo": "Con", "puntos": ["b"]}]}'
run "$D/b.html"
check "comparativa: exit 0" "$CODE" "0"

# --- errors leave no image ----------------------------------------------------------------------
design "$D/sin-imagen-diseno-v1.html" '{"formato": "4x5", "diseno": "titular", "imagen": "falta.png", "titulo": "Hola"}'
run "$D/sin-imagen-diseno-v1.html"
check "missing image: exit 1" "$CODE" "1"
case $ERR in *"no encuentro la imagen: falta.png"*) pass "missing image: says which" ;; *) fail "missing image: says which ($ERR)" ;; esac
[ -e "$D/sin-imagen-v1.png" ] && fail "missing image: no PNG" || pass "missing image: no PNG"

design "$D/roto-diseno-v1.html" '{"formato": "4x5", "diseno": "titular", "imagen": "4x5-base-v1.png", "titulo": "Hola",}'
run "$D/roto-diseno-v1.html"
check "broken JSON: exit 1" "$CODE" "1"
case $ERR in *"no es JSON válido"*) pass "broken JSON: says so" ;; *) fail "broken JSON: says so ($ERR)" ;; esac
[ -e "$D/roto-v1.png" ] && fail "broken JSON: no PNG" || pass "broken JSON: no PNG"

design "$D/c.html" '{"formato": "16x9", "diseno": "titular", "imagen": "4x5-base-v1.png", "titulo": "Hola"}'
run "$D/c.html"
check "unknown format: exit 1" "$CODE" "1"
case $ERR in *"unknown \"formato\""*) pass "unknown format: says so" ;; *) fail "unknown format: says so ($ERR)" ;; esac

design "$D/d.html" '{"formato": "4x5", "diseno": "beneficios", "imagen": "4x5-base-v1.png", "titulo": "Hola"}'
run "$D/d.html"
check "beneficios without points: exit 1" "$CODE" "1"
case $ERR in *"beneficios necesita"*) pass "beneficios without points: says so" ;; *) fail "beneficios without points: says so ($ERR)" ;; esac

run "$D/no-existe.html"
check "missing template: exit 1" "$CODE" "1"

# --- text that does not fit ---------------------------------------------------------------------
long=$(awk 'BEGIN { for (i = 0; i < 60; i++) printf "palabra "; }')
design "$D/largo-diseno-v1.html" '{"formato": "4x5", "diseno": "titular", "imagen": "4x5-base-v1.png", "titulo": "'"$long"'"}'
run "$D/largo-diseno-v1.html"
check "too much text: exit 3" "$CODE" "3"
case $ERR in *"does not fit"*) pass "too much text: says so" ;; *) fail "too much text: says so ($ERR)" ;; esac
check "too much text: PNG kept to look at" "$(size "$D/largo-v1.png")" "1080x1350"

printf '\n%s\n' "$([ $fails -eq 0 ] && echo 'All checks passed.' || echo "$fails check(s) failed.")"
[ $fails -eq 0 ]
