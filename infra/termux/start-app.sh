#!/data/data/com.termux/files/usr/bin/sh
set -eu

ENV_FILE="${ENV_FILE:-$HOME/poco-cloud.env}"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

APP_DIR="${APP_DIR:-$HOME/poco-cloud}"
API_DIR="$APP_DIR/apps/api"
LOG_DIR="${LOG_DIR:-$HOME}"
DB_PATH="${DB_PATH:-$APP_DIR/data/poco-cloud.sqlite}"
JWT_SECRET="${JWT_SECRET:-change-this-with-a-long-random-secret}"
PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"
WEB_ORIGIN="${WEB_ORIGIN:-https://167-234-251-177.sslip.io}"
FILES_ROOT="${FILES_ROOT:-$HOME}"

termux-wake-lock || true

mkdir -p "$APP_DIR/data" "$LOG_DIR"
cd "$API_DIR"

export NODE_ENV=production
export HOST PORT WEB_ORIGIN JWT_SECRET DB_PATH FILES_ROOT LOG_DIR
export SERVICE_SCRIPT_DIR="$APP_DIR/infra/termux"

pnpm db:migrate >> "$LOG_DIR/api.log" 2>&1 || true
exec pnpm start >> "$LOG_DIR/api.log" 2>&1
