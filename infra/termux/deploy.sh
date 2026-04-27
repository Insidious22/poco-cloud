#!/data/data/com.termux/files/usr/bin/sh
set -eu

ENV_FILE="${ENV_FILE:-$HOME/poco-cloud.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create it from infra/termux/poco-cloud.env.example before deploying."
  exit 1
fi

# shellcheck disable=SC1090
. "$ENV_FILE"

APP_DIR="${APP_DIR:-$HOME/poco-cloud}"
LOG_DIR="${LOG_DIR:-$HOME}"
API_LOG="$LOG_DIR/api.log"

mkdir -p "$LOG_DIR" "$APP_DIR/data"

termux-wake-lock >/dev/null 2>&1 || true

cd "$APP_DIR"

echo "[deploy] Pulling latest code..."
git pull --ff-only

echo "[deploy] Installing dependencies..."
corepack pnpm install

echo "[deploy] Building workspace..."
corepack pnpm build

echo "[deploy] Migrating database..."
corepack pnpm db:migrate

echo "[deploy] Stopping previous API process..."
pkill -f "poco-cloud.*apps/api" >/dev/null 2>&1 || true

echo "[deploy] Starting API in background..."
export NODE_ENV=production
export APP_DIR JWT_SECRET DB_PATH FILES_ROOT LOG_DIR HOST PORT WEB_ORIGIN
export SERVICE_SCRIPT_DIR="$APP_DIR/infra/termux"

nohup corepack pnpm start >> "$API_LOG" 2>&1 &

sleep 2

if pgrep -f "poco-cloud.*apps/api" >/dev/null 2>&1; then
  echo "[deploy] Poco Cloud is running."
  echo "[deploy] Logs: $API_LOG"
else
  echo "[deploy] API did not start. Last log lines:"
  tail -n 80 "$API_LOG" || true
  exit 1
fi
