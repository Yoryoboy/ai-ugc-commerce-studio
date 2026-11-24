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
# Every studio a test creates, one per line. A file, not a variable: new_studio runs inside $(…),
# a subshell, so a variable it set would never reach cleanup.
STUDIOS="$TMP/studios"
: >"$STUDIOS"

cleanup() {
  while IFS= read -r s; do CLAUDE_PROJECT_DIR=$s sh "$SCRIPT" stop >/dev/null 2>&1; done <"$STUDIOS"
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
  printf '%s\n' "$s" >>"$STUDIOS"
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
api() { curl -fsS -m 3 "http://127.0.0.1:$(state "$1" port)$2"; }

# --- outside a studio --------------------------------------------------------------------------
mkdir -p "$TMP/plain"
run "$TMP/plain" start
check "outside a studio: exit 1" "$CODE" "1"
has "outside a studio: says so" "$ERR" "studio.json"
[ -e "$TMP/plain/.galeria" ] && fail "outside a studio: no .galeria folder" || pass "outside a studio: no .galeria folder"

run "$TMP/plain" bogus
check "outside a studio, unknown command: exit 1 (the studio check comes first)" "$CODE" "1"

# --- start, idempotence, status, url, stop ------------------------------------------------------
S=$(new_studio a)
run "$S" status
check "status before start: exit 1" "$CODE" "1"
check "status before start: stopped" "$OUT" "stopped"
run "$S" url
check "url before start: exit 1" "$CODE" "1"

run "$S" start
check "start: exit 0" "$CODE" "0"
case $OUT in http://127.0.0.1:[0-9]*/) pass "start: prints the address" ;; *) fail "start: prints the address ($OUT $ERR)" ;; esac
URL=$OUT
PID=$(state "$S" pid)
[ -n "$PID" ] && kill -0 "$PID" 2>/dev/null && pass "start: server process is alive" || fail "start: server process is alive ($PID)"
check "start: prints the plain address" "$URL" "http://127.0.0.1:$(state "$S" port)/"
check "start: stderr empty" "$ERR" ""
check "start: servidor.json has no token" "$(grep -c token "$S/.galeria/servidor.json")" "0"
check "start: servidor.json records the plugin root" "$(sed -n 's/^ *"plugin": *"\(.*\)",\{0,1\} *$/\1/p' "$S/.galeria/servidor.json")" "$(cd "$CLAUDE_PLUGIN_ROOT" && pwd -P)"
check "start: servidor.json mode" "$(stat -c %a "$S/.galeria/servidor.json" 2>/dev/null || stat -f %Lp "$S/.galeria/servidor.json")" "600"
has "start: the server answers" "$(api "$S" /api/salud)" '"ok":true'
has "start: health answers, with the pid" "$(curl -fsS "http://127.0.0.1:$(state "$S" port)/api/salud")" "\"pid\":$PID"
check "start: the plain address serves the page, no token needed" "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" "200"
check "start: own process group" "$(ps -o pgid= -p "$PID" | tr -d ' ')" "$PID"

run "$S" start
check "second start: exit 0" "$CODE" "0"
check "second start: same address" "$OUT" "$URL"
check "second start: same process" "$(state "$S" pid)" "$PID"
run "$S" status
check "status: exit 0" "$CODE" "0"
has "status: running" "$OUT" "running"
run "$S" url
check "url: exit 0" "$CODE" "0"
check "url: prints the plain address" "$OUT" "$URL"
check "url: stderr empty" "$ERR" ""
check "usage: the help mentions no token" "$(CLAUDE_PROJECT_DIR=$S sh "$SCRIPT" 2>&1 | grep -ci 'token\|never paste')" "0"

run "$S" stop
check "stop: exit 0" "$CODE" "0"
sleep 0.2
kill -0 "$PID" 2>/dev/null && fail "stop: process gone" || pass "stop: process gone"
[ -e "$S/.galeria/servidor.json" ] && fail "stop: servidor.json removed" || pass "stop: servidor.json removed"
run "$S" status
check "status after stop: exit 1" "$CODE" "1"
run "$S" stop
check "stop again: exit 0" "$CODE" "0"

# --- usage -------------------------------------------------------------------------------------
run "$S" bogus
check "usage (unknown command, inside a studio): exit 2" "$CODE" "2"
has "usage: message on stderr" "$ERR" "usage: galeria.sh start|stop|status|url|open"
check "usage: nothing on stdout" "$OUT" ""
run "$S" ""
check "usage (empty command): exit 2" "$CODE" "2"
CLAUDE_PROJECT_DIR=$S sh "$SCRIPT" >"$TMP/out" 2>"$TMP/err"
check "usage (no command): exit 2" "$?" "2"
check "usage: nothing started" "$(ls "$S/.galeria" 2>/dev/null | grep -c servidor.json)" "0"

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
for t in sh sed head grep ps curl wget kill mkdir rmdir rm sleep tail uname cat dirname setsid nohup tr stat chmod; do
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
# The browser is given the plain address (no token, no redirect file).
O=$(new_studio open)
mkdir -p "$TMP/fakebin"
for opener in open xdg-open; do
  printf '#!/bin/sh\nprintf "%%s\\n" "$@" >"%s/opened"\n' "$TMP" >"$TMP/fakebin/$opener"
  chmod +x "$TMP/fakebin/$opener"
done
# A curl that logs its arguments, to prove the health probe goes through curl.
REALCURL=$(command -v curl)
printf '#!/bin/sh\nprintf "%%s\\n" "$@" >>"%s/curl-args"\nexec "%s" "$@"\n' "$TMP" "$REALCURL" >"$TMP/fakebin/curl"
chmod +x "$TMP/fakebin/curl"
# A redirect page left by a 0.5.x launcher is removed.
mkdir -p "$O/.galeria"
printf '<meta http-equiv="refresh" content="0;url=http://127.0.0.1:1/?t=old">\n' >"$O/.galeria/abrir.html"
CLAUDE_PROJECT_DIR=$O PATH="$TMP/fakebin:$PATH" sh "$SCRIPT" open >"$TMP/out" 2>"$TMP/err"
check "open: exit 0" "$?" "0"
sleep 0.3
OADDR="http://127.0.0.1:$(state "$O" port)/"
check "open: the browser got the plain address, nothing else" "$(cat "$TMP/opened" 2>/dev/null)" "$OADDR"
[ -e "$O/.galeria/abrir.html" ] && fail "open: no abrir.html (the stale one is removed)" || pass "open: no abrir.html (the stale one is removed)"
has "open: says where the gallery is" "$(cat "$TMP/out")" "$OADDR"
check "open: stderr empty" "$(cat "$TMP/err")" ""
[ -s "$TMP/curl-args" ] && pass "open: the health probe went through curl" || fail "open: the health probe went through curl"
case "$(cat "$TMP/out" "$TMP/err" "$TMP/curl-args")" in *"?t="*) fail "open: no token query anywhere" ;; *) pass "open: no token query anywhere" ;; esac
# A second open after a restart opens the address of the new server.
run "$O" stop
rm -f "$TMP/opened"
CLAUDE_PROJECT_DIR=$O PATH="$TMP/fakebin:$PATH" sh "$SCRIPT" open >/dev/null 2>&1
sleep 0.3
check "open after a restart: the browser got the new address" "$(cat "$TMP/opened" 2>/dev/null)" "http://127.0.0.1:$(state "$O" port)/"
[ -e "$O/.galeria/abrir.html" ] && fail "open after a restart: no abrir.html" || pass "open after a restart: no abrir.html"
# Without a browser opener it prints the address.
rm -f "$TMP/opened"
CLAUDE_PROJECT_DIR=$O PATH="$BIN" sh "$SCRIPT" open >"$TMP/out" 2>"$TMP/err"
check "open without an opener: exit 0" "$?" "0"
has "open without an opener: prints the address" "$(cat "$TMP/out")" "http://127.0.0.1:$(state "$O" port)/"
[ -e "$TMP/opened" ] && fail "open without an opener: nothing was opened" || pass "open without an opener: nothing was opened"
run "$O" stop

