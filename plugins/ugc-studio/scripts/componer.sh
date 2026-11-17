#!/bin/sh
# Renders a filled creative template (references/plantillas/creativo.html) to a PNG with
# Google Chrome (or Chromium, Edge, Brave) running headless.
#
#   componer.sh <slot>-diseno-vN.html [salida.png]
#
# Without an output path, 4x5-diseno-v1.html becomes 4x5-v1.png in the same folder.
# The size comes from the "formato" of the template: 4x5 1080x1350, 9x16 1080x1920, 1x1 1080x1080.
# Set UGC_CHROME to the browser binary to use another one.
#
# Exit codes: 0 rendered; 1 error (message on stderr, no PNG); 3 rendered, but the text does not
# fit even at the smallest size: shorten it and render again.

set -u

die() { printf 'componer: %s\n' "$1" >&2; exit 1; }

[ $# -ge 1 ] && [ $# -le 2 ] || die "usage: componer.sh <diseno.html> [salida.png]"
src=$1
[ -f "$src" ] || die "not found: $src"
case $src in *.html) ;; *) die "the template must be an .html file: $src" ;; esac

if [ $# -eq 2 ]; then
  out=$2
else
  dir=$(dirname "$src")
  name=$(basename "$src" .html)
  out="$dir/$(printf '%s' "$name" | sed 's/-diseno-/-/').png"
fi

formato=$(sed -n 's/.*"formato"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$src" | head -n 1)
case $formato in
  4x5) w=1080 h=1350 ;;
  9x16) w=1080 h=1920 ;;
  1x1) w=1080 h=1080 ;;
  *) die "unknown \"formato\" in $src: '$formato' (use 4x5, 9x16 or 1x1)" ;;
esac

find_chrome() {
  if [ -n "${UGC_CHROME:-}" ]; then
    printf '%s' "$UGC_CHROME"
    return
  fi
  for app in "Google Chrome" "Chromium" "Microsoft Edge" "Brave Browser"; do
    for base in /Applications "$HOME/Applications"; do
      bin="$base/$app.app/Contents/MacOS/$app"
      [ -x "$bin" ] && { printf '%s' "$bin"; return; }
    done
  done
  for cmd in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
    command -v "$cmd" >/dev/null 2>&1 && { command -v "$cmd"; return; }
  done
}
CHROME=$(find_chrome)
[ -n "$CHROME" ] && [ -x "$CHROME" ] ||
  die "Google Chrome is not installed. Install it from google.com/chrome, or use integrated text."

# file:// URL of the template. Folder names may have spaces or accents (Documentos/UGC Studio).
abs=$(cd "$(dirname "$src")" && pwd)/$(basename "$src")
page="file://$(printf '%s' "$abs" | sed -e 's/%/%25/g' -e 's/ /%20/g' -e 's/#/%23/g' -e 's/?/%3F/g')"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# A profile of its own, so it never touches (or waits for) the Chrome the user has open.
chrome() {
  "$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
    --user-data-dir="$tmp/perfil" --allow-file-access-from-files --hide-scrollbars \
    --force-device-scale-factor=1 --window-size="$w,$h" --virtual-time-budget=10000 \
    "$@" "$page" 2>"$tmp/chrome.log"
}

# 1. Let the template build itself and report its state.
chrome --dump-dom >"$tmp/dom.html" || die "the browser failed: $(tail -n 3 "$tmp/chrome.log")"
body=$(grep -o '<body[^>]*>' "$tmp/dom.html" | head -n 1)
case $body in
  *'data-estado="listo"'*) ;;
  *'data-estado="error"'*)
    msg=$(printf '%s' "$body" | sed -n 's/.*data-error="\([^"]*\)".*/\1/p' |
      sed -e 's/&quot;/"/g' -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g')
    die "the template has an error: $msg" ;;
  *) die "the template did not finish building (is it a copy of plantillas/creativo.html?)" ;;
esac

# 2. Screenshot.
rm -f "$out"
chrome --screenshot="$tmp/shot.png" >/dev/null || die "the browser failed: $(tail -n 3 "$tmp/chrome.log")"
[ -s "$tmp/shot.png" ] || die "the browser wrote no image: $(tail -n 3 "$tmp/chrome.log")"
size=$(file "$tmp/shot.png" | sed -n 's/.*PNG image data, \([0-9]*\) x \([0-9]*\).*/\1x\2/p')
[ "$size" = "${w}x$h" ] || die "the image came out ${size:-unreadable}, expected ${w}x$h"
mv "$tmp/shot.png" "$out" || die "cannot write $out"
printf '%s\n' "$out"

case $body in
  *'data-desborde="si"'*)
    printf 'componer: the text does not fit even at the smallest size; shorten it and render again: %s\n' "$out" >&2
    exit 3 ;;
esac
exit 0
