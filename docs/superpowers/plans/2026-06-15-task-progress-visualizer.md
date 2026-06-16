# Task Progress Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local template-first task progress Web App that turns exploratory work into visible feedback, warns when work is overloaded, and enforces a one-task focus mode.

**Architecture:** Use a small TypeScript app with shared domain modules, an Express local API server, JSON/JSONL files under `data/`, and a Vite React frontend. Keep business rules in shared/server modules so warnings, focus enforcement, and project updates are testable without the browser.

**Tech Stack:** Node.js 20+, TypeScript, Express, Vite, React, Vitest, Testing Library, JSON files, JSONL activity log.

---

## Scope Check

The spec describes one MVP with four connected parts: local storage, template/project domain rules, API, and frontend. These parts should stay in one implementation plan because each part is needed for a working local Web App, but tasks below are ordered so every task can be verified independently.

Current repository state: `/Users/huapingyu/dev/TaskFlow` is not a git repository. Commit steps below assume implementation happens after git is initialized or inside a git worktree. If the workspace is still not a git repository when executing a task, replace that task's commit step with `git diff --stat` and report that no commit was created.

## File Structure

Create this structure:

```text
package.json
tsconfig.json
vite.config.ts
vitest.config.ts
index.html
data/
  settings.json
  focus-mode.json
  templates/
    weekly-github-picks.json
  projects/
  activity-log.jsonl
src/
  shared/
    types.ts
    weeklyGithubTemplate.ts
    projectFactory.ts
    progress.ts
    warnings.ts
    focusMode.ts
  server/
    app.ts
    index.ts
    storage.ts
    routes.ts
  client/
    main.tsx
    App.tsx
    api.ts
    styles.css
    components/
      CurrentPanel.tsx
      ProjectList.tsx
      ProjectDetail.tsx
      TemplateManager.tsx
      FocusModePanel.tsx
tests/
  shared/
    weeklyGithubTemplate.test.ts
    projectFactory.test.ts
    progress.test.ts
    warnings.test.ts
    focusMode.test.ts
  server/
    storage.test.ts
    routes.test.ts
  client/
    App.test.tsx
```

Responsibility boundaries:

- `src/shared/types.ts`: canonical domain types. No Node or React imports.
- `src/shared/weeklyGithubTemplate.ts`: built-in template only.
- `src/shared/projectFactory.ts`: create projects from templates and snapshot template structure.
- `src/shared/progress.ts`: progress object transitions, slot filling, stage advancement, activity entries.
- `src/shared/warnings.ts`: parallel, deadline, and stagnation warning evaluation.
- `src/shared/focusMode.ts`: focus selection, 5-minute block state, mutation permission checks.
- `src/server/storage.ts`: JSON/JSONL file IO, focus mode persistence, initialization, parse errors without overwriting corrupt files.
- `src/server/routes.ts`: HTTP routes and mutation enforcement.
- `src/client/*`: browser UI only; business logic stays in shared modules.

## Shared Domain Names

Use these names consistently:

```ts
export type ProjectStatus = "not_started" | "active" | "paused" | "completed";
export type WarningType = "parallel_limit" | "deadline_risk" | "stagnation";
export type FeedbackKind = "small" | "big";
export type FocusSessionResult = "recorded" | "continued" | "blocked";
```

Use ISO date strings for persisted dates. Use deterministic IDs in tests and `crypto.randomUUID()` in runtime code.

---

### Task 1: Project Tooling And Empty App

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/styles.css`
- Test: `tests/client/App.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

Create `tests/client/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/client/App";

describe("App", () => {
  it("renders the product shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "任务进度" })).toBeInTheDocument();
    expect(screen.getByText("模板优先的本地进度工具")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add tooling files**

Create `package.json`:

```json
{
  "name": "taskflow-progress-visualizer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "dev:server": "tsx src/server/index.ts",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "node dist/server/index.js"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.5.0",
    "express": "^4.19.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^15.0.7",
    "@testing-library/user-event": "^14.5.2",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.8",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^24.1.1",
    "tsx": "^4.16.2",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4317"
    }
  }
});
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"]
  }
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>任务进度</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Add minimal React shell**

Create `src/client/App.tsx`:

```tsx
import "./styles.css";

export function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">模板优先的本地进度工具</p>
        <h1>任务进度</h1>
      </section>
    </main>
  );
}
```

Create `src/client/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create `src/client/styles.css`:

```css
:root {
  color: #172033;
  background: #f5f7fb;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 28px;
}

.hero {
  max-width: 1180px;
  margin: 0 auto 20px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #526179;
  font-size: 14px;
}

h1 {
  margin: 0;
  font-size: 34px;
  letter-spacing: 0;
}
```

- [ ] **Step 4: Run smoke test**

Run:

```bash
npm install
npm test -- tests/client/App.test.tsx
```

Expected: PASS, with the App smoke test passing.

- [ ] **Step 5: Run type/build check**

Run:

```bash
npm run build
```

Expected: TypeScript check passes and Vite produces a production build.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html src/client tests/client tests/setup.ts
git commit -m "chore: scaffold local task progress app"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 2: Shared Types And Weekly GitHub Template

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/weeklyGithubTemplate.ts`
- Test: `tests/shared/weeklyGithubTemplate.test.ts`

- [ ] **Step 1: Write the failing template test**

Create `tests/shared/weeklyGithubTemplate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";

describe("weeklyGithubTemplate", () => {
  it("defines candidate repository states as template-local states", () => {
    expect(weeklyGithubTemplate.id).toBe("weekly-github-picks");
    expect(weeklyGithubTemplate.progressObject.name).toBe("候选仓库");
    expect(weeklyGithubTemplate.progressObject.states.map((state) => state.id)).toEqual([
      "untested",
      "testing",
      "selected",
      "maybe",
      "rejected"
    ]);
    expect(weeklyGithubTemplate.progressObject.feedbackStateIds).toEqual([
      "selected",
      "maybe",
      "rejected"
    ]);
  });

  it("defines five recommendation slots and six stages", () => {
    expect(weeklyGithubTemplate.slots).toHaveLength(5);
    expect(weeklyGithubTemplate.stages.map((stage) => stage.name)).toEqual([
      "候选收集",
      "亲测",
      "推荐选择",
      "推荐理由写作",
      "成稿",
      "发布"
    ]);
  });

  it("keeps recurrence and warning rules explicit", () => {
    expect(weeklyGithubTemplate.recurrence.defaultRule).toEqual({ kind: "weekly" });
    expect(weeklyGithubTemplate.warningRules.deadlineRisk.daysBeforeDeadline).toBe(2);
    expect(weeklyGithubTemplate.warningRules.stagnation.daysWithoutActivity).toBe(2);
  });
});
```

- [ ] **Step 2: Define shared types**

Create `src/shared/types.ts`:

```ts
export type ProjectStatus = "not_started" | "active" | "paused" | "completed";
export type WarningType = "parallel_limit" | "deadline_risk" | "stagnation";
export type FeedbackKind = "small" | "big";
export type FocusSessionResult = "recorded" | "continued" | "blocked";

export interface Settings {
  dataVersion: 1;
  activeProjectLimit: number;
  defaultStagnationDays: number;
}

export interface RecurrenceRule {
  kind: "none" | "daily" | "weekly" | "monthly" | "workdays" | "custom_interval";
  intervalDays?: number;
}

export interface StageDefinition {
  id: string;
  name: string;
}

export interface ProgressStateDefinition {
  id: string;
  name: string;
  category: "open" | "in_progress" | "concluded";
}

export interface ProgressObjectDefinition {
  name: string;
  fields: string[];
  states: ProgressStateDefinition[];
  feedbackStateIds: string[];
}

export interface SlotDefinition {
  id: string;
  name: string;
}

export interface MinimumActionDefinition {
  id: string;
  label: string;
}

export interface WarningRules {
  parallelLimit?: {
    useGlobalLimit: boolean;
    limit?: number;
  };
  deadlineRisk?: {
    daysBeforeDeadline: number;
    requiredFilledSlotRatio?: number;
    requiredStageId?: string;
  };
  stagnation?: {
    daysWithoutActivity: number;
  };
}

export interface Template {
  id: string;
  name: string;
  description: string;
  stages: StageDefinition[];
  progressObject?: ProgressObjectDefinition;
  slots: SlotDefinition[];
  minimumActions: MinimumActionDefinition[];
  recurrence: {
    supportedRules: RecurrenceRule["kind"][];
    defaultRule: RecurrenceRule;
  };
  warningRules: WarningRules;
}

export interface StageInstance extends StageDefinition {
  status: "not_started" | "active" | "completed";
}

export interface ProgressObjectInstance {
  id: string;
  title: string;
  stateId: string;
  fields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface SlotInstance extends SlotDefinition {
  progressObjectId?: string;
  filledAt?: string;
}

export interface TemplateSnapshot {
  templateId?: string;
  templateName: string;
  stages: StageDefinition[];
  progressObject?: ProgressObjectDefinition;
  slots: SlotDefinition[];
  minimumActions: MinimumActionDefinition[];
  warningRules: WarningRules;
}

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  templateId?: string;
  templateSnapshot: TemplateSnapshot;
  recurrence: RecurrenceRule;
  deadline?: string;
  stages: StageInstance[];
  progressObjects: ProgressObjectInstance[];
  slots: SlotInstance[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: string;
  projectId: string;
  kind: FeedbackKind;
  message: string;
  createdAt: string;
  progressObjectId?: string;
  slotId?: string;
  stageId?: string;
}

export interface Warning {
  id: string;
  type: WarningType;
  projectId?: string;
  message: string;
  severity: "warning" | "blocking";
  createdAt: string;
}

export interface FocusModeState {
  status: "inactive" | "active";
  selectedProjectId?: string;
  selectedActionId?: string;
  customActionLabel?: string;
  session?: {
    startedAt: string;
    durationMinutes: 5;
    result?: FocusSessionResult;
  };
}

export interface AppState {
  settings: Settings;
  templates: Template[];
  projects: Project[];
  activity: ActivityEntry[];
  warnings: Warning[];
  focusMode: FocusModeState;
}
```