# --- a server from another plugin version or folder is replaced ----------------------------------
V=$(new_studio version)
run "$V" start
PID1=$(state "$V" pid)
PLUGIN_VERSION=$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json")
run "$V" start
check "same version and plugin folder: the server is kept" "$(state "$V" pid)" "$PID1"
sed -i.bak 's/"version": "[^"]*"/"version": "0.0.1"/' "$V/.galeria/servidor.json" && rm -f "$V/.galeria/servidor.json.bak"
check "version test set-up: the state says an old version" "$(state "$V" version)" "0.0.1"
run "$V" start
check "other version: start exits 0" "$CODE" "0"
PID2=$(state "$V" pid)
[ "$PID2" != "$PID1" ] && pass "other version: a new server runs" || fail "other version: a new server runs"
sleep 0.2
kill -0 "$PID1" 2>/dev/null && fail "other version: the old server is stopped" || pass "other version: the old server is stopped"
check "other version: the new server runs the plugin version" "$(state "$V" version)" "$PLUGIN_VERSION"
check "other version: one server" "$(ps -eo command | grep -c "[s]ervidor.mjs --studio $V\$")" "1"
sed -i.bak 's#"plugin": "[^"]*"#"plugin": "/somewhere/else/ugc-studio"#' "$V/.galeria/servidor.json" && rm -f "$V/.galeria/servidor.json.bak"
run "$V" start
PID3=$(state "$V" pid)
[ "$PID3" != "$PID2" ] && pass "other plugin folder: a new server runs" || fail "other plugin folder: a new server runs"
sleep 0.2
kill -0 "$PID2" 2>/dev/null && fail "other plugin folder: the old server is stopped" || pass "other plugin folder: the old server is stopped"
check "other plugin folder: one server" "$(ps -eo command | grep -c "[s]ervidor.mjs --studio $V\$")" "1"
# A server that did not record its plugin folder (an older one) cannot be trusted either.
sed -i.bak '/"plugin"/d' "$V/.galeria/servidor.json" && rm -f "$V/.galeria/servidor.json.bak"
run "$V" start
[ "$(state "$V" pid)" != "$PID3" ] && pass "no recorded plugin folder: a new server runs" || fail "no recorded plugin folder: a new server runs"
run "$V" stop

