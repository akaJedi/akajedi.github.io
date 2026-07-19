#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[0/5] Stopping previous local chat processes..."
pkill -f 'hugo server' 2>/dev/null || true
pkill -f 'wrangler dev' 2>/dev/null || true
pkill -f 'cloudflared tunnel' 2>/dev/null || true
sleep 1

if [[ ! -f .dev.vars ]]; then
  echo "Missing .dev.vars with Telegram secrets." >&2
  exit 1
fi
CLOUDFLARED_BIN="$(command -v cloudflared || true)"
if [[ -z "$CLOUDFLARED_BIN" ]]; then
  CLOUDFLARED_BIN="$(find "${XDG_CONFIG_HOME:-$HOME/.config}/.wrangler/cloudflared" -type f -name cloudflared -perm -u+x 2>/dev/null | head -n1 || true)"
fi
if [[ -z "$CLOUDFLARED_BIN" ]]; then
  echo "cloudflared is required. Install it, then run this command again." >&2
  exit 1
fi

set -a
source .dev.vars
set +a
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is missing from .dev.vars}"
: "${TELEGRAM_WEBHOOK_SECRET:?TELEGRAM_WEBHOOK_SECRET is missing from .dev.vars}"

TMP_DIR="$(mktemp -d)"
cleanup() {
  trap - EXIT INT TERM
  [[ -n "${SITE_PID:-}" ]] && kill "$SITE_PID" 2>/dev/null || true
  [[ -n "${WORKER_PID:-}" ]] && kill "$WORKER_PID" 2>/dev/null || true
  [[ -n "${TUNNEL_PID:-}" ]] && kill "$TUNNEL_PID" 2>/dev/null || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

echo "[1/5] Starting Hugo site..."
npm run dev:site >"$TMP_DIR/site.log" 2>&1 & SITE_PID=$!
echo "[2/5] Starting Cloudflare Worker..."
npm run dev:worker >"$TMP_DIR/worker.log" 2>&1 & WORKER_PID=$!
echo -n "[3/5] Waiting for Worker health "
for _ in {1..60}; do
  if curl -fsS -H 'Origin: http://localhost:1313' http://localhost:8787/api/health >/dev/null 2>&1; then break; fi
  printf "."
  sleep 1
done
echo
if ! curl -fsS -H 'Origin: http://localhost:1313' http://localhost:8787/api/health >/dev/null 2>&1; then
  echo "Worker did not become ready. See $TMP_DIR/worker.log" >&2
  exit 1
fi

"$CLOUDFLARED_BIN" tunnel --no-autoupdate --url http://localhost:8787 >"$TMP_DIR/tunnel.log" 2>&1 & TUNNEL_PID=$!
TUNNEL_URL=""
for _ in {1..60}; do
  TUNNEL_URL="$(grep -Eo 'https://[-a-z0-9]+\.trycloudflare\.com' "$TMP_DIR/tunnel.log" | head -n1 || true)"
  [[ -n "$TUNNEL_URL" ]] && break
  printf "."
  sleep 1
done
echo
if [[ -z "$TUNNEL_URL" ]]; then
  echo "Tunnel URL was not detected. See $TMP_DIR/tunnel.log" >&2
  exit 1
fi

for _ in {1..120}; do
  if curl -fsS -H 'Origin: http://localhost:1313' "$TUNNEL_URL/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! curl -fsS -H 'Origin: http://localhost:1313' "$TUNNEL_URL/api/health" >/dev/null 2>&1; then
  echo "Tunnel URL was detected but is not reachable: $TUNNEL_URL" >&2
  echo "Tunnel diagnostics:" >&2
  tail -n 12 "$TMP_DIR/tunnel.log" >&2
  exit 1
fi

WEBHOOK_URL="$TUNNEL_URL/api/telegram/webhook"
WEBHOOK_RESPONSE="$(curl -sS -w '\n%{http_code}' -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{"url":"'"$WEBHOOK_URL"'","secret_token":"'"$TELEGRAM_WEBHOOK_SECRET"'"}')"
WEBHOOK_CODE="${WEBHOOK_RESPONSE##*$'\n'}"
if [[ "$WEBHOOK_CODE" != "200" ]]; then
  WEBHOOK_BODY="${WEBHOOK_RESPONSE%$'\n'*}"
  echo "Telegram webhook registration failed (HTTP $WEBHOOK_CODE): $WEBHOOK_BODY" >&2
  exit 1
fi

echo "Site:     http://localhost:1313"
echo "Worker:   http://localhost:8787"
echo "Webhook:  $WEBHOOK_URL"
echo "Ready. Press Ctrl+C to stop all local services."
wait "$SITE_PID"
