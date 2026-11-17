#!/bin/sh
# Starts, stops and opens the local gallery server of a UGC Studio workspace.
#
#   galeria.sh start    start the server if it is not running (idempotent, cheap when it is) and
#                       print the gallery URL
#   galeria.sh stop     stop the server
#   galeria.sh status   say whether it is running (exit 0) or not (exit 1)
#   galeria.sh url      print the gallery URL of the running server (exit 1 if not running)
#   galeria.sh open     start it if needed and open the gallery in the browser
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

healthy() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 2 -H "X-UGC-Token: $2" "http://127.0.0.1:$1/api/salud" >/dev/null 2>&1
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 2 -O /dev/null --header="X-UGC-Token: $2" "http://127.0.0.1:$1/api/salud" 2>/dev/null
  else
    ours "$3"
  fi
}

# running: the state file names a live server that answers with its token.
running() {
  pid=$(field pid) && port=$(field port) && token=$(field token) || return 1
  [ -n "$pid" ] && [ -n "$port" ] && [ -n "$token" ] || return 1
  alive "$pid" && healthy "$port" "$token" "$pid"
}

print_url() { say "http://127.0.0.1:$(field port)/?t=$(field token)"; }

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

cmd_start() {
  if running; then
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

  # One launcher at a time: a second one waits for the first to finish.
  i=0
  until mkdir "$LOCK" 2>/dev/null; do
    if running; then
      print_url
      return 0
    fi
    i=$((i + 1))
    if [ $i -ge 60 ]; then # a stale lock from a launcher that died
      rmdir "$LOCK" 2>/dev/null
      mkdir "$LOCK" 2>/dev/null
      break
    fi
    sleep 0.1
  done
  trap 'rmdir "$LOCK" 2>/dev/null' EXIT
  if running; then
    print_url
    return 0
  fi

  rm -f "$STATE"
  # Detached, in its own process group, so it outlives this shell and its terminal.
  if command -v setsid >/dev/null 2>&1; then
    (setsid nohup "$NODE" "$PLUGIN/servidor/servidor.mjs" --studio "$ROOT" </dev/null >"$LOG" 2>&1 &)
  else
    (set -m; nohup "$NODE" "$PLUGIN/servidor/servidor.mjs" --studio "$ROOT" </dev/null >"$LOG" 2>&1 &)
  fi

  i=0
  while [ $i -lt 50 ]; do # up to 5 s
    if running; then
      print_url
      return 0
    fi
    i=$((i + 1))
    sleep 0.1
  done
  err "galeria: the server did not start. See $LOG:"
  tail -n 5 "$LOG" >&2 2>/dev/null
  return 1
}

cmd_stop() {
  if [ ! -f "$STATE" ]; then
    say "The gallery is not running."
    return 0
  fi
  pid=$(field pid)
  if alive "$pid" && { running || ours "$pid"; }; then
    kill "$pid" 2>/dev/null
    i=0
    while alive "$pid" && [ $i -lt 30 ]; do
      i=$((i + 1))
      sleep 0.1
    done
    alive "$pid" && kill -9 "$pid" 2>/dev/null
    rm -f "$STATE"
    say "The gallery stopped."
  else
    rm -f "$STATE"
    say "The gallery was not running (stale state removed)."
  fi
  return 0
}

cmd_url() {
  if running; then
    print_url
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

cmd_open() {
  url=$(cmd_start) || return 1
  say "$url"
  if [ "$(uname)" = Darwin ]; then opener=open; else opener=xdg-open; fi
  if command -v "$opener" >/dev/null 2>&1; then
    "$opener" "$url" >/dev/null 2>&1 &
  else
    say "Open that address in the browser."
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
    exit 2
    ;;
esac
