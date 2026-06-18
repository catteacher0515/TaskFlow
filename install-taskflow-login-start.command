#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p "$HOME/Library/LaunchAgents" ".taskflow"
cp "launchd/com.huapingyu.taskflow.local.plist" "$HOME/Library/LaunchAgents/com.huapingyu.taskflow.local.plist"
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.huapingyu.taskflow.local.plist" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.huapingyu.taskflow.local.plist"
launchctl enable "gui/$(id -u)/com.huapingyu.taskflow.local"
launchctl kickstart -k "gui/$(id -u)/com.huapingyu.taskflow.local"
echo "TaskFlow 已设置为登录后自动启动。"
echo "固定地址：http://taskflow.localhost:4317"
