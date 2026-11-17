#!/bin/sh
# Tests for plugins/ugc-studio/scripts/galeria.sh (the launcher of the gallery server), run
# against throwaway studios.
#
#   sh tests/galeria.test.sh
#
# Needs Node 18+ and curl. Prints one line per check and exits 1 if any fails.

set -u
REPO=$(cd "$(dirname "$0")/.." && pwd)
SCRIPT="$REPO/plugins/ugc-studio/scripts/galeria.sh"
TMP=$(mktemp -d)
export CLAUDE_PLUGIN_ROOT="$REPO/plugins/ugc-studio"
export UGC_GALERIA_PORT=0 # any free port: never touch a gallery the user may have open
export UGC_GALERIA_IDLE_MIN=2 # a server that leaks from a failed test stops by itself
STUDIOS=""

cleanup() {
  for s in $STUDIOS; do CLAUDE_PROJECT_DIR=$s sh "$SCRIPT" stop >/dev/null 2>&1; done
  rm -rf "$TMP"
}
trap cleanup EXIT

fails=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; fails=$((fails + 1)); }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (expected [$3], got [$2])"; fi; }
has() { case $2 in *"$3"*) pass "$1" ;; *) fail "$1 (no [$3] in [$2])" ;; esac; }

new_studio() {
  s="$TMP/$1"
  mkdir -p "$s/actores/ana-v1"
  printf '{"credits": {"available": 10}}\n' >"$s/studio.json"
  printf '{"id": "ana-v1", "name": "Ana"}\n' >"$s/actores/ana-v1/actor.json"
  STUDIOS="$STUDIOS $s"
  printf '%s' "$s"
}

# Runs the launcher in a studio; sets OUT, ERR and CODE.
run() {
  dir=$1
  shift
  CLAUDE_PROJECT_DIR=$dir sh "$SCRIPT" "$@" >"$TMP/out" 2>"$TMP/err"
  CODE=$?
  OUT=$(cat "$TMP/out")
  ERR=$(cat "$TMP/err")
}

state() { sed -n "s/^ *\"$2\": *\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\} *\$/\1/p" "$1/.galeria/servidor.json" | head -n 1; }
api() { curl -fsS -m 3 -H "X-UGC-Token: $(state "$1" token)" "http://127.0.0.1:$(state "$1" port)$2"; }

# --- outside a studio --------------------------------------------------------------------------
mkdir -p "$TMP/plain"
run "$TMP/plain" start
check "outside a studio: exit 1" "$CODE" "1"
has "outside a studio: says so" "$ERR" "studio.json"
[ -e "$TMP/plain/.galeria" ] && fail "outside a studio: no .galeria folder" || pass "outside a studio: no .galeria folder"

run "$TMP/plain" bogus
check "usage: exit" "$CODE" "1"

# --- start, idempotence, status, url, stop ------------------------------------------------------
S=$(new_studio a)
run "$S" status
check "status before start: exit 1" "$CODE" "1"
check "status before start: stopped" "$OUT" "stopped"
run "$S" url
check "url before start: exit 1" "$CODE" "1"

run "$S" start
check "start: exit 0" "$CODE" "0"
case $OUT in http://127.0.0.1:[0-9]*/\?t=*) pass "start: prints the URL" ;; *) fail "start: prints the URL ($OUT $ERR)" ;; esac
URL=$OUT
PID=$(state "$S" pid)
[ -n "$PID" ] && kill -0 "$PID" 2>/dev/null && pass "start: server process is alive" || fail "start: server process is alive ($PID)"
check "start: URL has the token of servidor.json" "$URL" "http://127.0.0.1:$(state "$S" port)/?t=$(state "$S" token)"
check "start: servidor.json mode" "$(stat -c %a "$S/.galeria/servidor.json" 2>/dev/null || stat -f %Lp "$S/.galeria/servidor.json")" "600"
has "start: the server answers" "$(api "$S" /api/salud)" '"ok":true'
check "start: own process group" "$(ps -o pgid= -p "$PID" | tr -d ' ')" "$PID"

run "$S" start
check "second start: exit 0" "$CODE" "0"
check "second start: same URL" "$OUT" "$URL"
check "second start: same process" "$(state "$S" pid)" "$PID"
run "$S" status
check "status: exit 0" "$CODE" "0"
has "status: running" "$OUT" "running"
run "$S" url
check "url: prints the URL" "$OUT" "$URL"

run "$S" stop
check "stop: exit 0" "$CODE" "0"
sleep 0.2
kill -0 "$PID" 2>/dev/null && fail "stop: process gone" || pass "stop: process gone"
[ -e "$S/.galeria/servidor.json" ] && fail "stop: servidor.json removed" || pass "stop: servidor.json removed"
run "$S" status
check "status after stop: exit 1" "$CODE" "1"
run "$S" stop
check "stop again: exit 0" "$CODE" "0"

