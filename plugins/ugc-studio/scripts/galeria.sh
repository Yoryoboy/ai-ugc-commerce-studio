#!/bin/sh
# Starts, stops and opens the local gallery server of a UGC Studio workspace.
#
#   galeria.sh start    start the server if it is not running (idempotent, cheap when it is) and
#                       print its address (without the access token)
#   galeria.sh stop     stop the server
#   galeria.sh status   say whether it is running (exit 0) or not (exit 1)
#   galeria.sh url      print the private address WITH the access token, for the user (exit 1 if
#                       not running). Never paste it into a chat or a message: the token gives
#                       access to the studio. Claude uses `open` instead.
#   galeria.sh open     start it if needed and open the gallery in the browser, through
#                       <studio>/.galeria/abrir.html (mode 600), so the token is never in a
#                       command line or in any output
#
# A server of an older plugin version, or of the same version from another plugin folder, is stopped
# and replaced on start. A server of a newer plugin is kept and used as it is, so two sessions with
# different plugin versions do not keep replacing each other's server.
# The server listens before it has indexed the studio (health says "listo": false until then).
# UGC_GALERIA_START_WAIT (seconds, default 5) is how long start waits for it to listen; if it does
# not, the process it spawned is killed and start fails.
#
# Works in the folder given by CLAUDE_PROJECT_DIR, or the current folder. The server is
# servidor/servidor.mjs (Node 18 or newer): the system `node`, else ~/.ugc-studio/node/bin/node
# (the portable Node installed by the setup, see references/dependencias.md).
# State lives in <studio>/.galeria/servidor.json (written by the server). POSIX sh tools only.

set -u
LC_ALL=C
export LC_ALL

ROOT=${CLAUDE_PROJECT_DIR:-$PWD}
PLUGIN=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
STATE=$ROOT/.galeria/servidor.json
LOG=$ROOT/.galeria/servidor.log
LOCK=$ROOT/.galeria/arranque.lock
ABRIR=$ROOT/.galeria/abrir.html

# Waits, in tenths of a second. A launcher holding the lock needs at most STOP_TICKS (stopping an
# old server) plus START_TICKS (waiting for the new one to listen); a waiter only breaks the lock
# of a live holder after three times that.
START_WAIT=${UGC_GALERIA_START_WAIT:-5}
case $START_WAIT in '' | *[!0-9]*) START_WAIT=5 ;; esac
[ "$START_WAIT" -ge 1 ] || START_WAIT=1
START_TICKS=$((START_WAIT * 10))
STOP_TICKS=30
LOCK_STALE_TICKS=$(((STOP_TICKS + START_TICKS) * 3))

say() { printf '%s\n' "$*"; }
err() { printf '%s\n' "$*" >&2; }

if [ ! -f "$ROOT/studio.json" ]; then
  err "galeria: $ROOT is not a UGC Studio folder (no studio.json)."
  exit 1
fi

# field <name>: value of a string or number field of servidor.json.
field() {
  [ -f "$STATE" ] || return 1
  sed -n "s/^ *\"$1\": *\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\} *\$/\1/p" "$STATE" | head -n 1
}

alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }

# Is the process ours (a servidor.mjs)? Guards against a reused pid.
ours() { ps -p "$1" -o command= 2>/dev/null | grep -q 'servidor\.mjs'; }

# health <port>: the answer of GET /api/salud, which needs no token and shows no studio data.
health() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 2 "http://127.0.0.1:$1/api/salud" 2>/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 2 -O - "http://127.0.0.1:$1/api/salud" 2>/dev/null
  else
    return 2
  fi
}

# healthy <port> <pid>: the server of that pid answers on that port.
healthy() {
  answer=$(health "$1")
  case $? in
    0) case $answer in *"\"pid\":$2,"* | *"\"pid\":$2}"*) return 0 ;; esac; return 1 ;;
    2) ours "$2" ;; # neither curl nor wget: all we can check is the process
    *) return 1 ;;
  esac
}

# running: the state file names a live server that answers (listening; the scan may still run).
running() {
  pid=$(field pid) && port=$(field port) || return 1
  [ -n "$pid" ] && [ -n "$port" ] || return 1
  alive "$pid" && healthy "$port" "$pid"
}

# ready: the running server has finished indexing the studio. Returns 2 when it cannot be told (no
# curl or wget), so callers do not wait for an answer that never comes.
ready() {
  answer=$(health "$(field port)")
  case $? in 0) ;; 2) return 2 ;; *) return 1 ;; esac
  case $answer in *'"listo":true'*) return 0 ;; esac
  return 1
}

# The address without the token: safe to print anywhere.
print_url() { say "http://127.0.0.1:$(field port)/"; }
# The private address with the token (only `url` and the redirect file use it).
secret_url() { say "http://127.0.0.1:$(field port)/?t=$(field token)"; }

# plugin_version: version in this plugin's plugin.json (empty if unreadable).
plugin_version() {
  sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$PLUGIN/.claude-plugin/plugin.json" 2>/dev/null | head -n 1
}

