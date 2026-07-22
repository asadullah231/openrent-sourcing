#!/bin/bash
# OpenRent bot runner — proxy ke sath.
#
# KYUN ye wrapper (22 Jul):
#   Node ka proxy support (NODE_USE_ENV_PROXY) env vars ko PROCESS SHURU hote
#   waqt parhta hai. Code ke andar process.env set karne se kuch nahi hota —
#   ye test kar ke dekha (IP asli hi raha). Isliye proxy yahan, node chalne
#   se PEHLE set hota hai.
#
# KYUN proxy chahiye:
#   laptop (residential IP) → OpenRent 200 ✅
#   VPS (Hostinger datacenter IP) → 405 ❌
#   VPS + Proxy-Seller GB IP → 200 ✅
#
# Istemal:  ./run.sh
# n8n se:   cd /opt/openrent-sourcing && ./run.sh

set -uo pipefail
cd "$(dirname "$0")"

# .env se proxy ki tafseelat lo (PROXY_IPS, PROXY_PORT, PROXY_USER, PROXY_PASS)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -n "${PROXY_IPS:-}" ] && [ -n "${PROXY_PORT:-}" ]; then
  # 5 IPs me se ek random — har run alag IP, ek pe saara traffic na jaye
  IFS=',' read -ra IPS <<< "$PROXY_IPS"
  IDX=$((RANDOM % ${#IPS[@]}))
  IP="$(echo "${IPS[$IDX]}" | tr -d ' ')"

  if [ -n "${PROXY_USER:-}" ] && [ -n "${PROXY_PASS:-}" ]; then
    URI="http://${PROXY_USER}:${PROXY_PASS}@${IP}:${PROXY_PORT}"
  else
    URI="http://${IP}:${PROXY_PORT}"
  fi

  export NODE_USE_ENV_PROXY=1
  export HTTPS_PROXY="$URI"
  export HTTP_PROXY="$URI"
  echo "  🔀 Proxy: ${IP}:${PROXY_PORT} ($((IDX + 1))/${#IPS[@]})"
else
  echo "  ℹ️  Proxy nahi (PROXY_IPS khali) — seedha connection."
fi

exec node src/main.js --once