- [ ] **Step 3: Add the weekly template**

Create `src/shared/weeklyGithubTemplate.ts`:

```ts
import type { Template } from "./types";

export const weeklyGithubTemplate: Template = {
  id: "weekly-github-picks",
  name: "每周 GitHub 精选",
  description: "亲测候选仓库，选出 5 个值得推荐的项目，并完成文章发布。",
  stages: [
    { id: "collect", name: "候选收集" },
    { id: "hands_on", name: "亲测" },
    { id: "select", name: "推荐选择" },
    { id: "write_reasons", name: "推荐理由写作" },
    { id: "draft", name: "成稿" },
    { id: "publish", name: "发布" }
  ],
  progressObject: {
    name: "候选仓库",
    fields: ["repoName", "url", "source", "notes", "testLog", "decisionReason"],
    states: [
      { id: "untested", name: "未测", category: "open" },
      { id: "testing", name: "测试中", category: "in_progress" },
      { id: "selected", name: "入选", category: "concluded" },
      { id: "maybe", name: "备选", category: "concluded" },
      { id: "rejected", name: "淘汰", category: "concluded" }
    ],
    feedbackStateIds: ["selected", "maybe", "rejected"]
  },
  slots: [
    { id: "recommendation-1", name: "推荐 1" },
    { id: "recommendation-2", name: "推荐 2" },
    { id: "recommendation-3", name: "推荐 3" },
    { id: "recommendation-4", name: "推荐 4" },
    { id: "recommendation-5", name: "推荐 5" }
  ],
  minimumActions: [
    { id: "test-one-repo", label: "亲测 1 个候选仓库" },
    { id: "write-one-decision", label: "给 1 个候选仓库写结论理由" },
    { id: "fill-one-slot", label: "填入 1 个推荐槽位" },
    { id: "draft-one-reason", label: "写完 1 个推荐理由草稿" }
  ],
  recurrence: {
    supportedRules: ["none", "daily", "weekly", "monthly", "workdays", "custom_interval"],
    defaultRule: { kind: "weekly" }
  },
  warningRules: {
    parallelLimit: { useGlobalLimit: true },
    deadlineRisk: {
      daysBeforeDeadline: 2,
      requiredFilledSlotRatio: 1,
      requiredStageId: "write_reasons"
    },
    stagnation: {
      daysWithoutActivity: 2
    }
  }
};
```

- [ ] **Step 4: Run the template test**

Run:

```bash
npm test -- tests/shared/weeklyGithubTemplate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/shared/types.ts src/shared/weeklyGithubTemplate.ts tests/shared/weeklyGithubTemplate.test.ts
git commit -m "feat: define template-based domain model"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 3: Project Creation From Template Snapshot

**Files:**
- Create: `src/shared/projectFactory.ts`
- Test: `tests/shared/projectFactory.test.ts`

- [ ] **Step 1: Write the failing project factory test**

Create `tests/shared/projectFactory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createProjectFromTemplate } from "../../src/shared/projectFactory";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";

describe("createProjectFromTemplate", () => {
  it("creates a project with a template snapshot", () => {
    const project = createProjectFromTemplate({
      id: "project-1",
      template: weeklyGithubTemplate,
      title: "每周 GitHub 精选 2026-W25",
      deadline: "2026-06-21T14:00:00.000Z",
      recurrence: { kind: "weekly" },
      now: "2026-06-15T10:00:00.000Z"
    });

    expect(project.templateId).toBe("weekly-github-picks");
    expect(project.templateSnapshot.templateName).toBe("每周 GitHub 精选");
    expect(project.stages[0]).toEqual({ id: "collect", name: "候选收集", status: "active" });
    expect(project.stages.slice(1).every((stage) => stage.status === "not_started")).toBe(true);
    expect(project.slots).toHaveLength(5);
    expect(project.progressObjects).toEqual([]);
  });

  it("does not share mutable stage arrays with the template", () => {
    const project = createProjectFromTemplate({
      id: "project-1",
      template: weeklyGithubTemplate,
      title: "每周 GitHub 精选 2026-W25",
      recurrence: { kind: "weekly" },
      now: "2026-06-15T10:00:00.000Z"
    });

    project.templateSnapshot.stages[0].name = "changed";

    expect(weeklyGithubTemplate.stages[0].name).toBe("候选收集");
  });
});
```

- [ ] **Step 2: Implement project creation**

Create `src/shared/projectFactory.ts`:

```ts
import type { Project, RecurrenceRule, Template } from "./types";

interface CreateProjectInput {
  id: string;
  template: Template;
  title: string;
  recurrence: RecurrenceRule;
  now: string;
  deadline?: string;
}

export function createProjectFromTemplate(input: CreateProjectInput): Project {
  const stages = input.template.stages.map((stage, index) => ({
    ...stage,
    status: index === 0 ? "active" as const : "not_started" as const
  }));

  return {
    id: input.id,
    title: input.title,
    status: "not_started",
    templateId: input.template.id,
    templateSnapshot: {
      templateId: input.template.id,
      templateName: input.template.name,
      stages: structuredClone(input.template.stages),
      progressObject: input.template.progressObject
        ? structuredClone(input.template.progressObject)
        : undefined,
      slots: structuredClone(input.template.slots),
      minimumActions: structuredClone(input.template.minimumActions),
      warningRules: structuredClone(input.template.warningRules)
    },
    recurrence: input.recurrence,
    deadline: input.deadline,
    stages,
    progressObjects: [],
    slots: input.template.slots.map((slot) => ({ ...slot })),
    createdAt: input.now,
    updatedAt: input.now
  };
}
```

- [ ] **Step 3: Run the project factory test**

Run:

```bash
npm test -- tests/shared/projectFactory.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/shared/projectFactory.ts tests/shared/projectFactory.test.ts
git commit -m "feat: create projects from template snapshots"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 4: Progress Objects, Slots, Stages, And Activity Entries

**Files:**
- Create: `src/shared/progress.ts`
- Test: `tests/shared/progress.test.ts`

- [ ] **Step 1: Write failing progress tests**

Create `tests/shared/progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addProgressObject, advanceStage, fillSlot, transitionProgressObject } from "../../src/shared/progress";
import { createProjectFromTemplate } from "../../src/shared/projectFactory";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";

function makeProject() {
  return createProjectFromTemplate({
    id: "project-1",
    template: weeklyGithubTemplate,
    title: "每周 GitHub 精选 2026-W25",
    recurrence: { kind: "weekly" },
    now: "2026-06-15T10:00:00.000Z"
  });
}

describe("progress updates", () => {
  it("adds a progress object using template-local initial state", () => {
    const project = makeProject();
    const updated = addProgressObject(project, {
      id: "repo-1",
      title: "owner/repo",
      fields: { url: "https://github.com/owner/repo" },
      now: "2026-06-15T10:05:00.000Z"
    });

    expect(updated.progressObjects[0].stateId).toBe("untested");
    expect(updated.progressObjects[0].fields.url).toBe("https://github.com/owner/repo");
  });

  it("creates small feedback when a progress object reaches a feedback state", () => {
    const project = addProgressObject(makeProject(), {
      id: "repo-1",
      title: "owner/repo",
      fields: {},
      now: "2026-06-15T10:05:00.000Z"
    });

    const result = transitionProgressObject(project, {
      activityId: "activity-1",
      progressObjectId: "repo-1",
      nextStateId: "rejected",
      note: "安装失败，无法推荐",
      now: "2026-06-15T10:10:00.000Z"
    });

    expect(result.project.progressObjects[0].stateId).toBe("rejected");
    expect(result.activity).toEqual({
      id: "activity-1",
      projectId: "project-1",
      kind: "small",
      message: "候选仓库 owner/repo 进入 淘汰：安装失败，无法推荐",
      progressObjectId: "repo-1",
      createdAt: "2026-06-15T10:10:00.000Z"
    });
  });

  it("creates big feedback when filling a slot", () => {
    const project = addProgressObject(makeProject(), {
      id: "repo-1",
      title: "owner/repo",
      fields: {},
      now: "2026-06-15T10:05:00.000Z"
    });

    const result = fillSlot(project, {
      activityId: "activity-2",
      slotId: "recommendation-1",
      progressObjectId: "repo-1",
      now: "2026-06-15T10:20:00.000Z"
    });

    expect(result.project.slots[0].progressObjectId).toBe("repo-1");
    expect(result.activity.kind).toBe("big");
    expect(result.activity.message).toBe("推荐 1 已填入 owner/repo，槽位进度 1 / 5");
  });

  it("creates big feedback when advancing a stage", () => {
    const result = advanceStage(makeProject(), {
      activityId: "activity-3",
      completedStageId: "collect",
      nextStageId: "hands_on",
      now: "2026-06-15T10:30:00.000Z"
    });

    expect(result.project.stages[0].status).toBe("completed");
    expect(result.project.stages[1].status).toBe("active");
    expect(result.activity.message).toBe("阶段完成：候选收集");
  });
});
```

- [ ] **Step 2: Implement progress helpers**

Create `src/shared/progress.ts`:

```ts
import type { ActivityEntry, Project, ProgressObjectInstance } from "./types";

interface AddProgressObjectInput {
  id: string;
  title: string;
  fields: Record<string, string>;
  now: string;
}

interface TransitionInput {
  activityId: string;
  progressObjectId: string;
  nextStateId: string;
  note: string;
  now: string;
}

interface FillSlotInput {
  activityId: string;
  slotId: string;
  progressObjectId: string;
  now: string;
}

interface AdvanceStageInput {
  activityId: string;
  completedStageId: string;
  nextStageId?: string;
  now: string;
}

export function addProgressObject(project: Project, input: AddProgressObjectInput): Project {
  const definition = project.templateSnapshot.progressObject;

  if (!definition) {
    throw new Error("Project template does not define progress objects");
  }

  const initialState = definition.states[0];

  if (!initialState) {
    throw new Error("Progress object definition must include at least one state");
  }

  const progressObject: ProgressObjectInstance = {
    id: input.id,
    title: input.title,
    stateId: initialState.id,
    fields: input.fields,
    createdAt: input.now,
    updatedAt: input.now
  };

  return {
    ...project,
    progressObjects: [...project.progressObjects, progressObject],
    updatedAt: input.now
  };
}

export function transitionProgressObject(project: Project, input: TransitionInput): { project: Project; activity?: ActivityEntry } {
  const definition = project.templateSnapshot.progressObject;

  if (!definition) {
    throw new Error("Project template does not define progress objects");
  }

  const nextState = definition.states.find((state) => state.id === input.nextStateId);

  if (!nextState) {
    throw new Error(`Unknown progress state: ${input.nextStateId}`);
  }

  let targetTitle = "";
  const progressObjects = project.progressObjects.map((item) => {
    if (item.id !== input.progressObjectId) {
      return item;
    }

    targetTitle = item.title;
    return {
      ...item,
      stateId: input.nextStateId,
      updatedAt: input.now
    };
  });

  if (!targetTitle) {
    throw new Error(`Unknown progress object: ${input.progressObjectId}`);
  }

  const updatedProject = {
    ...project,
    progressObjects,
    updatedAt: input.now
  };

  if (!definition.feedbackStateIds.includes(input.nextStateId)) {
    return { project: updatedProject };
  }

  return {
    project: updatedProject,
    activity: {
      id: input.activityId,
      projectId: project.id,
      kind: "small",
      message: `${definition.name} ${targetTitle} 进入 ${nextState.name}：${input.note}`,
      progressObjectId: input.progressObjectId,
      createdAt: input.now
    }
  };
}

export function fillSlot(project: Project, input: FillSlotInput): { project: Project; activity: ActivityEntry } {
  const progressObject = project.progressObjects.find((item) => item.id === input.progressObjectId);

  if (!progressObject) {
    throw new Error(`Unknown progress object: ${input.progressObjectId}`);
  }

  let slotName = "";
  const slots = project.slots.map((slot) => {
    if (slot.id !== input.slotId) {
      return slot;
    }

    slotName = slot.name;
    return {
      ...slot,
      progressObjectId: input.progressObjectId,
      filledAt: input.now
    };
  });

  if (!slotName) {
    throw new Error(`Unknown slot: ${input.slotId}`);
  }

  const filledCount = slots.filter((slot) => slot.progressObjectId).length;

  return {
    project: {
      ...project,
      slots,
      updatedAt: input.now
    },
    activity: {
      id: input.activityId,
      projectId: project.id,
      kind: "big",
      message: `${slotName} 已填入 ${progressObject.title}，槽位进度 ${filledCount} / ${slots.length}`,
      slotId: input.slotId,
      progressObjectId: input.progressObjectId,
      createdAt: input.now
    }
  };
}

export function advanceStage(project: Project, input: AdvanceStageInput): { project: Project; activity: ActivityEntry } {
  const completedStage = project.stages.find((stage) => stage.id === input.completedStageId);

  if (!completedStage) {
    throw new Error(`Unknown stage: ${input.completedStageId}`);
  }

  const stages = project.stages.map((stage) => {
    if (stage.id === input.completedStageId) {
      return { ...stage, status: "completed" as const };
    }

    if (stage.id === input.nextStageId) {
      return { ...stage, status: "active" as const };
    }

    return stage;
  });

  return {
    project: {
      ...project,
      stages,
      updatedAt: input.now
    },
    activity: {
      id: input.activityId,
      projectId: project.id,
      kind: "big",
      message: `阶段完成：${completedStage.name}`,
      stageId: completedStage.id,
      createdAt: input.now
    }
  };
}
```

- [ ] **Step 3: Run progress tests**

Run:

```bash
npm test -- tests/shared/progress.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/shared/progress.ts tests/shared/progress.test.ts
git commit -m "feat: record small and big progress feedback"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 5: Warning Engine

**Files:**
- Create: `src/shared/warnings.ts`
- Test: `tests/shared/warnings.test.ts`

- [ ] **Step 1: Write failing warning tests**

Create `tests/shared/warnings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ActivityEntry, Project, Settings } from "../../src/shared/types";
import { evaluateWarnings } from "../../src/shared/warnings";
import { createProjectFromTemplate } from "../../src/shared/projectFactory";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";

const settings: Settings = {
  dataVersion: 1,
  activeProjectLimit: 1,
  defaultStagnationDays: 2
};

function makeProject(id: string, title = id): Project {
  return {
    ...createProjectFromTemplate({
      id,
      template: weeklyGithubTemplate,
      title,
      recurrence: { kind: "weekly" },
      deadline: "2026-06-17T12:00:00.000Z",
      now: "2026-06-15T08:00:00.000Z"
    }),
    status: "active"
  };
}

describe("evaluateWarnings", () => {
  it("warns when active project count exceeds the limit", () => {
    const warnings = evaluateWarnings({
      settings,
      projects: [makeProject("project-1"), makeProject("project-2")],
      activity: [],
      now: "2026-06-15T10:00:00.000Z"
    });

    expect(warnings.some((warning) => warning.type === "parallel_limit")).toBe(true);
  });

  it("warns when deadline is close and slots are not filled", () => {
    const warnings = evaluateWarnings({
      settings,
      projects: [makeProject("project-1")],
      activity: [],
      now: "2026-06-16T13:00:00.000Z"
    });

    expect(warnings).toContainEqual(
      expect.objectContaining({
        type: "deadline_risk",
        projectId: "project-1",
        severity: "blocking"
      })
    );
  });

  it("warns when an active project has no recent activity", () => {
    const oldActivity: ActivityEntry = {
      id: "activity-1",
      projectId: "project-1",
      kind: "small",
      message: "old",
      createdAt: "2026-06-12T10:00:00.000Z"
    };

    const warnings = evaluateWarnings({
      settings,
      projects: [makeProject("project-1")],
      activity: [oldActivity],
      now: "2026-06-15T10:00:00.000Z"
    });

    expect(warnings).toContainEqual(
      expect.objectContaining({
        type: "stagnation",
        projectId: "project-1",
        severity: "blocking"
      })
    );
  });
});
```

- [ ] **Step 2: Implement warning evaluation**

Create `src/shared/warnings.ts`:

```ts
import type { ActivityEntry, Project, Settings, Warning } from "./types";