# plugin_root: this plugin's folder, resolved like the server resolves its own.
plugin_root() { (cd "$PLUGIN" 2>/dev/null && pwd -P); }

# state_plugin: the plugin folder the running server recorded (JSON string, unescaped).
state_plugin() {
  [ -f "$STATE" ] || return 1
  sed -n 's/^ *"plugin": *"\(.*\)",\{0,1\} *$/\1/p' "$STATE" | head -n 1 | sed 's/\\"/"/g; s/\\\\/\\/g'
}

# ver_cmp <a> <b>: prints 1, 0 or -1 when version a is newer than, equal to or older than b, the way
# `sort -V` orders them: dotted parts compare as numbers (0.10.0 is newer than 0.9.0), and a
# prerelease (1.0.0-beta) is older than its release.
ver_cmp() {
  a=${1#v}
  b=${2#v}
  pa=""
  pb=""
  case $a in *-*) pa=${a#*-}; a=${a%%-*} ;; esac
  case $b in *-*) pb=${b#*-}; b=${b%%-*} ;; esac
  while [ -n "$a" ] || [ -n "$b" ]; do
    xa=${a%%.*}
    xb=${b%%.*}
    case $a in *.*) a=${a#*.} ;; *) a="" ;; esac
    case $b in *.*) b=${b#*.} ;; *) b="" ;; esac
    xa=${xa%%[!0-9]*}
    xb=${xb%%[!0-9]*}
    xa=${xa:-0}
    xb=${xb:-0}
    if [ "$xa" -gt "$xb" ]; then echo 1; return; fi
    if [ "$xa" -lt "$xb" ]; then echo -1; return; fi
  done
  if [ "$pa" = "$pb" ]; then echo 0
  elif [ -z "$pa" ]; then echo 1
  elif [ -z "$pb" ]; then echo -1
  elif [ "$(printf '%s\n%s\n' "$pa" "$pb" | sort | head -n 1)" = "$pa" ]; then echo -1
  else echo 1
  fi
}

# usable: the server in servidor.json can serve this caller. It is replaced only when this plugin is
# newer than the server's, or has the same version but runs from another folder (the server's folder
# may be stale). A server of a newer plugin is kept and used as it is. A server that recorded no
# version or no plugin folder (an older one) cannot be trusted.
usable() {
  want=$(plugin_version)
  if [ -n "$want" ]; then
    have=$(field version)
    [ -n "$have" ] || return 1
    case $(ver_cmp "$want" "$have") in
      1) return 1 ;;
      -1) return 0 ;;
    esac
  fi
  [ "$(state_plugin)" = "$(plugin_root)" ]
}

node_version() { "$1" -p 'process.versions.node' 2>/dev/null; }

# find_node: sets NODE to a Node 18 or newer, or returns 1 with FOUND set to what was seen.
find_node() {
  NODE=""
  FOUND=""
  for candidate in "$(command -v node 2>/dev/null || true)" "$HOME/.ugc-studio/node/bin/node"; do
    [ -n "$candidate" ] && [ -x "$candidate" ] || continue
    v=$(node_version "$candidate") || continue
    major=${v%%.*}
    FOUND=$v
    case $major in '' | *[!0-9]*) continue ;; esac
    if [ "$major" -ge 18 ]; then
      NODE=$candidate
      return 0
    fi
  done
  return 1
}

# stop_server: stop the server named by the state file, gracefully (TERM, then KILL after 3 s).
stop_server() {
  pid=$(field pid)
  if alive "$pid" && { running || ours "$pid"; }; then
    kill "$pid" 2>/dev/null
    i=0
    while alive "$pid" && [ $i -lt $STOP_TICKS ]; do
      i=$((i + 1))
      sleep 0.1
    done
    alive "$pid" && kill -9 "$pid" 2>/dev/null
    rm -f "$STATE"
    return 0
  fi
  rm -f "$STATE"
  return 1
}

