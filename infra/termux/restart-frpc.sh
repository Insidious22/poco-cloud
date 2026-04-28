#!/data/data/com.termux/files/usr/bin/sh
set -eu

HOME_DIR="${HOME:-/data/data/com.termux/files/home}"
PREFIX_DIR="${PREFIX:-/data/data/com.termux/files/usr}"
FRPC_BIN="$PREFIX_DIR/bin/frpc"
CONFIG_FILE="$HOME_DIR/frpc.toml"
LOG_FILE="$HOME_DIR/frpc.log"

sleep 2

pkill -f "$FRPC_BIN -c $CONFIG_FILE" 2>/dev/null || true
pkill -f "frpc -c $CONFIG_FILE" 2>/dev/null || true

"$FRPC_BIN" -c "$CONFIG_FILE" > "$LOG_FILE" 2>&1 &
