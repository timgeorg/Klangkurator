#!/usr/bin/env bash
#
# Klangkurator — launcher
#
# Usage:
#   ./run.sh              dev mode (default): FastAPI backend + Vite dev server
#   ./run.sh dev          same as above
#   ./run.sh server       backend only, serves the built frontend from dist/
#   ./run.sh desktop      build frontend, then open the PyWebView desktop window
#   ./run.sh stop         stop the backend (and a Vite dev server) in this project
#   ./run.sh status       show what is currently running
#   ./run.sh help         this text
#
# Environment overrides:
#   KLANGKURATOR_PYTHON   interpreter for the backend (must have fastapi/uvicorn)
#   BACKEND_PORT          default 8000
#   FRONTEND_PORT         default 8080
#   NO_INSTALL=1          never run npm install / pip install automatically

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
BACKEND_LOG="/tmp/klangkurator-backend.log"
BACKEND_PID=""

if [ -t 1 ]; then
  C_INFO=$'\033[36m'; C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_OFF=$'\033[0m'
else
  C_INFO=""; C_OK=""; C_WARN=""; C_ERR=""; C_OFF=""
fi

say()  { printf '%s==>%s %s\n'  "$C_INFO" "$C_OFF" "$*"; }
ok()   { printf '%s ok %s %s\n' "$C_OK"   "$C_OFF" "$*"; }
warn() { printf '%swarn%s %s\n' "$C_WARN" "$C_OFF" "$*"; }
die()  { printf '%serr %s %s\n' "$C_ERR"  "$C_OFF" "$*" >&2; exit 1; }

# --- helpers ---------------------------------------------------------------

port_pid() {
  local port="$1" pid=""
  if command -v ss >/dev/null 2>&1; then
    pid="$(ss -ltnp 2>/dev/null | grep -E "[:.]${port}[[:space:]]" \
           | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)"
  fi
  if [ -z "$pid" ] && command -v lsof >/dev/null 2>&1; then
    pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1 || true)"
  fi
  printf '%s' "$pid"
}

pid_cmd() {
  [ -r "/proc/$1/cmdline" ] && tr '\0' ' ' < "/proc/$1/cmdline" || true
}

backend_healthy() {
  curl -sf -m 2 "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1
}

find_python() {
  local cand
  for cand in "${KLANGKURATOR_PYTHON:-}" \
              "$ROOT/.venv/bin/python3" \
              "/home/tim/Vault/.venv/bin/python3" \
              "$(command -v python3 2>/dev/null || true)"; do
    [ -n "$cand" ] && [ -x "$cand" ] || continue
    if "$cand" -c 'import fastapi, uvicorn, pydantic' >/dev/null 2>&1; then
      printf '%s' "$cand"
      return 0
    fi
  done
  return 1
}

require_python() {
  PY="$(find_python)" || die "no interpreter with the backend deps found.
     install them with:  python3 -m pip install -r requirements.txt
     or point me at one: KLANGKURATOR_PYTHON=/path/to/python ./run.sh"
  ok "python: $PY"
}

require_node() {
  command -v npm >/dev/null 2>&1 || die "npm not found — Node.js is required for the frontend"
  if [ ! -d node_modules ]; then
    if [ "${NO_INSTALL:-0}" = "1" ]; then
      die "node_modules/ is missing — run: npm install"
    fi
    say "installing frontend deps (npm install)"
    npm install
  fi
}

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    say "stopping backend (pid $BACKEND_PID)"
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Starts the backend in the background. Returns 0 if we started it, 1 if an
# existing healthy instance was reused.
start_backend() {
  local reload="$1" args=()

  if backend_healthy; then
    warn "backend already answering on :$BACKEND_PORT (pid $(port_pid "$BACKEND_PORT")) — reusing it"
    warn "use './run.sh stop' first if you want a fresh one (e.g. for --reload)"
    return 1
  fi

  local busy; busy="$(port_pid "$BACKEND_PORT")"
  [ -n "$busy" ] && die "port $BACKEND_PORT is taken by pid $busy ($(pid_cmd "$busy"))"

  [ "$reload" = "1" ] && args+=(--reload)
  say "starting backend on http://127.0.0.1:$BACKEND_PORT  (log: $BACKEND_LOG)"
  nohup "$PY" -m uvicorn backend.main:app --host 127.0.0.1 --port "$BACKEND_PORT" \
        ${args[@]+"${args[@]}"} >"$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!

  local i
  for i in $(seq 1 60); do
    if backend_healthy; then ok "backend up"; return 0; fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      printf '\n' >&2
      tail -n 20 "$BACKEND_LOG" >&2 || true
      die "backend exited during startup — full log: $BACKEND_LOG"
    fi
    sleep 0.25
  done
  die "backend not healthy after 15s — see $BACKEND_LOG"
}

