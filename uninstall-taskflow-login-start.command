#!/bin/zsh
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.huapingyu.taskflow.local.plist"
launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"
echo "TaskFlow 登录后自动启动已移除。"
