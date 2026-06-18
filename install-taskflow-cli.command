#!/bin/zsh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$HOME/bin"

mkdir -p "$BIN_DIR"

cat > "$BIN_DIR/taskflow-open" <<EOF
#!/bin/zsh
set -euo pipefail
cd "$PROJECT_DIR"
exec ./open-taskflow.command
EOF

cat > "$BIN_DIR/taskflow-stop" <<EOF
#!/bin/zsh
set -euo pipefail
cd "$PROJECT_DIR"
exec ./stop-taskflow.command
EOF

chmod +x "$BIN_DIR/taskflow-open" "$BIN_DIR/taskflow-stop"

echo "已安装命令："
echo "  $BIN_DIR/taskflow-open"
echo "  $BIN_DIR/taskflow-stop"
echo ""
echo "如果你的 shell 还没把 ~/bin 加进 PATH，可以先运行："
echo '  export PATH="$HOME/bin:$PATH"'
