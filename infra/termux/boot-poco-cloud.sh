#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock || true
sleep 20

pkill -f "poco-cloud.*apps/api" || true
pkill -f frpc || true

frpc -c "$HOME/frpc.toml" > "$HOME/frpc.log" 2>&1 &
APP_DIR="$HOME/poco-cloud" "$HOME/poco-cloud/infra/termux/start-app.sh" &
