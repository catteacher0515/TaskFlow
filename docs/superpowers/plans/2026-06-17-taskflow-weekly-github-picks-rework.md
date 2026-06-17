# TaskFlow Weekly GitHub Picks Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把每周 GitHub 精选模板改成“亲测候选仓库 + 自动汇总推荐 + 成稿 + 发布平台任务”的结构，并修复旧周刊项目的迁移与可编辑性。

**Architecture:** 继续复用现有 `taskTree`，不恢复旧的 `stage / slot / progressObject` 交互。周刊候选仓库通过任务状态映射出 `入选 / 淘汰 / 暂缓`，`确定本周 5 个推荐` 作为只读派生区在客户端展示，旧项目由存储归一化逻辑迁移到新骨架。

**Tech Stack:** TypeScript, React, Express, Vitest

---

### Task 1: 更新周刊共享模型和默认骨架

**Files:**
- Modify: `src/shared/weeklyGithubTemplate.ts`
- Modify: `src/shared/projectFactory.ts`
- Create: `src/shared/weeklyGithubProject.ts`
- Modify: `tests/shared/projectFactory.test.ts`
- Modify: `tests/shared/weeklyGithubTemplate.test.ts`

- [ ] **Step 1: 写失败测试，锁定新骨架**

在 `tests/shared/projectFactory.test.ts` 中把周刊默认骨架断言改成：

```ts
expect(project.taskTree?.children.map((task) => task.title)).toEqual([
  "亲测候选仓库",
  "确定本周 5 个推荐",
  "成稿",
  "发布"
]);
expect(project.taskTree?.children[1]?.children).toEqual([]);
expect(project.taskTree?.children[3]?.children.map((task) => task.title)).toEqual([
  "抖音",
  "知乎",
  "B站",
  "小红书",
  "编程导航",
  "稀土掘金"
]);
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- tests/shared/projectFactory.test.ts tests/shared/weeklyGithubTemplate.test.ts`

Expected: 周刊骨架仍包含旧区块或旧推荐位，测试失败。

- [ ] **Step 3: 实现最小共享骨架和周刊辅助函数**

在 `src/shared/weeklyGithubProject.ts` 中提供：

```ts
export const WEEKLY_GITHUB_TEMPLATE_ID = "weekly-github-picks";
export const WEEKLY_GITHUB_PUBLISH_CHANNELS = ["抖音", "知乎", "B站", "小红书", "编程导航", "稀土掘金"] as const;
export function isWeeklyGithubProject(project: { templateId?: string }) {
  return project.templateId === WEEKLY_GITHUB_TEMPLATE_ID;
}
```

并在 `src/shared/projectFactory.ts` 中把周刊骨架改成：

```ts
children: [
  createTaskNode({ id: `${projectId}-hands-on`, title: "亲测候选仓库", now }),
  createTaskNode({ id: `${projectId}-pick`, title: "确定本周 5 个推荐", now }),
  createTaskNode({ id: `${projectId}-draft`, title: "成稿", now }),
  createTaskNode({
    id: `${projectId}-publish`,
    title: "发布",
    now,
    children: WEEKLY_GITHUB_PUBLISH_CHANNELS.map((title, index) =>
      createTaskNode({ id: `${projectId}-publish-${index + 1}`, title, now })
    )
  })
]
```

- [ ] **Step 4: 更新模板文案和最小动作**

在 `src/shared/weeklyGithubTemplate.ts` 中移除旧的 `write-one-reason` 语义，保留与新流程一致的动作标签，例如：

```ts
minimumActions: [
  { id: "review-one-repo", label: "处理 1 个候选仓库" },
  { id: "select-one-repo", label: "确认 1 个入选仓库" },
  { id: "finish-one-platform", label: "完成 1 个发布平台" }
]
```

- [ ] **Step 5: 跑共享层测试确认通过**

Run: `npm test -- tests/shared/projectFactory.test.ts tests/shared/weeklyGithubTemplate.test.ts`

Expected: PASS

### Task 2: 迁移旧周刊项目到新骨架

**Files:**
- Modify: `src/server/storage.ts`
- Modify: `src/shared/weeklyGithubProject.ts`
- Modify: `tests/server/storage.test.ts`

- [ ] **Step 1: 写失败测试，覆盖旧 taskTree 与旧 progressObjects 迁移**

在 `tests/server/storage.test.ts` 新增两类断言：

```ts
expect(state.projects[0].taskTree?.children.map((task) => task.title)).toEqual([
  "亲测候选仓库",
  "确定本周 5 个推荐",
  "成稿",
  "发布"
]);
expect(state.projects[0].taskTree?.children[0]?.children.map((task) => [task.title, task.status])).toEqual([
  ["whisper", "completed"],
  ["repo-maybe", "unhandled"],
  ["repo-rejected", "dropped"]
]);
expect(state.projects[0].taskTree?.children[3]?.children.map((task) => task.title)).toContain("知乎");
```

再覆盖已有 `taskTree` 但仍含 `收集候选仓库 / 写推荐理由 / 推荐1-5` 的项目会被归一化移除这些节点。