# An older server whose /api/salud needs the token (it answers 401 to the launcher's probe) is
# still stopped and replaced, not orphaned next to a new one.
W=$(new_studio oldsalud)
mkdir -p "$TMP/oldplugin"
cat >"$TMP/oldplugin/servidor.mjs" <<'JS'
import http from "node:http";
import fs from "node:fs";
const studio = process.argv[process.argv.indexOf("--studio") + 1];
const srv = http.createServer((q, r) => { r.writeHead(401); r.end("token required"); });
srv.listen(0, "127.0.0.1", () => {
  fs.writeFileSync(studio + "/.galeria/servidor.json", JSON.stringify({ pid: process.pid, port: srv.address().port,
    token: "x".repeat(64), startedAt: "2026-01-01T00:00:00Z", version: "0.0.1" }, null, 2) + "\n");
});
setTimeout(() => process.exit(0), 120000);
JS
mkdir -p "$W/.galeria"
node "$TMP/oldplugin/servidor.mjs" --studio "$W" >/dev/null 2>&1 &
OLD=$!
i=0; while [ ! -s "$W/.galeria/servidor.json" ] && [ $i -lt 50 ]; do sleep 0.1; i=$((i + 1)); done
check "old 401 server set-up: its state is written" "$(state "$W" pid)" "$OLD"
run "$W" start
check "old 401 server: start exits 0" "$CODE" "0"
sleep 0.3
kill -0 "$OLD" 2>/dev/null && { fail "old 401 server: it is stopped"; kill "$OLD" 2>/dev/null; } || pass "old 401 server: it is stopped"
[ "$(state "$W" pid)" != "$OLD" ] && pass "old 401 server: a new server runs" || fail "old 401 server: a new server runs"
check "old 401 server: the new one answers" "$(api "$W" /api/salud | grep -c '"ok":true')" "1"
run "$W" stop