interface EvaluateWarningsInput {
  settings: Settings;
  projects: Project[];
  activity: ActivityEntry[];
  now: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function evaluateWarnings(input: EvaluateWarningsInput): Warning[] {
  const nowDate = new Date(input.now);
  const activeProjects = input.projects.filter((project) => project.status === "active");
  const warnings: Warning[] = [];

  if (activeProjects.length > input.settings.activeProjectLimit) {
    warnings.push({
      id: `parallel-limit-${input.now}`,
      type: "parallel_limit",
      message: `进行中项目 ${activeProjects.length} / ${input.settings.activeProjectLimit}，需要进入收束模式。`,
      severity: "blocking",
      createdAt: input.now
    });
  }

  for (const project of activeProjects) {
    const rules = project.templateSnapshot.warningRules;

    if (project.deadline && rules.deadlineRisk) {
      const deadlineDate = new Date(project.deadline);
      const daysUntilDeadline = (deadlineDate.getTime() - nowDate.getTime()) / DAY_MS;
      const filledSlots = project.slots.filter((slot) => slot.progressObjectId).length;
      const requiredRatio = rules.deadlineRisk.requiredFilledSlotRatio ?? 1;
      const slotRatio = project.slots.length === 0 ? 1 : filledSlots / project.slots.length;
      const requiredStage = rules.deadlineRisk.requiredStageId
        ? project.stages.find((stage) => stage.id === rules.deadlineRisk.requiredStageId)
        : undefined;
      const stageNotReached = requiredStage ? requiredStage.status === "not_started" : false;

      if (daysUntilDeadline <= rules.deadlineRisk.daysBeforeDeadline && (slotRatio < requiredRatio || stageNotReached)) {
        warnings.push({
          id: `deadline-risk-${project.id}-${input.now}`,
          type: "deadline_risk",
          projectId: project.id,
          message: `${project.title} 接近截止时间，但关键进度不足。`,
          severity: "blocking",
          createdAt: input.now
        });
      }
    }

    const stagnationDays = rules.stagnation?.daysWithoutActivity ?? input.settings.defaultStagnationDays;
    const latestActivity = input.activity
      .filter((entry) => entry.projectId === project.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const lastMovement = latestActivity?.createdAt ?? project.updatedAt;
    const daysSinceMovement = (nowDate.getTime() - new Date(lastMovement).getTime()) / DAY_MS;

    if (daysSinceMovement >= stagnationDays) {
      warnings.push({
        id: `stagnation-${project.id}-${input.now}`,
        type: "stagnation",
        projectId: project.id,
        message: `${project.title} 已经 ${Math.floor(daysSinceMovement)} 天没有推进记录。`,
        severity: "blocking",
        createdAt: input.now
      });
    }
  }

  return warnings;
}
```

- [ ] **Step 3: Run warning tests**

Run:

```bash
npm test -- tests/shared/warnings.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/shared/warnings.ts tests/shared/warnings.test.ts
git commit -m "feat: evaluate overload warnings"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 6: Focus Mode Rules

**Files:**
- Create: `src/shared/focusMode.ts`
- Test: `tests/shared/focusMode.test.ts`

- [ ] **Step 1: Write failing focus mode tests**

Create `tests/shared/focusMode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canMutateProject, completeFocusSession, selectFocusProject } from "../../src/shared/focusMode";
import type { FocusModeState, Warning } from "../../src/shared/types";

const blockingWarning: Warning = {
  id: "warning-1",
  type: "parallel_limit",
  message: "too many",
  severity: "blocking",
  createdAt: "2026-06-15T10:00:00.000Z"
};

describe("focus mode", () => {
  it("selects one project and starts a 5-minute session", () => {
    const state = selectFocusProject({
      warnings: [blockingWarning],
      projectId: "project-1",
      selectedActionId: "test-one-repo",
      customActionLabel: undefined,
      now: "2026-06-15T10:01:00.000Z"
    });

    expect(state).toEqual({
      status: "active",
      selectedProjectId: "project-1",
      selectedActionId: "test-one-repo",
      customActionLabel: undefined,
      session: {
        startedAt: "2026-06-15T10:01:00.000Z",
        durationMinutes: 5
      }
    });
  });

  it("blocks mutations on non-selected projects while active", () => {
    const state: FocusModeState = {
      status: "active",
      selectedProjectId: "project-1",
      session: {
        startedAt: "2026-06-15T10:01:00.000Z",
        durationMinutes: 5
      }
    };

    expect(canMutateProject(state, "project-1")).toBe(true);
    expect(canMutateProject(state, "project-2")).toBe(false);
  });

  it("records the result of a focus session", () => {
    const state: FocusModeState = {
      status: "active",
      selectedProjectId: "project-1",
      session: {
        startedAt: "2026-06-15T10:01:00.000Z",
        durationMinutes: 5
      }
    };

    const completed = completeFocusSession(state, "blocked");

    expect(completed.session?.result).toBe("blocked");
  });
});
```

- [ ] **Step 2: Implement focus mode helpers**

Create `src/shared/focusMode.ts`:

```ts
import type { FocusModeState, FocusSessionResult, Warning } from "./types";

interface SelectFocusInput {
  warnings: Warning[];
  projectId: string;
  selectedActionId?: string;
  customActionLabel?: string;
  now: string;
}

export function selectFocusProject(input: SelectFocusInput): FocusModeState {
  const hasBlockingWarning = input.warnings.some((warning) => warning.severity === "blocking");

  if (!hasBlockingWarning) {
    throw new Error("Focus mode requires at least one blocking warning");
  }

  return {
    status: "active",
    selectedProjectId: input.projectId,
    selectedActionId: input.selectedActionId,
    customActionLabel: input.customActionLabel,
    session: {
      startedAt: input.now,
      durationMinutes: 5
    }
  };
}

export function canMutateProject(focusMode: FocusModeState, projectId: string): boolean {
  if (focusMode.status !== "active") {
    return true;
  }

  return focusMode.selectedProjectId === projectId;
}

export function completeFocusSession(focusMode: FocusModeState, result: FocusSessionResult): FocusModeState {
  if (focusMode.status !== "active" || !focusMode.session) {
    throw new Error("No active focus session");
  }

  return {
    ...focusMode,
    session: {
      ...focusMode.session,
      result
    }
  };
}
```

- [ ] **Step 3: Run focus tests**

Run:

```bash
npm test -- tests/shared/focusMode.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/shared/focusMode.ts tests/shared/focusMode.test.ts
git commit -m "feat: enforce one-project focus mode"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 7: Local File Storage

**Files:**
- Create: `src/server/storage.ts`
- Create: `data/settings.json`
- Create: `data/focus-mode.json`
- Create: `data/templates/weekly-github-picks.json`
- Create: `data/projects/.gitkeep`
- Create: `data/activity-log.jsonl`
- Test: `tests/server/storage.test.ts`

- [ ] **Step 1: Write failing storage tests**

Create `tests/server/storage.test.ts`:

```ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { appendActivity, initializeDataDir, readJsonFile, readState, writeFocusMode, writeProject } from "../../src/server/storage";
import { createProjectFromTemplate } from "../../src/shared/projectFactory";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";

let roots: string[] = [];

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), "taskflow-storage-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots = [];
});

describe("storage", () => {
  it("initializes default data files without projects", async () => {
    const root = await tempRoot();

    await initializeDataDir(root);
    const state = await readState(root);

    expect(state.settings.activeProjectLimit).toBe(3);
    expect(state.templates[0].id).toBe("weekly-github-picks");
    expect(state.projects).toEqual([]);
    expect(state.focusMode).toEqual({ status: "inactive" });
  });

  it("does not overwrite corrupt json when reading", async () => {
    const root = await tempRoot();
    await initializeDataDir(root);
    await writeFile(join(root, "data", "settings.json"), "{ broken json", "utf8");

    await expect(readJsonFile(join(root, "data", "settings.json"))).rejects.toThrow("Invalid JSON file");
    const raw = await readFile(join(root, "data", "settings.json"), "utf8");
    expect(raw).toBe("{ broken json");
  });

  it("writes project json and appends activity jsonl", async () => {
    const root = await tempRoot();
    await initializeDataDir(root);
    const project = createProjectFromTemplate({
      id: "project-1",
      template: weeklyGithubTemplate,
      title: "每周 GitHub 精选 2026-W25",
      recurrence: { kind: "weekly" },
      now: "2026-06-15T10:00:00.000Z"
    });

    await writeProject(root, project);
    await appendActivity(root, {
      id: "activity-1",
      projectId: "project-1",
      kind: "small",
      message: "done",
      createdAt: "2026-06-15T10:10:00.000Z"
    });

    const state = await readState(root);
    expect(state.projects[0].id).toBe("project-1");
    expect(state.activity[0].message).toBe("done");
  });

  it("persists focus mode state", async () => {
    const root = await tempRoot();
    await initializeDataDir(root);

    await writeFocusMode(root, {
      status: "active",
      selectedProjectId: "project-1",
      selectedActionId: "test-one-repo",
      session: {
        startedAt: "2026-06-15T10:00:00.000Z",
        durationMinutes: 5
      }
    });

    const state = await readState(root);
    expect(state.focusMode.status).toBe("active");
    expect(state.focusMode.selectedProjectId).toBe("project-1");
  });
});
```

- [ ] **Step 2: Implement storage**

Create `src/server/storage.ts`:

```ts
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ActivityEntry, AppState, FocusModeState, Project, Settings, Template } from "../shared/types";
import { weeklyGithubTemplate } from "../shared/weeklyGithubTemplate";

const defaultSettings: Settings = {
  dataVersion: 1,
  activeProjectLimit: 3,
  defaultStagnationDays: 2
};

const defaultFocusMode: FocusModeState = {
  status: "inactive"
};

export function dataDir(rootDir: string) {
  return join(rootDir, "data");
}

export async function initializeDataDir(rootDir: string) {
  const root = dataDir(rootDir);
  await mkdir(join(root, "templates"), { recursive: true });
  await mkdir(join(root, "projects"), { recursive: true });

  await writeIfMissing(join(root, "settings.json"), `${JSON.stringify(defaultSettings, null, 2)}\n`);
  await writeIfMissing(join(root, "focus-mode.json"), `${JSON.stringify(defaultFocusMode, null, 2)}\n`);
  await writeIfMissing(join(root, "templates", "weekly-github-picks.json"), `${JSON.stringify(weeklyGithubTemplate, null, 2)}\n`);
  await writeIfMissing(join(root, "projects", ".gitkeep"), "");
  await writeIfMissing(join(root, "activity-log.jsonl"), "");
}

