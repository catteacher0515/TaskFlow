# TaskFlow Agent Notes

## 项目定位

- 这是一个**本地优先**的个人任务推进工具，不默认按公网 SaaS 维护。
- 当前最真实的使用形态是：在这台 Mac 上常驻运行，浏览器打开 `http://taskflow.localhost:4317` 使用。
- 项目目标不是通用 GTD，而是帮助用户处理探索性强、反馈链路长、容易并行失控的任务。

## 本地运行事实

- 固定入口：`http://taskflow.localhost:4317`
- 手动启动：
  - 双击 `open-taskflow.command`
  - 或运行 `npm run local:open`
- 手动停止：
  - 双击 `stop-taskflow.command`
  - 或运行 `npm run local:stop`
- 登录后自动启动：
  - `install-taskflow-login-start.command`
  - 由 `launchd/com.huapingyu.taskflow.local.plist` 托管
  - 当前是 `KeepAlive = true` 的常驻模式，不是一次性启动器
- 任意目录 CLI：
  - `install-taskflow-cli.command`
  - 安装后可用 `taskflow-open` / `taskflow-stop`

## 开发与构建

- 前端开发服务：`npm run dev`，地址 `http://127.0.0.1:5173`
- 本地 API：`npm run dev:server`，地址 `http://127.0.0.1:4317`
- 生产式本地运行不是 Vite dev server，而是：
  - `npm run build`
  - `npm start`
- `vite build` 产物在 `dist/client`
- Express 会直接托管 `dist/client` 下的静态文件

## 数据与运行目录

- 运行数据默认在项目根 `data/`
- 可通过 `DATA_DIR` 覆盖运行时数据目录
- 本地启动器和 `launchd` 日志在 `.taskflow/`
- 真实使用过程会改动 `data/activity-log.jsonl` 和 `data/projects/*.json`
- 除非用户明确要求，不要擅自清理、回滚或提交这些运行态数据

## 当前产品能力

- 项目支持：
  - 新建
  - 状态流转：`待开始 / 进行中 / 暂停 / 已完成 / 已放弃`
  - 逻辑隐藏
  - 从项目列表 `更多 -> 重命名`
- 收束模式支持：
  - 并行上限 gate
  - 选择一个进行中项目进入 focus
  - 主动结束收束
  - 当前 focus 项目完成、暂停、放弃或隐藏后自动退出
- 反馈页支持：
  - 类型筛选
  - 时间快捷筛选与自定义范围
  - 按天 / 周 / 月分组
  - 单条删除
  - 批量删除与“一键删除当前筛选结果”
- 通用任务树支持：
  - 最多三层
  - 非根任务可 `更多 -> 重命名 / 删除`
  - 删除是物理删除
- 周刊模板当前骨架固定为：
  - `亲测候选仓库`
  - `确定本周 5 个推荐`
  - `成稿`
  - `发布`
- 周刊候选仓库结果态：
  - `入选`
  - `淘汰`
  - `暂缓`
- `确定本周 5 个推荐` 是自动汇总区，不是手动维护推荐 1-5

## 近期踩坑

- 子任务重命名输入框不能再包在 checkbox 的 `label` 里。
- checkbox 样式必须限定到 `type="checkbox"`，否则会污染文本输入框。
- 本地服务改完代码后，若页面仍表现旧版本，通常需要：
  - `launchctl kickstart -k gui/$(id -u)/com.huapingyu.taskflow.local`
  - 浏览器强制刷新

## 协作边界

- `docs/superpowers/specs/*` 和 `docs/superpowers/plans/*` 视为历史设计档案，不是现状手册。
- 若要更新知识层：
  - 用户使用入口、部署/启动说明优先写 `README.md`
  - 只对 AI 有用的项目事实写这里
- 不要把单次会话流水账塞进本文件。


<claude-mem-context>
# Memory Context

# [TaskFlow] recent context, 2026-06-20 10:41pm GMT+8

No previous sessions found.
</claude-mem-context>