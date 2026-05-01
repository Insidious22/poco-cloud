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
API_PID_FILE="$LOG_DIR/poco-cloud-api.pid"
DB_PATH="${DB_PATH:-$APP_DIR/data/poco-cloud.sqlite}"
if [ -z "${JWT_SECRET:-}" ]; then
  echo "JWT_SECRET is required. Set it in ~/poco-cloud.env before starting Poco Cloud."
  exit 1
fi
PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"
WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:8080}"
FILES_ROOT="${FILES_ROOT:-$HOME/poco-cloud/storage}"

termux-wake-lock || true

mkdir -p "$APP_DIR/data" "$LOG_DIR"
cd "$API_DIR"

export NODE_ENV=production
export HOST PORT WEB_ORIGIN JWT_SECRET DB_PATH FILES_ROOT LOG_DIR
export SSH_PUBLIC_HOST SSH_PUBLIC_PORT ALLOW_REGISTRATION ALLOW_FILE_DELETE EXPOSE_CONFIG_CONTENT
export SERVICE_SCRIPT_DIR="$APP_DIR/infra/termux"

corepack pnpm db:migrate >> "$LOG_DIR/api.log" 2>&1 || true
echo "$$" > "$API_PID_FILE"
exec corepack pnpm start >> "$LOG_DIR/api.log" 2>&1