# --- version flap: two sessions with different plugin versions do not replace each other's server ----
# The server is replaced only by a caller whose plugin is newer (or the same version from another
# folder); a server of a newer plugin is kept and the older caller uses it. Versions compare by
# number, per part (0.10.0 is newer than 0.9.0).
plugin_copy() { # <name> <version>: a copy of the plugin that says it is that version
  cp -R "$CLAUDE_PLUGIN_ROOT" "$TMP/$1"
  sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$2\"/" "$TMP/$1/.claude-plugin/plugin.json" && rm -f "$TMP/$1/.claude-plugin/plugin.json.bak"
}
as_plugin() { # <name> <studio> <command>: runs that copy's launcher in a studio; sets OUT, ERR and CODE
  CLAUDE_PLUGIN_ROOT="$TMP/$1" CLAUDE_PROJECT_DIR=$2 sh "$TMP/$1/scripts/galeria.sh" "$3" >"$TMP/out" 2>"$TMP/err"
  CODE=$?
  OUT=$(cat "$TMP/out")
  ERR=$(cat "$TMP/err")
}
plugin_copy plugin-0.0.1 0.0.1
plugin_copy plugin-0.9.0 0.9.0
plugin_copy plugin-0.10.0 0.10.0
plugin_copy plugin-0.10.1 0.10.1
plugin_copy plugin-same "$PLUGIN_VERSION"
F=$(new_studio flap)
run "$F" start
PIDA=$(state "$F" pid)
URLA=$OUT
as_plugin plugin-0.0.1 "$F" start
check "older plugin, newer server: start exits 0" "$CODE" "0"
check "older plugin, newer server: the server is kept" "$(state "$F" pid)" "$PIDA"
check "older plugin, newer server: it prints that server's address" "$OUT" "$URLA"
check "older plugin, newer server: the version recorded is still the newer one" "$(state "$F" version)" "$PLUGIN_VERSION"
rm -f "$TMP/opened"
SAVED_PATH=$PATH
PATH="$TMP/fakebin:$PATH"
as_plugin plugin-0.0.1 "$F" open
PATH=$SAVED_PATH
check "older plugin, newer server: open uses the running server" "$CODE" "0"
check "older plugin, newer server: open kept the server" "$(state "$F" pid)" "$PIDA"
sleep 0.3
check "older plugin, newer server: open opens its address" "$(cat "$TMP/opened" 2>/dev/null)" "$URLA"
as_plugin plugin-0.0.1 "$F" status
check "older plugin, newer server: status says running" "$CODE" "0"
# Same version from another folder: replaced (the folder of the server may be the stale one).
as_plugin plugin-same "$F" start
check "same version, other folder: start exits 0" "$CODE" "0"
PIDB=$(state "$F" pid)
[ "$PIDB" != "$PIDA" ] && pass "same version, other folder: a new server runs" || fail "same version, other folder: a new server runs"
sleep 0.2
kill -0 "$PIDA" 2>/dev/null && fail "same version, other folder: the old server is stopped" || pass "same version, other folder: the old server is stopped"
check "same version, other folder: it runs from that folder" "$(state "$F" plugin)" "$(cd "$TMP/plugin-same" && pwd -P)"
as_plugin plugin-same "$F" start
check "same version, same folder: the server is kept" "$(state "$F" pid)" "$PIDB"
# A newer plugin replaces it.
as_plugin plugin-0.10.0 "$F" start
PIDC=$(state "$F" pid)
[ "$PIDC" != "$PIDB" ] && pass "newer plugin: a new server runs" || fail "newer plugin: a new server runs"
check "newer plugin: the new server has its version" "$(state "$F" version)" "0.10.0"
sleep 0.2
kill -0 "$PIDB" 2>/dev/null && fail "newer plugin: the old server is stopped" || pass "newer plugin: the old server is stopped"
# 0.9.0 is older than 0.10.0 (numbers, not text): the 0.10.0 server is kept, also for 0.4.3.
as_plugin plugin-0.9.0 "$F" start
check "0.9.0 against a 0.10.0 server: kept (compared as numbers)" "$(state "$F" pid)" "$PIDC"
run "$F" start
check "$PLUGIN_VERSION against a 0.10.0 server: kept" "$(state "$F" pid)" "$PIDC"
check "$PLUGIN_VERSION against a 0.10.0 server: exit 0, the server's address" "$CODE $OUT" "0 http://127.0.0.1:$(state "$F" port)/"
as_plugin plugin-0.10.0 "$F" start
check "same plugin as the server: kept" "$(state "$F" pid)" "$PIDC"
as_plugin plugin-0.10.1 "$F" start
[ "$(state "$F" pid)" != "$PIDC" ] && pass "0.10.1 against a 0.10.0 server: replaced" || fail "0.10.1 against a 0.10.0 server: replaced"
check "0.10.1 against a 0.10.0 server: the new server has its version" "$(state "$F" version)" "0.10.1"
# Alternating sessions of two plugin versions settle on the newer one instead of replacing each other.
PIDD=$(state "$F" pid)
for n in 1 2 3; do
  as_plugin plugin-0.9.0 "$F" start
  as_plugin plugin-0.10.1 "$F" start
