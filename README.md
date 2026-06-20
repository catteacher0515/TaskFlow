# TaskFlow Progress Visualizer

本地模板化任务进度工具，用于把探索性任务拆成可见的小反馈和大反馈，并在任务失控时进入收束模式。

当前这版已经支持：

- 项目列表分组、折叠、重命名
- 收束模式与并行上限 gate
- 通用任务树子任务的重命名与删除
- 反馈页的时间筛选、按天/周/月分组、批量删除
- 内置「每周 GitHub 精选」模板

## 本地使用

如果你只是自己在这台 Mac 上用，推荐直接把它当作本地工具使用。

固定访问地址：

- `http://taskflow.localhost:4317`

推荐做法：

- 把这个地址加到浏览器标签栏
- 第一次使用时双击 [open-taskflow.command](open-taskflow.command)
- 想关闭服务时双击 [stop-taskflow.command](stop-taskflow.command)

### 电脑重启后怎么打开

有两种方式：

1. 手动打开  
双击 `open-taskflow.command`，然后访问 `http://taskflow.localhost:4317`

2. 登录后自动启动  
双击 [install-taskflow-login-start.command](install-taskflow-login-start.command)  
之后每次登录 Mac，TaskFlow 都会在后台自动启动；如果服务意外退出，`launchd` 也会自动拉起

如果之后不想自动启动了，双击 [uninstall-taskflow-login-start.command](uninstall-taskflow-login-start.command) 即可。

### 终端方式

如果你更习惯终端，也可以用：

```bash
cd /Users/huapingyu/dev/TaskFlow
npm run local:open
```

关闭：

```bash
cd /Users/huapingyu/dev/TaskFlow
npm run local:stop
```

如果你不想每次先 `cd`，可以先双击 [install-taskflow-cli.command](install-taskflow-cli.command)。

安装后可用：

```bash
taskflow-open
taskflow-stop
```

## 开发运行

```bash
npm install
npm run dev:server
npm run dev
```

默认地址：

- 前端：http://127.0.0.1:5173
- 本地 API：http://127.0.0.1:4317

## 生产启动

```bash
npm install
npm run build
npm start
```

默认生产服务读取以下环境变量：

- `PORT`：服务端口，默认 `4317`
- `HOST`：监听地址，默认 `0.0.0.0`
- `DATA_DIR`：运行时数据目录；不提供时默认使用项目根目录下的 `data/`

生产环境下：

- 前端静态资源由 `vite build` 产出到 `dist/client`
- 后端会自动托管 `dist/client` 下的静态文件
- 所有 `/api/*` 请求仍然走 Express

## 可选部署

当前版本适合部署到支持 Node 服务和持久化磁盘的平台，例如 `Railway` 或 `Render`。

推荐最小部署方式：

1. 构建命令：

```bash
npm install && npm run build
```

2. 启动命令：

```bash
npm start
```

3. 环境变量：

```bash
PORT=3000
HOST=0.0.0.0
DATA_DIR=/data
```

4. 挂载一个持久化目录到 `/data`

这样做的原因：

- 项目实例、模板和反馈记录都写在 `DATA_DIR`
- 如果不挂持久化目录，重新部署后运行时数据会丢失
- 当前版本不是纯静态站，不适合直接部署到 GitHub Pages

## 数据

数据保存在项目目录的 `data/` 下：

- `data/settings.json`：全局设置。
- `data/templates/*.json`：模板。
- `data/projects/*.json`：项目实例。
- `data/activity-log.jsonl`：推进记录。

## 第一版内置模板

内置「每周 GitHub 精选」模板，用于亲测候选仓库，选出 5 个推荐项目，并完成文章发布。
