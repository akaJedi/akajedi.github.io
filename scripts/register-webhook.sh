#!/usr/bin/env bash
set -Eeuo pipefail

TUNNEL_URL="${1:-}"
if [[ -z "$TUNNEL_URL" ]]; then
  echo "Usage: bash scripts/register-webhook.sh https://your-tunnel.trycloudflare.com" >&2
  exit 2
fi
TUNNEL_URL="${TUNNEL_URL%/}"
set -a
source .dev.vars
set +a
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is missing from .dev.vars}"
: "${TELEGRAM_WEBHOOK_SECRET:?TELEGRAM_WEBHOOK_SECRET is missing from .dev.vars}"

WEBHOOK_URL="$TUNNEL_URL/api/telegram/webhook"
RESPONSE="$(curl -fsS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{"url":"'"$WEBHOOK_URL"'","secret_token":"'"$TELEGRAM_WEBHOOK_SECRET"'"}')"
echo "$RESPONSE"