async function writeIfMissing(path: string, content: string) {
  try {
    await readFile(path, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
}

export async function readJsonFile<T = unknown>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON file ${path}: ${message}`);
  }
}

export async function readState(rootDir: string): Promise<AppState> {
  await initializeDataDir(rootDir);
  const root = dataDir(rootDir);
  const settings = await readJsonFile<Settings>(join(root, "settings.json"));
  const focusMode = await readJsonFile<FocusModeState>(join(root, "focus-mode.json"));
  const templates = await readAllJsonFiles<Template>(join(root, "templates"));
  const projects = await readAllJsonFiles<Project>(join(root, "projects"));
  const activity = await readActivity(rootDir);

  return {
    settings,
    templates,
    projects,
    activity,
    warnings: [],
    focusMode
  };
}

async function readAllJsonFiles<T>(dir: string): Promise<T[]> {
  const names = await readdir(dir);
  const jsonNames = names.filter((name) => name.endsWith(".json")).sort();
  return Promise.all(jsonNames.map((name) => readJsonFile<T>(join(dir, name))));
}

async function readActivity(rootDir: string): Promise<ActivityEntry[]> {
  const raw = await readFile(join(dataDir(rootDir), "activity-log.jsonl"), "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ActivityEntry);
}

export async function writeProject(rootDir: string, project: Project) {
  const path = join(dataDir(rootDir), "projects", `${project.id}.json`);
  await writeFile(path, `${JSON.stringify(project, null, 2)}\n`, "utf8");
}

export async function writeTemplate(rootDir: string, template: Template) {
  const path = join(dataDir(rootDir), "templates", `${template.id}.json`);
  await writeFile(path, `${JSON.stringify(template, null, 2)}\n`, "utf8");
}

export async function writeSettings(rootDir: string, settings: Settings) {
  await writeFile(join(dataDir(rootDir), "settings.json"), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

export async function writeFocusMode(rootDir: string, focusMode: FocusModeState) {
  await writeFile(join(dataDir(rootDir), "focus-mode.json"), `${JSON.stringify(focusMode, null, 2)}\n`, "utf8");
}

export async function appendActivity(rootDir: string, activity: ActivityEntry) {
  await appendFile(join(dataDir(rootDir), "activity-log.jsonl"), `${JSON.stringify(activity)}\n`, "utf8");
}
```

- [ ] **Step 3: Add seeded data files**

Create `data/settings.json`:

```json
{
  "dataVersion": 1,
  "activeProjectLimit": 3,
  "defaultStagnationDays": 2
}
```

Create `data/focus-mode.json`:

```json
{
  "status": "inactive"
}
```

Create `data/templates/weekly-github-picks.json`:

```json
{
  "id": "weekly-github-picks",
  "name": "每周 GitHub 精选",
  "description": "亲测候选仓库，选出 5 个值得推荐的项目，并完成文章发布。",
  "stages": [
    {
      "id": "collect",
      "name": "候选收集"
    },
    {
      "id": "hands_on",
      "name": "亲测"
    },
    {
      "id": "select",
      "name": "推荐选择"
    },
    {
      "id": "write_reasons",
      "name": "推荐理由写作"
    },
    {
      "id": "draft",
      "name": "成稿"
    },
    {
      "id": "publish",
      "name": "发布"
    }
  ],
  "progressObject": {
    "name": "候选仓库",
    "fields": [
      "repoName",
      "url",
      "source",
      "notes",
      "testLog",
      "decisionReason"
    ],
    "states": [
      {
        "id": "untested",
        "name": "未测",
        "category": "open"
      },
      {
        "id": "testing",
        "name": "测试中",
        "category": "in_progress"
      },
      {
        "id": "selected",
        "name": "入选",
        "category": "concluded"
      },
      {
        "id": "maybe",
        "name": "备选",
        "category": "concluded"
      },
      {
        "id": "rejected",
        "name": "淘汰",
        "category": "concluded"
      }
    ],
    "feedbackStateIds": [
      "selected",
      "maybe",
      "rejected"
    ]
  },
  "slots": [
    {
      "id": "recommendation-1",
      "name": "推荐 1"
    },
    {
      "id": "recommendation-2",
      "name": "推荐 2"
    },
    {
      "id": "recommendation-3",
      "name": "推荐 3"
    },
    {
      "id": "recommendation-4",
      "name": "推荐 4"
    },
    {
      "id": "recommendation-5",
      "name": "推荐 5"
    }
  ],
  "minimumActions": [
    {
      "id": "test-one-repo",
      "label": "亲测 1 个候选仓库"
    },
    {
      "id": "write-one-decision",
      "label": "给 1 个候选仓库写结论理由"
    },
    {
      "id": "fill-one-slot",
      "label": "填入 1 个推荐槽位"
    },
    {
      "id": "draft-one-reason",
      "label": "写完 1 个推荐理由草稿"
    }
  ],
  "recurrence": {
    "supportedRules": [
      "none",
      "daily",
      "weekly",
      "monthly",
      "workdays",
      "custom_interval"
    ],
    "defaultRule": {
      "kind": "weekly"
    }
  },
  "warningRules": {
    "parallelLimit": {
      "useGlobalLimit": true
    },
    "deadlineRisk": {
      "daysBeforeDeadline": 2,
      "requiredFilledSlotRatio": 1,
      "requiredStageId": "write_reasons"
    },
    "stagnation": {
      "daysWithoutActivity": 2
    }
  }
}
```

Create empty files:

```text
data/projects/.gitkeep
data/activity-log.jsonl
```

- [ ] **Step 4: Run storage tests**

Run:

```bash
npm test -- tests/server/storage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/server/storage.ts tests/server/storage.test.ts data
git commit -m "feat: persist app state in local files"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 8: Express API With Focus Enforcement

**Files:**
- Create: `src/server/app.ts`
- Create: `src/server/routes.ts`
- Create: `src/server/index.ts`
- Test: `tests/server/routes.test.ts`

- [ ] **Step 1: Add API test dependency**

Run:

```bash
npm install -D supertest @types/supertest
```

Expected: `package.json` and `package-lock.json` include `supertest` and `@types/supertest`.

- [ ] **Step 2: Write failing API tests**

Create `tests/server/routes.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/server/app";
import { initializeDataDir, writeSettings } from "../../src/server/storage";

let roots: string[] = [];

async function makeServer(): Promise<{ app: Express; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "taskflow-api-"));
  roots.push(root);
  await initializeDataDir(root);
  await writeSettings(root, { dataVersion: 1, activeProjectLimit: 1, defaultStagnationDays: 2 });
  const ids = ["project-1", "project-2", "repo-1", "activity-1", "activity-2", "activity-3"];
  let index = 0;
  const app = createApp({
    rootDir: root,
    now: () => "2026-06-15T10:00:00.000Z",
    id: () => ids[index++] ?? `generated-${index}`
  });

  return { app, root };
}

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots = [];
});

describe("routes", () => {
  it("returns initial app state", async () => {
    const { app } = await makeServer();
    const response = await request(app).get("/api/state");

    expect(response.status).toBe(200);
    expect(response.body.templates[0].id).toBe("weekly-github-picks");
    expect(response.body.warnings).toEqual([]);
  });

  it("creates a project from a template", async () => {
    const { app } = await makeServer();
    const response = await request(app)
      .post("/api/projects")
      .send({
        templateId: "weekly-github-picks",
        title: "每周 GitHub 精选 2026-W25",
        deadline: "2026-06-21T14:00:00.000Z",
        recurrence: { kind: "weekly" }
      });

    expect(response.status).toBe(201);
    expect(response.body.project.title).toBe("每周 GitHub 精选 2026-W25");
  });

  it("saves a custom template", async () => {
    const { app } = await makeServer();
    const response = await request(app)
      .put("/api/templates/article-writing")
      .send({
        id: "article-writing",
        name: "文章写作",
        description: "按段落推进文章",
        stages: [{ id: "draft", name: "草稿" }],
        progressObject: {
          name: "段落",
          fields: ["title"],
          states: [
            { id: "todo", name: "待写", category: "open" },
            { id: "done", name: "完成", category: "concluded" }
          ],
          feedbackStateIds: ["done"]
        },
        slots: [],
        minimumActions: [{ id: "write-one-section", label: "写完 1 个段落" }],
        recurrence: {
          supportedRules: ["none", "weekly"],
          defaultRule: { kind: "none" }
        },
        warningRules: {}
      });

    expect(response.status).toBe(200);
    expect(response.body.templates.some((template: { id: string }) => template.id === "article-writing")).toBe(true);
  });

  it("records a progress object and small feedback", async () => {
    const { app } = await makeServer();
    await request(app)
      .post("/api/projects")
      .send({
        templateId: "weekly-github-picks",
        title: "每周 GitHub 精选 2026-W25",
        recurrence: { kind: "weekly" }
      });

    const objectResponse = await request(app)
      .post("/api/projects/project-1/progress-objects")
      .send({ title: "owner/repo", fields: { url: "https://github.com/owner/repo" } });

    expect(objectResponse.status).toBe(200);
    expect(objectResponse.body.projects[0].progressObjects[0].title).toBe("owner/repo");
    const progressObjectId = objectResponse.body.projects[0].progressObjects[0].id;

    const transitionResponse = await request(app)
      .patch(`/api/projects/project-1/progress-objects/${progressObjectId}/state`)
      .send({ nextStateId: "rejected", note: "安装失败" });

    expect(transitionResponse.status).toBe(200);
    expect(transitionResponse.body.activity[0].message).toContain("安装失败");
  });

  it("persists focus mode and blocks non-selected project mutations", async () => {
    const { app } = await makeServer();
    await request(app).post("/api/projects").send({
      templateId: "weekly-github-picks",
      title: "项目一",
      recurrence: { kind: "weekly" }
    });
    await request(app).post("/api/projects").send({
      templateId: "weekly-github-picks",
      title: "项目二",
      recurrence: { kind: "weekly" }
    });
    await request(app).patch("/api/projects/project-1/status").send({ status: "active" });
    await request(app).patch("/api/projects/project-2/status").send({ status: "active" });

    const focusResponse = await request(app)
      .post("/api/focus/select")
      .send({ projectId: "project-1", selectedActionId: "test-one-repo" });

    expect(focusResponse.status).toBe(200);
    expect(focusResponse.body.focusMode.selectedProjectId).toBe("project-1");

    const blockedResponse = await request(app)
      .post("/api/projects/project-2/progress-objects")
      .send({ title: "blocked/repo", fields: {} });

    expect(blockedResponse.status).toBe(409);
    expect(blockedResponse.body.error).toBe("Focus mode only allows mutations on project-1");

    const completeResponse = await request(app)
      .post("/api/focus/complete-session")
      .send({ result: "blocked" });

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.focusMode.session.result).toBe("blocked");
  });
});
```

- [ ] **Step 3: Implement API app and routes**

Create `src/server/app.ts`:

```ts
import express from "express";
import { registerRoutes } from "./routes";

export interface ServerDeps {
  rootDir: string;
  now: () => string;
  id: () => string;
}

