#!/data/data/com.termux/files/usr/bin/sh
set -eu

APP_DIR="${APP_DIR:-$HOME/poco-cloud}"
exec "$APP_DIR/infra/termux/start-app.sh"
