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

# --- brand kit: marca.json as it is (English keys), logo, fonts ---------------------------------
# Helpers that look at the page state the template leaves on <body>.
eval "$(sed -n '/^find_chrome()/,/^}/p' "$SCRIPT")"
CHROME=$(find_chrome)
dom_body() {
  "$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
    --user-data-dir="$TMP/perfil-test" --hide-scrollbars --window-size=1080,1350 \
    --virtual-time-budget=10000 --dump-dom "file://$1" 2>/dev/null | grep -o '<body[^>]*>' | head -n 1
}

B="$TMP/clientes/p/prod/creativos/c1"
mkdir -p "$B" "$TMP/clientes/p/marca"
pixel "$B/4x5-base-v1.png"
pixel "$TMP/clientes/p/marca/logo.png"

design "$B/4x5-diseno-v1.html" '{"formato": "4x5", "diseno": "oferta", "imagen": "4x5-base-v1.png", "titulo": "Marca", "boton": "Comprá", "marca": {"name": "Acme", "colors": {"primary": "#ab12cd", "accent": "#f3c623"}, "fonts": {"google": false}, "logo": "../../../marca/logo.png", "tone": "x"}}'
run "$B/4x5-diseno-v1.html"
check "marca.json as is, with logo: exit 0" "$CODE" "0"
case $(dom_body "$B/4x5-diseno-v1.html") in *'data-primary="#ab12cd"'*) pass "marca.json as is: English colors applied" ;; *) fail "marca.json as is: English colors applied" ;; esac

design "$B/es-diseno-v1.html" '{"formato": "4x5", "diseno": "oferta", "imagen": "4x5-base-v1.png", "titulo": "Marca", "marca": {"colores": {"primary": "#12cd34"}}}'
case $(dom_body "$B/es-diseno-v1.html") in *'data-primary="#12cd34"'*) pass "Spanish colores still applied" ;; *) fail "Spanish colores still applied" ;; esac

design "$B/sin-diseno-v1.html" '{"formato": "4x5", "diseno": "oferta", "imagen": "4x5-base-v1.png", "titulo": "Marca"}'
case $(dom_body "$B/sin-diseno-v1.html") in *'data-primary="#0c6b62"'*) pass "no marca: default color" ;; *) fail "no marca: default color" ;; esac

design "$B/logo-diseno-v1.html" '{"formato": "4x5", "diseno": "titular", "imagen": "4x5-base-v1.png", "titulo": "Marca", "marca": {"logo": "../../../marca/no-existe.png"}}'
run "$B/logo-diseno-v1.html"
check "missing logo: exit 1" "$CODE" "1"
case $ERR in *"no encuentro el logo: ../../../marca/no-existe.png"*) pass "missing logo: says which" ;; *) fail "missing logo: says which ($ERR)" ;; esac
[ -e "$B/logo-v1.png" ] && fail "missing logo: no PNG" || pass "missing logo: no PNG"

# Brand fonts that load: no warning. Brand fonts that do not exist: PNG anyway, warning on stderr.
design "$B/f1-diseno-v1.html" '{"formato": "4x5", "diseno": "titular", "imagen": "4x5-base-v1.png", "titulo": "Marca", "marca": {"fonts": {"heading": "sans-serif", "body": "serif", "google": false}}}'
run "$B/f1-diseno-v1.html"
check "no brand fonts to load: exit 0" "$CODE" "0"
check "no brand fonts to load: silent" "$ERR" ""
design "$B/f2-diseno-v1.html" '{"formato": "4x5", "diseno": "titular", "imagen": "4x5-base-v1.png", "titulo": "Marca", "marca": {"fonts": {"heading": "Zzz Fuente Inexistente", "google": false}}}'
run "$B/f2-diseno-v1.html"
check "font fallback: exit 0" "$CODE" "0"
check "font fallback: PNG written" "$(size "$B/f2-v1.png")" "1080x1350"
case $(dom_body "$B/f2-diseno-v1.html") in *'data-fuentes="fallback"'*) pass "font fallback: reported on the page" ;; *) fail "font fallback: reported on the page" ;; esac
case $ERR in *"brand font"*"Zzz Fuente Inexistente"*) pass "font fallback: warning on stderr" ;; *) fail "font fallback: warning on stderr ($ERR)" ;; esac