done
check "alternating sessions: one server, never replaced" "$(state "$F" pid)" "$PIDD"
check "alternating sessions: one process" "$(ps -eo command | grep -c "[s]ervidor.mjs --studio $F\$")" "1"
# A server that recorded no version (an older one) is older than any plugin: replaced.
sed -i.bak '/"version"/d' "$F/.galeria/servidor.json" && rm -f "$F/.galeria/servidor.json.bak"
as_plugin plugin-0.0.1 "$F" start
[ "$(state "$F" pid)" != "$PIDD" ] && pass "server without a version: replaced" || fail "server without a version: replaced"
run "$F" stop

# --- open without curl or wget does not wait for the scan ----------------------------------------
BIN2="$TMP/bin2"
mkdir -p "$BIN2"
for t in sh sed head grep ps kill mkdir rmdir rm sleep tail uname cat dirname setsid nohup tr stat chmod date; do
  p=$(command -v "$t" 2>/dev/null) && [ -x "$p" ] && ln -sf "$p" "$BIN2/$t"
done
K=$(new_studio nocurl)
run "$K" start
t0=$(date +%s)
CLAUDE_PROJECT_DIR=$K PATH="$BIN2" sh "$SCRIPT" open >"$TMP/out" 2>"$TMP/err"
check "open without curl or wget: exit 0" "$?" "0"
[ $(($(date +%s) - t0)) -le 3 ] && pass "open without curl or wget: does not wait 10 s for the scan" || fail "open without curl or wget: does not wait 10 s for the scan ($(($(date +%s) - t0)) s)"
has "open without curl or wget: prints the address" "$(cat "$TMP/out")" "http://127.0.0.1:$(state "$K" port)/"
run "$K" stop