# --- stale state --------------------------------------------------------------------------------
mkdir -p "$S/.galeria"
printf '{\n  "pid": 999999,\n  "port": 1,\n  "token": "abc",\n  "startedAt": "2026-01-01T00:00:00Z",\n  "version": "0"\n}\n' >"$S/.galeria/servidor.json"
run "$S" status
check "stale state: not running" "$CODE" "1"
run "$S" start
check "stale state: start replaces it" "$CODE" "0"
has "stale state: new URL" "$OUT" "http://127.0.0.1:"
[ "$(state "$S" pid)" != "999999" ] && pass "stale state: new pid" || fail "stale state: new pid"
run "$S" stop

# --- several launchers at once start one server -------------------------------------------------
C=$(new_studio concurrent)
for n in 1 2 3 4; do
  (CLAUDE_PROJECT_DIR=$C sh "$SCRIPT" start >"$TMP/c$n.out" 2>&1) &
done
wait
check "concurrent starts: all print the same URL" "$(cat "$TMP"/c?.out | sort -u | wc -l | tr -d ' ')" "1"
check "concurrent starts: one server" "$(ps -eo command | grep -c "[s]ervidor.mjs --studio $C\$")" "1"
run "$C" stop

# --- which Node ---------------------------------------------------------------------------------
# A PATH with the basic tools but no node, and a HOME without the portable Node.
BIN="$TMP/bin"
mkdir -p "$BIN" "$TMP/home"
for t in sh sed head grep ps curl wget kill mkdir rmdir rm sleep tail uname cat dirname setsid nohup tr stat; do
  p=$(command -v "$t" 2>/dev/null) && [ -x "$p" ] && ln -sf "$p" "$BIN/$t"
done
run_nonode() {
  CLAUDE_PROJECT_DIR=$1 HOME="$TMP/home" PATH="$BIN" sh "$SCRIPT" "$2" >"$TMP/out" 2>"$TMP/err"
  CODE=$?
  OUT=$(cat "$TMP/out")
  ERR=$(cat "$TMP/err")
}
N=$(new_studio nonode)
run_nonode "$N" start
check "no node: exit 1" "$CODE" "1"
has "no node: says Node 18 is needed" "$ERR" "Node.js 18"
has "no node: points to the dependencies reference" "$ERR" "dependencias.md"
check "no node: nothing on stdout" "$OUT" ""

printf '#!/bin/sh\necho 16.20.0\n' >"$BIN/node"
chmod +x "$BIN/node"
run_nonode "$N" start
check "node 16: exit 1" "$CODE" "1"
has "node 16: says it is too old" "$ERR" "too old"
rm -f "$BIN/node"

NODE_REAL=$(command -v node)
mkdir -p "$TMP/home/.ugc-studio/node/bin"
ln -sf "$NODE_REAL" "$TMP/home/.ugc-studio/node/bin/node"
run_nonode "$N" start
check "portable node: exit 0" "$CODE" "0"
has "portable node: prints the URL" "$OUT" "http://127.0.0.1:"
run_nonode "$N" stop

# Without setsid (macOS) the launcher still detaches the server into its own process group.
rm -f "$BIN/setsid"
run_nonode "$N" start
check "no setsid: exit 0" "$CODE" "0"
check "no setsid: own process group" "$(ps -o pgid= -p "$(state "$N" pid)" | tr -d ' ')" "$(state "$N" pid)"
run_nonode "$N" stop
p=$(command -v setsid 2>/dev/null) && ln -sf "$p" "$BIN/setsid"

# An old node in PATH does not hide the portable one.
printf '#!/bin/sh\necho 16.20.0\n' >"$BIN/node"
chmod +x "$BIN/node"
run_nonode "$N" start
check "old node in PATH, portable one at home: exit 0" "$CODE" "0"
run_nonode "$N" stop
rm -f "$BIN/node"

# --- open ---------------------------------------------------------------------------------------
O=$(new_studio open)
mkdir -p "$TMP/fakebin"
for opener in open xdg-open; do
  printf '#!/bin/sh\nprintf "%%s\\n" "$1" >"%s/opened"\n' "$TMP" >"$TMP/fakebin/$opener"
  chmod +x "$TMP/fakebin/$opener"
done
CLAUDE_PROJECT_DIR=$O PATH="$TMP/fakebin:$PATH" sh "$SCRIPT" open >"$TMP/out" 2>"$TMP/err"
check "open: exit 0" "$?" "0"
sleep 0.3
check "open: the browser got the URL" "$(cat "$TMP/opened" 2>/dev/null)" "http://127.0.0.1:$(state "$O" port)/?t=$(state "$O" token)"
has "open: prints the URL too" "$(cat "$TMP/out")" "http://127.0.0.1:"
run "$O" stop

printf '\n%s\n' "$([ $fails -eq 0 ] && echo 'All checks passed.' || echo "$fails check(s) failed.")"
[ $fails -eq 0 ]