# --- an existing PNG survives a failed render ---------------------------------------------------
REAL_CHROME=$CHROME
export REAL_CHROME
printf 'viejo' >"$B/f1-v1.png"
cat >"$TMP/chrome-sin-captura" <<'EOF'
#!/bin/sh
case "$*" in *--screenshot*) exit 1 ;; esac
exec "$REAL_CHROME" "$@"
EOF
chmod +x "$TMP/chrome-sin-captura"
UGC_CHROME="$TMP/chrome-sin-captura" run "$B/f1-diseno-v1.html"
check "failed screenshot: exit 1" "$CODE" "1"
check "failed screenshot: previous PNG kept" "$(cat "$B/f1-v1.png")" "viejo"

cat >"$TMP/chrome-captura-vacia" <<'EOF'
#!/bin/sh
for a in "$@"; do case $a in --screenshot=*) shot=${a#--screenshot=} ;; esac; done
"$REAL_CHROME" "$@"
code=$?
[ -n "${shot:-}" ] && : >"$shot"
exit $code
EOF
chmod +x "$TMP/chrome-captura-vacia"
printf 'viejo' >"$B/f1-v1.png"
UGC_CHROME="$TMP/chrome-captura-vacia" run "$B/f1-diseno-v1.html"
check "empty screenshot: exit 1" "$CODE" "1"
check "empty screenshot: previous PNG kept" "$(cat "$B/f1-v1.png")" "viejo"

design "$B/roto2-diseno-v1.html" '{"formato": "4x5", "diseno": "titular", "imagen": "falta.png", "titulo": "Hola"}'
printf 'viejo' >"$B/roto2-v1.png"
run "$B/roto2-diseno-v1.html"
check "template error: previous PNG kept" "$(cat "$B/roto2-v1.png")" "viejo"

# --- one browser run per render: the state comes from the run that wrote the PNG ----------------
# The wrapper counts its starts and, when it takes the screenshot, reports a template error in the DOM
# it prints while still writing a valid PNG: only the state of that very run can stop the render.
cat >"$TMP/chrome-una-vez" <<'EOF'
#!/bin/sh
echo x >>"$CUENTA"
case "$*" in
  *--screenshot*) "$REAL_CHROME" "$@" | sed 's/data-estado="listo"/data-estado="error" data-error="roto en esta carga"/'; exit 0 ;;
esac
exec "$REAL_CHROME" "$@"
EOF
chmod +x "$TMP/chrome-una-vez"
CUENTA="$TMP/cuenta"
export CUENTA
: >"$CUENTA"
printf 'viejo' >"$B/f1-v1.png"
UGC_CHROME="$TMP/chrome-una-vez" run "$B/f1-diseno-v1.html"
check "state from the screenshot run: exit 1" "$CODE" "1"
case $ERR in *"the template has an error: roto en esta carga"*) pass "state from the screenshot run: template message" ;; *) fail "state from the screenshot run: template message ($ERR)" ;; esac
check "state from the screenshot run: previous PNG kept" "$(cat "$B/f1-v1.png")" "viejo"
check "state from the screenshot run: one browser start" "$(wc -l <"$CUENTA" | tr -d ' ')" "1"

cat >"$TMP/chrome-cuenta" <<'EOF'
#!/bin/sh
echo x >>"$CUENTA"
exec "$REAL_CHROME" "$@"
EOF
chmod +x "$TMP/chrome-cuenta"
: >"$CUENTA"
UGC_CHROME="$TMP/chrome-cuenta" run "$B/f1-diseno-v1.html"
check "one browser start per render: exit 0" "$CODE" "0"
check "one browser start per render: count" "$(wc -l <"$CUENTA" | tr -d ' ')" "1"
check "one browser start per render: PNG replaced" "$(size "$B/f1-v1.png")" "1080x1350"

# A successful render replaces the old PNG.
run "$B/f1-diseno-v1.html"
check "re-render: exit 0" "$CODE" "0"
check "re-render: PNG replaced" "$(size "$B/f1-v1.png")" "1080x1350"

printf '\n%s\n' "$([ $fails -eq 0 ] && echo 'All checks passed.' || echo "$fails check(s) failed.")"
[ $fails -eq 0 ]