# --- slow start: the server listens first, the launchers neither fail nor duplicate it -----------
L=$(new_studio slow)
export UGC_GALERIA_TEST_SCAN_DELAY_MS=4000
export UGC_GALERIA_START_WAIT=2
for n in 1 2 3 4; do
  (CLAUDE_PROJECT_DIR=$L sh "$SCRIPT" start >"$TMP/s$n.out" 2>"$TMP/s$n.err"; echo $? >"$TMP/s$n.code") &
done
wait
check "slow scan: every launcher exits 0" "$(cat "$TMP"/s?.code | sort -u | tr '\n' ' ')" "0 "
check "slow scan: all print the same address" "$(cat "$TMP"/s?.out | sort -u | wc -l | tr -d ' ')" "1"
check "slow scan: nothing on stderr" "$(cat "$TMP"/s?.err)" ""
check "slow scan: one server" "$(ps -eo command | grep -c "[s]ervidor.mjs --studio $L\$")" "1"
check "slow scan: not ready yet (listo false)" "$(curl -fsS "http://127.0.0.1:$(state "$L" port)/api/salud" | grep -c '"listo":false')" "1"
check "slow scan: data answers 503 meanwhile" "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$(state "$L" port)/api/estudio")" "503"
check "slow scan: a launcher run meanwhile keeps the same server" "$(CLAUDE_PROJECT_DIR=$L sh "$SCRIPT" start >/dev/null 2>&1; state "$L" pid)" "$(state "$L" pid)"
i=0
until curl -fsS "http://127.0.0.1:$(state "$L" port)/api/salud" | grep -q '"listo":true' || [ $i -ge 100 ]; do i=$((i + 1)); sleep 0.1; done
has "slow scan: data answers once ready" "$(api "$L" /api/salud)" '"listo":true'
run "$L" stop
check "slow scan: no server left" "$(ps -eo command | grep -c "[s]ervidor.mjs --studio $L\$")" "0"
unset UGC_GALERIA_TEST_SCAN_DELAY_MS UGC_GALERIA_START_WAIT

# --- a server that never listens is killed and reported ------------------------------------------
F=$(new_studio hang)
FBIN="$TMP/fakenode"
mkdir -p "$FBIN"
printf '#!/bin/sh\ncase $1 in -p) echo 20.0.0; exit 0 ;; esac\necho $$ >"%s/hung.pid"\nexec sleep 60\n' "$TMP" >"$FBIN/node"
chmod +x "$FBIN/node"
CLAUDE_PROJECT_DIR=$F PATH="$FBIN:$PATH" UGC_GALERIA_START_WAIT=1 sh "$SCRIPT" start >"$TMP/out" 2>"$TMP/err"
check "never listens: exit 1" "$?" "1"
has "never listens: says the server did not start" "$(cat "$TMP/err")" "did not start"
HUNG=$(cat "$TMP/hung.pid" 2>/dev/null)
[ -n "$HUNG" ] && pass "never listens: the fake server was started" || fail "never listens: the fake server was started"
sleep 0.3
kill -0 "$HUNG" 2>/dev/null && { fail "never listens: the spawned process is killed"; kill "$HUNG" 2>/dev/null; } || pass "never listens: the spawned process is killed"
[ -e "$F/.galeria/arranque.lock" ] && fail "never listens: the lock is released" || pass "never listens: the lock is released"