export function createApp(deps: ServerDeps) {
  const app = express();
  app.use(express.json());
  registerRoutes(app, deps);
  return app;
}
```

Create `src/server/routes.ts`:

```ts
import type { Express } from "express";
import type { ServerDeps } from "./app";
import type { ActivityEntry, AppState, Project, ProjectStatus, Template } from "../shared/types";
import { addProgressObject, advanceStage, fillSlot, transitionProgressObject } from "../shared/progress";
import { canMutateProject, completeFocusSession, selectFocusProject } from "../shared/focusMode";
import { createProjectFromTemplate } from "../shared/projectFactory";
import { evaluateWarnings } from "../shared/warnings";
import { appendActivity, readState, writeFocusMode, writeProject, writeTemplate } from "./storage";

export function registerRoutes(app: Express, deps: ServerDeps) {
  app.get("/api/state", async (_request, response, next) => {
    try {
      const state = await stateWithWarnings(deps);
      response.json(state);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects", async (request, response, next) => {
    try {
      const state = await readState(deps.rootDir);
      const template = state.templates.find((item) => item.id === request.body.templateId);

      if (!template) {
        response.status(404).json({ error: "Template not found" });
        return;
      }

      const project = createProjectFromTemplate({
        id: deps.id(),
        template,
        title: request.body.title,
        deadline: request.body.deadline,
        recurrence: request.body.recurrence,
        now: deps.now()
      });

      await writeProject(deps.rootDir, project);
      response.status(201).json({ project, state: await stateWithWarnings(deps) });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/templates/:templateId", async (request, response, next) => {
    try {
      const template = request.body as Template;

      if (template.id !== request.params.templateId) {
        response.status(400).json({ error: "Template id must match route parameter" });
        return;
      }

      await writeTemplate(deps.rootDir, template);
      response.json(await stateWithWarnings(deps));
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/projects/:projectId/status", async (request, response, next) => {
    try {
      const state = await readState(deps.rootDir);
      const project = findProject(state.projects, request.params.projectId);
      assertCanMutate(state, project.id);

      const updatedProject: Project = {
        ...project,
        status: request.body.status as ProjectStatus,
        updatedAt: deps.now()
      };

      await writeProject(deps.rootDir, updatedProject);
      response.json(await stateWithWarnings(deps));
    } catch (error) {
      sendError(error, response, next);
    }
  });

  app.post("/api/projects/:projectId/progress-objects", async (request, response, next) => {
    try {
      const state = await readState(deps.rootDir);
      const project = findProject(state.projects, request.params.projectId);
      assertCanMutate(state, project.id);

      const updatedProject = addProgressObject(project, {
        id: deps.id(),
        title: request.body.title,
        fields: request.body.fields ?? {},
        now: deps.now()
      });

      await writeProject(deps.rootDir, updatedProject);
      response.json(await stateWithWarnings(deps));
    } catch (error) {
      sendError(error, response, next);
    }
  });

  app.patch("/api/projects/:projectId/progress-objects/:progressObjectId/state", async (request, response, next) => {
    try {
      const state = await readState(deps.rootDir);
      const project = findProject(state.projects, request.params.projectId);
      assertCanMutate(state, project.id);

      const result = transitionProgressObject(project, {
        activityId: deps.id(),
        progressObjectId: request.params.progressObjectId,
        nextStateId: request.body.nextStateId,
        note: request.body.note ?? "",
        now: deps.now()
      });

      await writeProject(deps.rootDir, result.project);
      if (result.activity) {
        await appendActivity(deps.rootDir, result.activity);
      }
      response.json(await stateWithWarnings(deps));
    } catch (error) {
      sendError(error, response, next);
    }
  });

  app.post("/api/projects/:projectId/slots/:slotId/fill", async (request, response, next) => {
    try {
      const state = await readState(deps.rootDir);
      const project = findProject(state.projects, request.params.projectId);
      assertCanMutate(state, project.id);

      const result = fillSlot(project, {
        activityId: deps.id(),
        slotId: request.params.slotId,
        progressObjectId: request.body.progressObjectId,
        now: deps.now()
      });

      await persistProjectActivity(deps, result.project, result.activity);
      response.json(await stateWithWarnings(deps));
    } catch (error) {
      sendError(error, response, next);
    }
  });

  app.post("/api/projects/:projectId/stages/:stageId/complete", async (request, response, next) => {
    try {
      const state = await readState(deps.rootDir);
      const project = findProject(state.projects, request.params.projectId);
      assertCanMutate(state, project.id);

      const result = advanceStage(project, {
        activityId: deps.id(),
        completedStageId: request.params.stageId,
        nextStageId: request.body.nextStageId,
        now: deps.now()
      });

      await persistProjectActivity(deps, result.project, result.activity);
      response.json(await stateWithWarnings(deps));
    } catch (error) {
      sendError(error, response, next);
    }
  });

  app.post("/api/focus/select", async (request, response, next) => {
    try {
      const state = await stateWithWarnings(deps);
      const focusMode = selectFocusProject({
        warnings: state.warnings,
        projectId: request.body.projectId,
        selectedActionId: request.body.selectedActionId,
        customActionLabel: request.body.customActionLabel,
        now: deps.now()
      });

      await writeFocusMode(deps.rootDir, focusMode);
      response.json(await stateWithWarnings(deps));
    } catch (error) {
      sendError(error, response, next);
    }
  });

  app.post("/api/focus/complete-session", async (request, response, next) => {
    try {
      const state = await readState(deps.rootDir);
      const focusMode = completeFocusSession(state.focusMode, request.body.result);
      await writeFocusMode(deps.rootDir, focusMode);
      response.json(await stateWithWarnings(deps));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: unknown, response: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    response.status(500).json({ error: message });
  });
}

async function stateWithWarnings(deps: ServerDeps): Promise<AppState> {
  const state = await readState(deps.rootDir);
  return {
    ...state,
    warnings: evaluateWarnings({
      settings: state.settings,
      projects: state.projects,
      activity: state.activity,
      now: deps.now()
    })
  };
}

function findProject(projects: Project[], projectId: string): Project {
  const project = projects.find((item) => item.id === projectId);
  if (!project) {
    throw Object.assign(new Error("Project not found"), { statusCode: 404 });
  }
  return project;
}

function assertCanMutate(state: AppState, projectId: string) {
  if (!canMutateProject(state.focusMode, projectId)) {
    throw Object.assign(
      new Error(`Focus mode only allows mutations on ${state.focusMode.selectedProjectId}`),
      { statusCode: 409 }
    );
  }
}

async function persistProjectActivity(deps: ServerDeps, project: Project, activity: ActivityEntry) {
  await writeProject(deps.rootDir, project);
  await appendActivity(deps.rootDir, activity);
}

function sendError(error: unknown, response: { status: (code: number) => { json: (body: unknown) => void } }, next: (error: unknown) => void) {
  if (error instanceof Error && "statusCode" in error && typeof error.statusCode === "number") {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
}
```

Create `src/server/index.ts`:

```ts
import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import { initializeDataDir } from "./storage";

const rootDir = process.cwd();
const port = Number(process.env.PORT ?? 4317);

await initializeDataDir(rootDir);

const app = createApp({
  rootDir,
  now: () => new Date().toISOString(),
  id: () => randomUUID()
});

app.listen(port, "127.0.0.1", () => {
  console.log(`TaskFlow local API listening on http://127.0.0.1:${port}`);
});
```

- [ ] **Step 4: Run route tests**

Run:

```bash
npm test -- tests/server/routes.test.ts
npm run build
```

Expected: PASS and TypeScript build succeeds.

- [ ] **Step 5: Commit**

Run:

```bash
git add package.json package-lock.json src/server tests/server/routes.test.ts
git commit -m "feat: expose local API for projects"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 9: Client API And Main Dashboard UI

**Files:**
- Create: `src/client/api.ts`
- Modify: `src/client/App.tsx`
- Modify: `src/client/styles.css`
- Create: `src/client/components/CurrentPanel.tsx`
- Create: `src/client/components/ProjectList.tsx`
- Test: `tests/client/App.test.tsx`

- [ ] **Step 1: Replace the App test with state-driven UI coverage**

Update `tests/client/App.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/client/App";
import type { AppState } from "../../src/shared/types";

const state: AppState = {
  settings: { dataVersion: 1, activeProjectLimit: 3, defaultStagnationDays: 2 },
  templates: [],
  projects: [
    {
      id: "project-1",
      title: "每周 GitHub 精选 2026-W25",
      status: "active",
      templateSnapshot: {
        templateName: "每周 GitHub 精选",
        stages: [],
        slots: [],
        minimumActions: [{ id: "test-one-repo", label: "亲测 1 个候选仓库" }],
        warningRules: {}
      },
      recurrence: { kind: "weekly" },
      stages: [],
      progressObjects: [],
      slots: [],
      createdAt: "2026-06-15T10:00:00.000Z",
      updatedAt: "2026-06-15T10:00:00.000Z"
    }
  ],
  activity: [],
  warnings: [],
  focusMode: { status: "inactive" }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("shows current panel and active projects", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => state
    } as Response);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("当前面板")).toBeInTheDocument();
    });
    expect(screen.getByText("进行中 1 / 3")).toBeInTheDocument();
    expect(screen.getByText("每周 GitHub 精选 2026-W25")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add client API wrapper**

Create `src/client/api.ts`:

```ts
import type { AppState } from "../shared/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

export function fetchState() {
  return request<AppState>("/api/state");
}
```

- [ ] **Step 3: Add dashboard components**

Create `src/client/components/CurrentPanel.tsx`:

```tsx
import type { AppState } from "../../shared/types";

interface CurrentPanelProps {
  state: AppState;
}

export function CurrentPanel({ state }: CurrentPanelProps) {
  const activeCount = state.projects.filter((project) => project.status === "active").length;
  const recentActivity = state.activity.slice(-3).reverse();

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>当前面板</h2>
        <span className={activeCount > state.settings.activeProjectLimit ? "status-badge danger" : "status-badge"}>
          进行中 {activeCount} / {state.settings.activeProjectLimit}
        </span>
      </div>
      <div className="metric-grid">
        <div>
          <strong>{state.focusMode.status === "active" ? "收束中" : "正常"}</strong>
          <span>当前状态</span>
        </div>
        <div>
          <strong>{recentActivity.length}</strong>
          <span>最近反馈</span>
        </div>
      </div>
      <ul className="activity-list">
        {recentActivity.map((entry) => (
          <li key={entry.id}>{entry.message}</li>
        ))}
      </ul>
    </section>
  );
}
```

Create `src/client/components/ProjectList.tsx`:

```tsx
import type { Project } from "../../shared/types";

interface ProjectListProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject: (projectId: string) => void;
}

const statusLabel: Record<Project["status"], string> = {
  not_started: "待开始",
  active: "进行中",
  paused: "暂停",
  completed: "已完成"
};

export function ProjectList({ projects, selectedProjectId, onSelectProject }: ProjectListProps) {
  return (
    <section className="panel">
      <h2>项目列表</h2>
      <div className="project-list">
        {projects.map((project) => (
          <button
            key={project.id}
            className={project.id === selectedProjectId ? "project-row selected" : "project-row"}
            onClick={() => onSelectProject(project.id)}
          >
            <span>{project.title}</span>
            <small>{statusLabel[project.status]}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire App to API state**

Replace `src/client/App.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { fetchState } from "./api";
import { CurrentPanel } from "./components/CurrentPanel";
import { ProjectList } from "./components/ProjectList";
import type { AppState } from "../shared/types";
import "./styles.css";

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  useEffect(() => {
    fetchState()
      .then((nextState) => {
        setState(nextState);
        setSelectedProjectId(nextState.projects[0]?.id);
      })
      .catch((nextError: Error) => setError(nextError.message));
  }, []);

  const selectedProject = useMemo(
    () => state?.projects.find((project) => project.id === selectedProjectId),
    [selectedProjectId, state?.projects]
  );

  if (error) {
    return <main className="app-shell"><p className="error">{error}</p></main>;
  }

  if (!state) {
    return <main className="app-shell"><p>加载中...</p></main>;
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">模板优先的本地进度工具</p>
        <h1>任务进度</h1>
      </header>
      <div className="layout">
        <div className="left-column">
          <CurrentPanel state={state} />
          <ProjectList
            projects={state.projects}
            selectedProjectId={selectedProject?.id}
            onSelectProject={setSelectedProjectId}
          />
        </div>
        <section className="panel detail-panel">
          <h2>{selectedProject?.title ?? "选择一个项目"}</h2>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Expand CSS for dashboard**

Append to `src/client/styles.css`:

```css
.layout {
  display: grid;
  grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
  gap: 18px;
  max-width: 1180px;
  margin: 0 auto;
}

.left-column {
  display: grid;
  gap: 18px;
}

.panel {
  border: 1px solid #d9e0ea;
  border-radius: 8px;
  background: #ffffff;
  padding: 18px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel h2 {
  margin: 0 0 14px;
  font-size: 20px;
  letter-spacing: 0;
}

.status-badge {
  border-radius: 999px;
  background: #eef4ff;
  color: #1d4ed8;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 700;
}

.status-badge.danger {
  background: #fff1f0;
  color: #b42318;
}

.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.metric-grid div {
  border: 1px solid #e4e8f0;
  border-radius: 8px;
  padding: 12px;
}

.metric-grid strong,
.metric-grid span {
  display: block;
}

.metric-grid span {
  margin-top: 4px;
  color: #526179;
  font-size: 13px;
}

.activity-list {
  margin: 14px 0 0;
  padding-left: 18px;
}

.project-list {
  display: grid;
  gap: 8px;
}

.project-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e4e8f0;
  border-radius: 8px;
  background: #ffffff;
  color: #172033;
  padding: 12px;
  text-align: left;
  cursor: pointer;
}

.project-row.selected {
  border-color: #2563eb;
  background: #eef4ff;
}

.project-row small {
  color: #526179;
  white-space: nowrap;
}

.detail-panel {
  min-height: 420px;
}

.error {
  color: #b42318;
}

@media (max-width: 860px) {
  .app-shell {
    padding: 18px;
  }

  .layout {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run client tests**

Run:

```bash
npm test -- tests/client/App.test.tsx
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/client tests/client/App.test.tsx
git commit -m "feat: show current dashboard state"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 10: Project Detail UI For Progress, Slots, And Stages

**Files:**
- Create: `src/client/components/ProjectDetail.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/client/styles.css`
- Test: `tests/client/App.test.tsx`

- [ ] **Step 1: Add a UI test for project detail**

Append to `tests/client/App.test.tsx`:

```tsx
it("shows project stage and slot progress", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      ...state,
      projects: [
        {
          ...state.projects[0],
          stages: [
            { id: "collect", name: "候选收集", status: "completed" },
            { id: "hands_on", name: "亲测", status: "active" }
          ],
          slots: [
            { id: "recommendation-1", name: "推荐 1", progressObjectId: "repo-1" },
            { id: "recommendation-2", name: "推荐 2" }
          ],
          progressObjects: [
            {
              id: "repo-1",
              title: "owner/repo",
              stateId: "selected",
              fields: {},
              createdAt: "2026-06-15T10:00:00.000Z",
              updatedAt: "2026-06-15T10:00:00.000Z"
            }
          ]
        }
      ]
    })
  } as Response);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText("阶段进度")).toBeInTheDocument();
  });
  expect(screen.getByText("槽位 1 / 2")).toBeInTheDocument();
  expect(screen.getByText("owner/repo")).toBeInTheDocument();
});
```

- [ ] **Step 2: Add API mutation helpers**

Append to `src/client/api.ts`:

```ts
export function createProgressObject(projectId: string, payload: { title: string; fields: Record<string, string> }) {
  return request<AppState>(`/api/projects/${projectId}/progress-objects`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function transitionProgressObjectApi(
  projectId: string,
  progressObjectId: string,
  payload: { nextStateId: string; note: string }
) {
  return request<AppState>(`/api/projects/${projectId}/progress-objects/${progressObjectId}/state`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fillSlotApi(projectId: string, slotId: string, payload: { progressObjectId: string }) {
  return request<AppState>(`/api/projects/${projectId}/slots/${slotId}/fill`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
```

- [ ] **Step 3: Create ProjectDetail component**

Create `src/client/components/ProjectDetail.tsx`:

```tsx
import type { Project } from "../../shared/types";

interface ProjectDetailProps {
  project?: Project;
}

export function ProjectDetail({ project }: ProjectDetailProps) {
  if (!project) {
    return (
      <section className="panel detail-panel">
        <h2>选择一个项目</h2>
      </section>
    );
  }

  const filledSlots = project.slots.filter((slot) => slot.progressObjectId).length;
  const objectById = new Map(project.progressObjects.map((item) => [item.id, item]));

  return (
    <section className="panel detail-panel">
      <div className="panel-header">
        <h2>{project.title}</h2>
        <span className="status-badge">槽位 {filledSlots} / {project.slots.length || 0}</span>
      </div>

      <section className="detail-section">
        <h3>阶段进度</h3>
        <div className="stage-track">
          {project.stages.map((stage) => (
            <span key={stage.id} className={`stage-pill ${stage.status}`}>
              {stage.name}
            </span>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h3>{project.templateSnapshot.progressObject?.name ?? "推进对象"}</h3>
        <div className="object-list">
          {project.progressObjects.map((item) => (
            <div key={item.id} className="object-row">
              <strong>{item.title}</strong>
              <span>{item.stateId}</span>
            </div>
          ))}
        </div>
      </section>

      {project.slots.length > 0 && (
        <section className="detail-section">
          <h3>成果槽位</h3>
          <div className="slot-grid">
            {project.slots.map((slot) => (
              <div key={slot.id} className="slot-card">
                <strong>{slot.name}</strong>
                <span>{slot.progressObjectId ? objectById.get(slot.progressObjectId)?.title : "未填"}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Wire ProjectDetail into App**

Modify `src/client/App.tsx` by importing and rendering `ProjectDetail`:

```tsx
import { ProjectDetail } from "./components/ProjectDetail";
```

Replace the temporary detail section with:

```tsx
<ProjectDetail project={selectedProject} />
```

- [ ] **Step 5: Add detail CSS**

Append to `src/client/styles.css`:

```css
.detail-section {
  margin-top: 18px;
}

.detail-section h3 {
  margin: 0 0 10px;
  font-size: 16px;
}

.stage-track {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stage-pill {
  border: 1px solid #d9e0ea;
  border-radius: 999px;
  padding: 6px 10px;
  color: #526179;
  background: #f8fafc;
}

.stage-pill.active {
  border-color: #2563eb;
  color: #1d4ed8;
  background: #eef4ff;
}

.stage-pill.completed {
  border-color: #1f9d55;
  color: #16833a;
  background: #effaf3;
}

.object-list {
  display: grid;
  gap: 8px;
}

.object-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e4e8f0;
  border-radius: 8px;
  padding: 10px;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.slot-card {
  border: 1px solid #e4e8f0;
  border-radius: 8px;
  padding: 12px;
  background: #fbfcff;
}

.slot-card strong,
.slot-card span {
  display: block;
}

.slot-card span {
  margin-top: 6px;
  color: #526179;
}
```

- [ ] **Step 6: Run client tests**

Run:

```bash
npm test -- tests/client/App.test.tsx
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/client tests/client/App.test.tsx
git commit -m "feat: show project progress detail"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 11: Template Manager UI

**Files:**
- Create: `src/client/components/TemplateManager.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/client/styles.css`
- Test: `tests/client/App.test.tsx`

- [ ] **Step 1: Add a template UI test**

Append to `tests/client/App.test.tsx`:

```tsx
it("shows templates and their configured progress object", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      ...state,
      templates: [
        {
          id: "weekly-github-picks",
          name: "每周 GitHub 精选",
          description: "亲测候选仓库",
          stages: [],
          progressObject: {
            name: "候选仓库",
            fields: [],
            states: [
              { id: "untested", name: "未测", category: "open" },
              { id: "selected", name: "入选", category: "concluded" }
            ],
            feedbackStateIds: ["selected"]
          },
          slots: [],
          minimumActions: [],
          recurrence: { supportedRules: ["weekly"], defaultRule: { kind: "weekly" } },
          warningRules: {}
        }
      ]
    })
  } as Response);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText("模板管理")).toBeInTheDocument();
  });
  expect(screen.getByText("每周 GitHub 精选")).toBeInTheDocument();
  expect(screen.getByText("推进对象：候选仓库")).toBeInTheDocument();
});
```

- [ ] **Step 2: Add template API helper**

Append to `src/client/api.ts`:

```ts
import type { Template } from "../shared/types";

export function saveTemplate(template: Template) {
  return request<AppState>(`/api/templates/${template.id}`, {
    method: "PUT",
    body: JSON.stringify(template)
  });
}
```

If `Template` import conflicts with existing imports, merge it into the existing type import.

- [ ] **Step 3: Create TemplateManager component**

Create `src/client/components/TemplateManager.tsx`:

```tsx
import type { Template } from "../../shared/types";

interface TemplateManagerProps {
  templates: Template[];
}

export function TemplateManager({ templates }: TemplateManagerProps) {
  return (
    <section className="panel">
      <h2>模板管理</h2>
      <div className="template-list">
        {templates.map((template) => (
          <article key={template.id} className="template-card">
            <div>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
            </div>
            <dl>
              <div>
                <dt>阶段</dt>
                <dd>{template.stages.length}</dd>
              </div>
              <div>
                <dt>槽位</dt>
                <dd>{template.slots.length}</dd>
              </div>
              <div>
                <dt>推进对象</dt>
                <dd>{template.progressObject?.name ?? "无"}</dd>
              </div>
            </dl>
            <p className="template-meta">推进对象：{template.progressObject?.name ?? "无"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Render TemplateManager**

Modify `src/client/App.tsx`:

```tsx
import { TemplateManager } from "./components/TemplateManager";
```

Render it under `ProjectList`:

```tsx
<TemplateManager templates={state.templates} />
```

- [ ] **Step 5: Add template CSS**

Append to `src/client/styles.css`:

```css
.template-list {
  display: grid;
  gap: 10px;
}

.template-card {
  border: 1px solid #e4e8f0;
  border-radius: 8px;
  padding: 12px;
}

.template-card h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.template-card p {
  margin: 0;
  color: #526179;
}

.template-card dl {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 12px 0;
}

.template-card dt {
  color: #526179;
  font-size: 12px;
}

.template-card dd {
  margin: 2px 0 0;
  font-weight: 700;
}

.template-meta {
  font-size: 13px;
}
```

- [ ] **Step 6: Run template UI tests**

Run:

```bash
npm test -- tests/client/App.test.tsx
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/client tests/client/App.test.tsx
git commit -m "feat: display reusable templates"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 12: Focus Mode UI And 5-Minute Block

**Files:**
- Create: `src/client/components/FocusModePanel.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/client/styles.css`
- Test: `tests/client/App.test.tsx`

- [ ] **Step 1: Add a focus mode UI test**

Append to `tests/client/App.test.tsx`:

```tsx
it("shows focus mode when active", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      ...state,
      focusMode: {
        status: "active",
        selectedProjectId: "project-1",
        selectedActionId: "test-one-repo",
        session: {
          startedAt: "2026-06-15T10:00:00.000Z",
          durationMinutes: 5
        }
      }
    })
  } as Response);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText("收束模式")).toBeInTheDocument();
  });
  expect(screen.getByText("当前只推进：每周 GitHub 精选 2026-W25")).toBeInTheDocument();
  expect(screen.getByText("5 分钟启动块")).toBeInTheDocument();
});
```

- [ ] **Step 2: Add focus API helpers**

Append to `src/client/api.ts`:

```ts
import type { FocusSessionResult } from "../shared/types";

export function selectFocusProjectApi(payload: { projectId: string; selectedActionId?: string; customActionLabel?: string }) {
  return request<AppState>("/api/focus/select", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function completeFocusSessionApi(payload: { result: FocusSessionResult }) {
  return request<AppState>("/api/focus/complete-session", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
```

If `FocusSessionResult` import conflicts with existing imports, merge it into the existing type import.

- [ ] **Step 3: Create FocusModePanel**

Create `src/client/components/FocusModePanel.tsx`:

```tsx
import type { AppState } from "../../shared/types";

interface FocusModePanelProps {
  state: AppState;
}

export function FocusModePanel({ state }: FocusModePanelProps) {
  if (state.focusMode.status !== "active") {
    return null;
  }

  const selectedProject = state.projects.find((project) => project.id === state.focusMode.selectedProjectId);
  const selectedAction = selectedProject?.templateSnapshot.minimumActions.find(
    (action) => action.id === state.focusMode.selectedActionId
  );
  const actionLabel = state.focusMode.customActionLabel ?? selectedAction?.label ?? "记录一个明确推进动作";

  return (
    <section className="focus-panel">
      <div>
        <p className="eyebrow">收束模式</p>
        <h2>当前只推进：{selectedProject?.title ?? "未选择项目"}</h2>
      </div>
      <div className="focus-action">
        <strong>5 分钟启动块</strong>
        <span>{actionLabel}</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Render FocusModePanel**

Modify `src/client/App.tsx`:

```tsx
import { FocusModePanel } from "./components/FocusModePanel";
```

Render it after the hero header:

```tsx
<FocusModePanel state={state} />
```

- [ ] **Step 5: Add focus CSS**

Append to `src/client/styles.css`:

```css
.focus-panel {
  max-width: 1180px;
  margin: 0 auto 18px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  border: 2px solid #b42318;
  border-radius: 8px;
  background: #fff7f6;
  padding: 18px;
}

.focus-panel h2 {
  margin: 0;
  font-size: 22px;
}

.focus-action {
  min-width: 220px;
  border: 1px solid #f2b8b5;
  border-radius: 8px;
  background: #ffffff;
  padding: 12px;
}

.focus-action strong,
.focus-action span {
  display: block;
}

.focus-action span {
  margin-top: 6px;
  color: #526179;
}

@media (max-width: 860px) {
  .focus-panel {
    flex-direction: column;
  }
}
```

- [ ] **Step 6: Run focus UI tests**

Run:

```bash
npm test -- tests/client/App.test.tsx
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/client tests/client/App.test.tsx
git commit -m "feat: surface active focus mode"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

### Task 13: End-To-End Local Verification

**Files:**
- Modify: `README.md`
- Verify: `data/settings.json`
- Verify: `data/templates/weekly-github-picks.json`
- Verify: `data/projects/*.json`
- Verify: `data/activity-log.jsonl`

- [ ] **Step 1: Add usage documentation**

Create `README.md`:

```md
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
```

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS for shared, server, and client tests.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript check and Vite build pass.

- [ ] **Step 4: Start the local API**

Run:

```bash
npm run dev:server
```

Expected output includes:

```text
TaskFlow local API listening on http://127.0.0.1:4317
```

Keep this server running for Step 5.

- [ ] **Step 5: Start the frontend dev server**

In a second terminal, run:

```bash
npm run dev
```

Expected output includes a local Vite URL such as:

```text
Local:   http://127.0.0.1:5173/
```

Open the URL and verify:

- The current panel appears.
- The project list appears.
- The template manager shows「每周 GitHub 精选」.
- Creating a project through the API writes a JSON file under `data/projects/`.

- [ ] **Step 6: Verify local file writes with API**

Run:

```bash
curl -s -X POST http://127.0.0.1:4317/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"templateId":"weekly-github-picks","title":"每周 GitHub 精选 2026-W25","deadline":"2026-06-21T14:00:00.000Z","recurrence":{"kind":"weekly"}}'
```

Expected: JSON response includes `"title":"每周 GitHub 精选 2026-W25"` and a file appears under `data/projects/`.

- [ ] **Step 7: Commit**

Run:

```bash
git add README.md data src tests package.json package-lock.json
git commit -m "docs: add local verification instructions"
```

If git is unavailable in this workspace, run `git diff --stat` and record the changed paths in the implementation notes.

---

## Self-Review

Spec coverage:

- Template creation and template-based projects are covered by Tasks 2, 3, 7, 8, and 11.
- The built-in「每周 GitHub 精选」template is covered by Task 2 and seeded storage in Task 7.
- Small feedback and big feedback are covered by Task 4.
- Parallel, deadline, and stagnation warnings are covered by Task 5.
- Strong focus mode and 5-minute start block are covered by Tasks 6 and 12.
- Local JSON/JSONL file storage is covered by Task 7.
- Browser UI for current panel, project list, project detail, template management, and focus mode is covered by Tasks 9-12.
- End-to-end local verification is covered by Task 13.

Implementation notes:

- Task 8 implements the full API surface needed by the MVP, including template save, progress mutations, persisted focus mode, and focus-mode mutation blocking.
- Client tasks intentionally keep forms lightweight while still rendering every required surface: current panel, project list, project detail, template management, and focus mode.
