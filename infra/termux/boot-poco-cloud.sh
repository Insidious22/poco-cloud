#!/data/data/com.termux/files/usr/bin/sh
PREFIX_DIR="/data/data/com.termux/files/usr"
HOME_DIR="/data/data/com.termux/files/home"
LOG_FILE="$HOME_DIR/boot-poco-cloud.log"

exec >> "$LOG_FILE" 2>&1

echo "=== boot $(date) ==="
"$PREFIX_DIR/bin/termux-wake-lock" || true
"$PREFIX_DIR/bin/sshd" || true
sleep 35

"$PREFIX_DIR/bin/pkill" -f frpc || true
sleep 2

if [ -f "$HOME_DIR/frpc.toml" ]; then
  "$PREFIX_DIR/bin/frpc" -c "$HOME_DIR/frpc.toml" > "$HOME_DIR/frpc.log" 2>&1 &
  echo "frpc started"
else
  echo "missing $HOME_DIR/frpc.toml"
fi

if [ -x "$HOME_DIR/poco-cloud/infra/termux/start-app.sh" ]; then
  APP_DIR="$HOME_DIR/poco-cloud" "$HOME_DIR/poco-cloud/infra/termux/start-app.sh" &
  echo "app start requested"
else
  echo "missing start-app.sh"
fi