# take_lock: one launcher at a time; a second one waits for the first to finish. Returns 0 with the
# lock held, or 2 after printing the address when a server turned up while waiting. The lock holds
# the holder's pid; it is only taken over when that process is gone, or after LOCK_STALE_TICKS.
take_lock() {
  i=0
  until mkdir "$LOCK" 2>/dev/null; do
    if running && usable; then
      print_url
      return 2
    fi
    holder=$(cat "$LOCK/pid" 2>/dev/null)
    if { [ -n "$holder" ] && ! alive "$holder"; } || [ $i -ge $LOCK_STALE_TICKS ]; then
      # Someone else may be breaking the same lock: wait a little (different per launcher), and
      # only break it if it is still the same one.
      sleep 0.$(($$ % 10))
      if [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$holder" ]; then
        rm -f "$LOCK/pid"
        rmdir "$LOCK" 2>/dev/null
      fi
      i=0
      continue
    fi
    i=$((i + 1))
    sleep 0.1
  done
  printf '%s\n' "$$" >"$LOCK/pid"
  return 0
}

release_lock() {
  rm -f "$LOCK/pid"
  rmdir "$LOCK" 2>/dev/null
}

cmd_start() {
  if running && usable; then
    print_url
    return 0
  fi
  if ! find_node; then
    if [ -n "$FOUND" ]; then seen="found Node $FOUND, too old"; else seen="Node.js is not installed"; fi
    err "galeria: the gallery needs Node.js 18 or newer ($seen). Follow the Node item of"
    err "  $PLUGIN/references/dependencias.md (setup installs a portable Node in ~/.ugc-studio/node, no admin needed)."
    return 1
  fi
  mkdir -p "$ROOT/.galeria" || return 1

  take_lock
  [ $? -eq 2 ] && return 0
  trap 'release_lock' EXIT
  if running && usable; then
    print_url
    return 0
  fi

  # A server of an older plugin version or from another folder: stop it (gracefully) and start this one.
  # Not only when it answers the probe: an older server needs the token for /api/salud (it answers
  # 401), and it is still ours to stop. stop_server checks the pid is a live servidor.mjs.
  stop_server || true
  rm -f "$STATE"
  # Detached, in its own process group, so it outlives this shell and its terminal. The pid of
  # what was spawned is kept, to kill it if it never listens.
  if command -v setsid >/dev/null 2>&1; then
    spawned=$( (setsid nohup "$NODE" "$PLUGIN/servidor/servidor.mjs" --studio "$ROOT" </dev/null >"$LOG" 2>&1 & echo $!) )
  else
    spawned=$( (set -m; nohup "$NODE" "$PLUGIN/servidor/servidor.mjs" --studio "$ROOT" </dev/null >"$LOG" 2>&1 & echo $!) )
  fi

  i=0
  while [ $i -lt $START_TICKS ]; do
    if running; then
      print_url
      return 0
    fi
    alive "$spawned" || break # it died: no point in waiting
    i=$((i + 1))
    sleep 0.1
  done
  if alive "$spawned"; then
    kill "$spawned" 2>/dev/null
    j=0
    while alive "$spawned" && [ $j -lt 20 ]; do
      j=$((j + 1))
      sleep 0.1
    done
    alive "$spawned" && kill -9 "$spawned" 2>/dev/null
  fi
  [ "$(field pid)" = "$spawned" ] && rm -f "$STATE"
  err "galeria: the server did not start (it was not listening after ${START_WAIT} s). See $LOG:"
  tail -n 5 "$LOG" >&2 2>/dev/null
  return 1
}

cmd_stop() {
  if [ ! -f "$STATE" ]; then
    say "The gallery is not running."
    return 0
  fi
  if stop_server; then
    say "The gallery stopped."
  else
    say "The gallery was not running (stale state removed)."
  fi
  return 0
}

cmd_url() {
  if running; then
    secret_url
  else
    err "The gallery is not running. Start it with: sh $PLUGIN/scripts/galeria.sh start"
    return 1
  fi
}

cmd_status() {
  if running; then
    say "running (pid $(field pid)): $(print_url)"
  else
    say "stopped"
    return 1
  fi
}

# write_redirect: .galeria/abrir.html (mode 600), a page that sends the browser to the private
# address. The browser is given this file's path, so the token is never in a command line.
write_redirect() {
  target=$(secret_url)
  rm -f "$ABRIR"
  : >"$ABRIR" && chmod 600 "$ABRIR" || return 1
  cat >"$ABRIR" <<HTML
<!doctype html>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=$target">
<title>UGC Studio</title>
<p>Abriendo la galería… <a href="$target">Si no se abre, hacé clic acá</a>.</p>
HTML
}

cmd_open() {
  cmd_start >/dev/null || return 1
  # A server still indexing a big studio shows nothing useful yet: give it a moment (best effort).
  i=0
  while [ $i -lt 100 ]; do
    ready
    case $? in 0 | 2) break ;; esac # ready, or no curl/wget to ask: do not wait
    i=$((i + 1))
    sleep 0.1
  done
  write_redirect || { err "galeria: cannot write $ABRIR"; return 1; }
  if [ "$(uname)" = Darwin ]; then opener=open; else opener=xdg-open; fi
  if command -v "$opener" >/dev/null 2>&1; then
    "$opener" "$ABRIR" >/dev/null 2>&1 &
    say "The gallery is open in the browser: $(print_url)"
  else
    say "The gallery is running at $(print_url) . Open this file in the browser: $ABRIR"
  fi
  return 0
}

case ${1:-} in
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  url) cmd_url ;;
  open) cmd_open ;;
  *)
    err "usage: galeria.sh start|stop|status|url|open"
    err "  start   start the server if needed and print its address (no token)"
    err "  stop    stop the server"
    err "  status  running or stopped"
    err "  url     the private address WITH the access token, for the user only: never paste it into a chat"
    err "  open    start the server if needed and open the gallery in the browser"
    exit 2
    ;;
esac