# --- modes -----------------------------------------------------------------

cmd_dev() {
  require_node
  require_python

  start_backend 1 || true

  say "starting Vite dev server"
  printf '    app:      http://localhost:%s\n' "$FRONTEND_PORT"
  printf '    api:      http://127.0.0.1:%s/api/health  (proxied from /api)\n' "$BACKEND_PORT"
  printf '    data:     ~/.klangkurator/  (JSON files)\n'
  printf '    stop:     Ctrl-C\n\n'
  npm run dev -- --port "$FRONTEND_PORT"
}

cmd_server() {
  require_python
  if [ -f dist/index.html ]; then
    ok "serving built frontend from dist/"
  else
    warn "dist/ is missing — API only. Run 'npm run build' for the UI."
  fi
  say "http://127.0.0.1:$BACKEND_PORT  (Ctrl-C to stop)"
  exec "$PY" -m uvicorn backend.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
}

cmd_desktop() {
  require_node
  require_python
  "$PY" -c 'import webview' >/dev/null 2>&1 \
    || die "pywebview is not importable. Install it (and a GUI backend):
     $PY -m pip install "pywebview[gtk]"
     plus the system WebKit2GTK runtime (gir1.2-webkit2-4.1 or 4.0)."

  say "building frontend (npm run build)"
  npm run build
  [ -f dist/index.html ] || die "build produced no dist/index.html"

  say "launching PyWebView desktop window (Ctrl-C to stop)"
  exec "$PY" -m backend
}

cmd_stop() {
  local pid stopped=0

  pid="$(port_pid "$BACKEND_PORT")"
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null || true
    ok "stopped backend pid $pid on :$BACKEND_PORT"
    stopped=1
  else
    warn "nothing listening on :$BACKEND_PORT"
  fi

  pid="$(port_pid "$FRONTEND_PORT")"
  if [ -n "$pid" ] && pid_cmd "$pid" | grep -q vite; then
    kill "$pid" 2>/dev/null || true
    ok "stopped Vite pid $pid on :$FRONTEND_PORT"
    stopped=1
  fi

  [ "$stopped" = "1" ] || warn "nothing of mine was running"
}

cmd_status() {
  printf '%s\n' "project:  $ROOT"
  printf '%s\n' "python:   ${KLANGKURATOR_PYTHON:-$(find_python || echo 'none with deps')}"
  printf '%s\n' "node:     $(command -v npm >/dev/null 2>&1 && npm -v || echo 'missing')"

  local pid
  pid="$(port_pid "$BACKEND_PORT")"
  if [ -n "$pid" ]; then
    printf 'backend:  pid %s on :%s — health: %s\n' "$pid" "$BACKEND_PORT" \
      "$(curl -sf -m 2 "http://127.0.0.1:$BACKEND_PORT/api/health" || echo 'no response')"
    printf '          %s\n' "$(pid_cmd "$pid")"
  else
    printf 'backend:  not running (:%s free)\n' "$BACKEND_PORT"
  fi

  pid="$(port_pid "$FRONTEND_PORT")"
  if [ -n "$pid" ]; then
    printf 'frontend: pid %s on :%s\n' "$pid" "$FRONTEND_PORT"
  else
    printf 'frontend: not running (:%s free)\n' "$FRONTEND_PORT"
  fi

  printf 'data:     %s\n' "$(ls -A ~/.klangkurator 2>/dev/null | tr '\n' ' ' || echo 'empty/missing')"
  printf 'dist:     %s\n' "$([ -f dist/index.html ] && echo 'built' || echo 'not built')"
}

usage() {
  awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
}

case "${1:-dev}" in
  dev)            cmd_dev ;;
  server)         cmd_server ;;
  desktop)        cmd_desktop ;;
  stop)           cmd_stop ;;
  status)         cmd_status ;;
  help|-h|--help) usage ;;
  *)              usage; die "unknown mode: $1" ;;
esac
