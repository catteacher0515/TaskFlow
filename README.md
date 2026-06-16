# TaskFlow Progress Visualizer

本地模板化任务进度工具，用于把探索性任务拆成可见的小反馈和大反馈，并在任务失控时进入收束模式。

## 运行

```bash
npm install
npm run dev:server
npm run dev
```

默认地址：

- 前端：http://127.0.0.1:5173
- 本地 API：http://127.0.0.1:4317

## 数据

数据保存在项目目录的 `data/` 下：

- `data/settings.json`：全局设置。
- `data/templates/*.json`：模板。
- `data/projects/*.json`：项目实例。
- `data/activity-log.jsonl`：推进记录。

## 第一版内置模板

内置「每周 GitHub 精选」模板，用于亲测候选仓库，选出 5 个推荐项目，并完成文章发布。