# --- the start lock ------------------------------------------------------------------------------
# A lock whose holder died is taken over at once.
D=$(new_studio deadlock)
mkdir -p "$D/.galeria/arranque.lock"
echo 999999 >"$D/.galeria/arranque.lock/pid"
t0=$(date +%s)
run "$D" start
check "lock of a dead launcher: start exits 0" "$CODE" "0"
[ $(($(date +%s) - t0)) -le 3 ] && pass "lock of a dead launcher: taken over at once" || fail "lock of a dead launcher: taken over at once"
run "$D" stop
# A lock held by a live launcher is not broken after the old 6 s: it outlasts the holder's own
# maximum wait (the stop plus the start wait).
H=$(new_studio livelock)
mkdir -p "$H/.galeria/arranque.lock"
sleep 12 &
HOLDER=$!
echo "$HOLDER" >"$H/.galeria/arranque.lock/pid"
CLAUDE_PROJECT_DIR=$H sh "$SCRIPT" start >"$TMP/h.out" 2>"$TMP/h.err" &
WAITER=$!
sleep 8
kill -0 "$WAITER" 2>/dev/null && pass "live lock: the launcher is still waiting after 8 s" || fail "live lock: the launcher is still waiting after 8 s"
check "live lock: the lock was not broken" "$(cat "$H/.galeria/arranque.lock/pid" 2>/dev/null)" "$HOLDER"
[ -e "$H/.galeria/servidor.json" ] && fail "live lock: no server started behind the lock" || pass "live lock: no server started behind the lock"
kill "$HOLDER" 2>/dev/null
wait "$WAITER"
check "live lock: once the holder is gone the launcher starts the server" "$?" "0"
run "$H" stop

# --- plugin hooks: SessionStart starts the server (reusing a running one); none stops it ----
# hook_command <event>: the first command of that event in hooks/hooks.json, as Claude Code runs it.
hook_command() {
  node -e 'const h = require(process.argv[1]).hooks[process.argv[2]]; process.stdout.write(h ? h[0].hooks[0].command : "")' \
    "$CLAUDE_PLUGIN_ROOT/hooks/hooks.json" "$1"
}
# run_hook <event> <dir>: runs the hook command in that project; sets OUT, ERR and CODE.
run_hook() {
  cmd=$(hook_command "$1")
  [ -n "$cmd" ] || { CODE=127; OUT=""; ERR="no $1 hook"; return; }
  (cd "$2" && CLAUDE_PROJECT_DIR=$2 sh -c "$cmd" </dev/null >"$TMP/out" 2>"$TMP/err")
  CODE=$?
  OUT=$(cat "$TMP/out")
  ERR=$(cat "$TMP/err")
}

K=$(new_studio hooks)
run_hook SessionStart "$K"
check "SessionStart hook: exit 0" "$CODE" "0"
run "$K" status
check "SessionStart hook: the server is running" "$CODE" "0"
PIDK=$(state "$K" pid)
run_hook SessionStart "$K"
check "second SessionStart hook: reuses the running server" "$(state "$K" pid)" "$PIDK"
# No session end hook: closing one session must not stop the server the other sessions of the
# studio share. The server stops by itself after UGC_GALERIA_IDLE_MIN minutes without requests.
check "no SessionEnd hook: closing a session leaves the shared server alone" "$(hook_command SessionEnd)" ""
kill -0 "$PIDK" 2>/dev/null && pass "no SessionEnd hook: the shared server keeps running" || fail "no SessionEnd hook: the shared server keeps running"

# Outside a studio every hook returns before touching a plugin script: run them with a plugin root
# that has no scripts, so reaching a script would fail.
mkdir -p "$TMP/no-scripts"
for event in SessionStart PostToolUse; do
  cmd=$(hook_command "$event")
  (cd "$TMP/plain" && CLAUDE_PROJECT_DIR=$TMP/plain CLAUDE_PLUGIN_ROOT=$TMP/no-scripts sh -c "$cmd" \
    </dev/null >"$TMP/out" 2>"$TMP/err")
  check "$event hook outside a studio: runs no script (exit 0)" "$?" "0"
  check "$event hook outside a studio: runs no script (silent)" "$(cat "$TMP/out" "$TMP/err")" ""
done
run_hook PostToolUse "$K"
check "PostToolUse hook in a studio: exit 0" "$CODE" "0"
run "$K" status
check "PostToolUse hook in a studio: the server is running" "$CODE" "0"
run "$K" stop >/dev/null

printf '\n%s\n' "$([ $fails -eq 0 ] && echo 'All checks passed.' || echo "$fails check(s) failed.")"
[ $fails -eq 0 ]