- [ ] **Step 2: 跑存储测试确认失败**

Run: `npm test -- tests/server/storage.test.ts`

Expected: 旧周刊项目仍保留旧节点或没有发布平台任务，测试失败。

- [ ] **Step 3: 在周刊辅助模块实现归一化函数**

在 `src/shared/weeklyGithubProject.ts` 中实现：

```ts
export function normalizeWeeklyGithubTaskTree(project: Project): TaskNode
export function weeklyGithubSelectedCandidates(rootTask: TaskNode): TaskNode[]
```

归一化规则：
- 固定根节点一级顺序：`亲测候选仓库 / 确定本周 5 个推荐 / 成稿 / 发布`
- `收集候选仓库` 下的候选迁到 `亲测候选仓库`
- 删除 `写推荐理由`
- 删除 `推荐1-5`
- `发布` 补齐六个平台子任务
- `progressObjects.selected -> completed`
- `progressObjects.rejected -> dropped`
- `progressObjects.maybe -> unhandled`

- [ ] **Step 4: 接入存储层归一化**

在 `src/server/storage.ts` 的 `weekly-github-picks` 分支中改为：

```ts
return {
  ...project,
  templateSnapshot: {
    ...project.templateSnapshot,
    stages: [],
    progressObject: undefined,
    slots: []
  },
  stages: [],
  progressObjects: [],
  slots: [],
  taskTree: normalizeWeeklyGithubTaskTree(project)
};
```

- [ ] **Step 5: 跑存储测试确认通过**

Run: `npm test -- tests/server/storage.test.ts`

Expected: PASS

### Task 3: 改造周刊详情页候选结果态和自动汇总区

**Files:**
- Modify: `src/client/components/ProjectDetail.tsx`
- Modify: `src/shared/weeklyGithubProject.ts`
- Modify: `tests/client/App.test.tsx`

- [ ] **Step 1: 写失败测试，覆盖候选项结果态和自动汇总**

在 `tests/client/App.test.tsx` 增加或改写断言：

```ts
expect(screen.queryByText("收集候选仓库")).not.toBeInTheDocument();
expect(screen.queryByText("写推荐理由")).not.toBeInTheDocument();
expect(screen.queryByText("推荐 1")).not.toBeInTheDocument();
expect(screen.getByText("抖音")).toBeInTheDocument();

await user.click(screen.getByRole("button", { name: "将 whisper 标记为入选" }));
expect(await screen.findByText("已入选 1")).toBeInTheDocument();
expect(screen.getByText("whisper")).toBeInTheDocument();
```

再覆盖把候选从 `入选` 改成 `暂缓` 后，会从自动汇总区消失。

- [ ] **Step 2: 跑客户端测试确认失败**

Run: `npm test -- tests/client/App.test.tsx`

Expected: 周刊详情仍显示旧节点、没有结果按钮或推荐汇总不更新，测试失败。

- [ ] **Step 3: 为详情页补周刊特例渲染**

在 `src/client/components/ProjectDetail.tsx` 中：
- 识别周刊项目
- 识别 `亲测候选仓库` 直属子项
- 为候选项渲染：

```tsx
<button onClick={() => onUpdateTaskStatus?.(projectId, task.id, "completed")}>
  将 {task.title} 标记为入选
</button>
<button onClick={() => onUpdateTaskStatus?.(projectId, task.id, "dropped")}>
  将 {task.title} 标记为淘汰
</button>
<button onClick={() => onUpdateTaskStatus?.(projectId, task.id, "unhandled")}>
  将 {task.title} 标记为暂缓
</button>
```

同时对 `确定本周 5 个推荐`：
- 不显示“添加小任务”
- 改为展示 `weeklyGithubSelectedCandidates(rootTask)` 的只读列表
- 显示 `已入选 N`

- [ ] **Step 4: 保留普通 Todo 行为不受影响**

在 `ProjectDetail.tsx` 中确保：
- 非周刊项目继续显示原有 checkbox / 添加子任务
- 周刊的 `成稿` 和 `发布` 仍保留普通 Todo 行为
- 周刊 `亲测候选仓库` 顶层仍保留新增候选输入框

- [ ] **Step 5: 跑客户端测试确认通过**

Run: `npm test -- tests/client/App.test.tsx`

Expected: PASS

### Task 4: 跑回归验证

**Files:**
- Modify: `data/templates/weekly-github-picks.json`

- [ ] **Step 1: 同步模板种子文件**

让 `data/templates/weekly-github-picks.json` 与 `src/shared/weeklyGithubTemplate.ts` 保持一致，避免种子测试回退。

- [ ] **Step 2: 跑周刊相关测试**

Run: `npm test -- tests/shared/projectFactory.test.ts tests/shared/weeklyGithubTemplate.test.ts tests/server/storage.test.ts tests/server/routes.test.ts tests/client/App.test.tsx`

Expected: PASS

- [ ] **Step 3: 跑全量测试**

Run: `npm test`

Expected: `102/102` 或当前全量总数全部通过

- [ ] **Step 4: 跑构建**

Run: `npm run build`

Expected: PASS
