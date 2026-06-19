# TaskFlow Habit System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight standalone habit system with a dedicated page, a default “today” view, a full habit management view, per-weekday scheduling, bounded/ongoing periods, backfillable completion, and archive support.

**Architecture:** Extend the shared app state with a new `habits` collection and a separate habit-record model stored in local JSON files under `data/`. Reuse the existing single `/api/state` hydration model and add a small set of habit mutation routes. On the client, add a new `习惯` navigation entry and a dedicated page component with two internal views: `今天` and `全部习惯`.

**Tech Stack:** TypeScript, React, Express, local JSON-file storage, Vitest, Testing Library

---

## File Structure

Planned files and responsibilities:

- Modify: `src/shared/types.ts`
  - Add habit domain types to shared app state.
- Create: `src/shared/habits.ts`
  - Habit domain helpers: schedule checks, due-date generation, today/missed grouping, archive rules.
- Modify: `src/server/storage.ts`
  - Persist habits and habit records in local JSON files and include them in `readState`.
- Modify: `src/server/routes.ts`
  - Add habit CRUD and completion routes.
- Modify: `src/client/api.ts`
  - Add client API wrappers for habit mutations.
- Modify: `src/client/App.tsx`
  - Add `habits` page view and wire habit mutations into the shared state refresh path.
- Create: `src/client/components/HabitsPage.tsx`
  - Dedicated habit page with `今天` and `全部习惯` views.
- Modify: `src/client/styles.css`
  - Add styling for habit page, sections, archive controls, and completion rows.
- Test: `tests/shared/habits.test.ts`
  - Shared domain tests for schedule, period, today list, missed list, archive behavior.
- Modify: `tests/server/routes.test.ts`
  - API tests for habit creation, completion, archive, and `/api/state`.
- Modify: `tests/client/App.test.tsx`
  - Client interaction tests for nav entry, `今天` view, missed items, and habit management.

## Task 1: Add shared habit domain types

**Files:**
- Modify: `src/shared/types.ts`
- Test: `tests/shared/habits.test.ts`

- [ ] **Step 1: Write the failing shared-domain test skeleton**

Add a new test file:

```ts
import { describe, expect, it } from "vitest";
import type { Habit } from "../../src/shared/types";

describe("habits domain", () => {
  it("defines a weekly scheduled bounded habit shape", () => {
    const habit: Habit = {
      id: "habit-1",
      title: "看 AI HOT 日报",
      schedule: { weekdays: [1, 2, 3, 4, 5] },
      period: {
        kind: "bounded",
        startDate: "2026-06-19",
        endDate: "2026-07-19"
      },
      createdAt: "2026-06-19T10:00:00.000Z",
      updatedAt: "2026-06-19T10:00:00.000Z"
    };

    expect(habit.period.kind).toBe("bounded");
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npm test -- tests/shared/habits.test.ts
```

Expected:
- FAIL because `Habit` is not defined in `src/shared/types.ts`

- [ ] **Step 3: Add minimal shared types**

Update `src/shared/types.ts` to add:

```ts
export interface HabitSchedule {
  weekdays: number[];
}

export type HabitPeriod =
  | {
      kind: "ongoing";
      startDate: string;
    }
  | {
      kind: "bounded";
      startDate: string;
      endDate: string;
    };

export interface Habit {
  id: string;
  title: string;
  schedule: HabitSchedule;
  period: HabitPeriod;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HabitRecord {
  habitId: string;
  date: string;
  status: "completed";
  updatedAt: string;
}
```

Also extend `AppState`:

```ts
export interface AppState {
  settings: Settings;
  templates: Template[];
  projects: Project[];
  habits: Habit[];
  habitRecords: HabitRecord[];
  activity: ActivityEntry[];
  warnings: Warning[];
  focusMode: FocusModeState;
}
```

- [ ] **Step 4: Run the shared-domain test to verify it passes**

Run:

```bash
npm test -- tests/shared/habits.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts tests/shared/habits.test.ts
git commit -m "Add habit domain types"
```

## Task 2: Add habit scheduling and derived-list helpers

**Files:**
- Create: `src/shared/habits.ts`
- Modify: `tests/shared/habits.test.ts`

- [ ] **Step 1: Write failing tests for schedule and derived behavior**

Extend `tests/shared/habits.test.ts` with:

```ts
import {
  isHabitScheduledForDate,
  isHabitDateWithinPeriod,
  buildTodayHabitsView
} from "../../src/shared/habits";

it("matches weekly schedule and bounded period", () => {
  const habit: Habit = {
    id: "habit-1",
    title: "看 AI HOT 日报",
    schedule: { weekdays: [1, 3, 5] },
    period: { kind: "bounded", startDate: "2026-06-01", endDate: "2026-06-30" },
    createdAt: "2026-06-19T10:00:00.000Z",
    updatedAt: "2026-06-19T10:00:00.000Z"
  };

  expect(isHabitDateWithinPeriod(habit, "2026-06-19")).toBe(true);
  expect(isHabitScheduledForDate(habit, "2026-06-19")).toBe(true);
  expect(isHabitScheduledForDate(habit, "2026-06-20")).toBe(false);
});

it("builds today and missed groups from habits and records", () => {
  const habits: Habit[] = [
    {
      id: "habit-1",
      title: "看 AI HOT 日报",
      schedule: { weekdays: [4, 5] },
      period: { kind: "bounded", startDate: "2026-06-18", endDate: "2026-06-30" },
      createdAt: "2026-06-18T10:00:00.000Z",
      updatedAt: "2026-06-18T10:00:00.000Z"
    }
  ];

  const records = [
    {
      habitId: "habit-1",
      date: "2026-06-18",
      status: "completed" as const,
      updatedAt: "2026-06-18T22:00:00.000Z"
    }
  ];

  const view = buildTodayHabitsView({
    habits,
    records,
    today: "2026-06-19"
  });

  expect(view.todayDue.map((item) => item.habit.title)).toEqual(["看 AI HOT 日报"]);
  expect(view.missed).toEqual([]);
});
```

- [ ] **Step 2: Run the shared-domain test to verify it fails**

Run:

```bash
npm test -- tests/shared/habits.test.ts
```

Expected:
- FAIL because `src/shared/habits.ts` does not exist yet

- [ ] **Step 3: Implement minimal habit helper module**

Create `src/shared/habits.ts` with:

```ts
import type { Habit, HabitRecord } from "./types";

export interface HabitDayItem {
  habit: Habit;
  date: string;
  completed: boolean;
}

export interface TodayHabitsView {
  todayDue: HabitDayItem[];
  missed: HabitDayItem[];
}

export function isHabitDateWithinPeriod(habit: Habit, date: string) {
  if (date < habit.period.startDate) {
    return false;
  }

  if (habit.period.kind === "bounded" && date > habit.period.endDate) {
    return false;
  }

  return true;
}

export function isHabitScheduledForDate(habit: Habit, date: string) {
  if (habit.archivedAt || !isHabitDateWithinPeriod(habit, date)) {
    return false;
  }

  const weekday = new Date(`${date}T12:00:00`).getDay();
  return habit.schedule.weekdays.includes(weekday);
}

export function buildTodayHabitsView(input: {
  habits: Habit[];
  records: HabitRecord[];
  today: string;
}): TodayHabitsView {
  const completed = new Set(
    input.records.filter((record) => record.status === "completed").map((record) => `${record.habitId}:${record.date}`)
  );
  const todayDue: HabitDayItem[] = [];
  const missed: HabitDayItem[] = [];

  for (const habit of input.habits) {
    if (habit.archivedAt) {
      continue;
    }

    if (isHabitScheduledForDate(habit, input.today)) {
      todayDue.push({
        habit,
        date: input.today,
        completed: completed.has(`${habit.id}:${input.today}`)
      });
    }

    let cursor = habit.period.startDate;
    while (cursor < input.today && isHabitDateWithinPeriod(habit, cursor)) {
      if (isHabitScheduledForDate(habit, cursor) && !completed.has(`${habit.id}:${cursor}`)) {
        missed.push({
          habit,
          date: cursor,
          completed: false
        });
      }
      cursor = addOneDay(cursor);
    }
  }

  missed.sort((left, right) => right.date.localeCompare(left.date));

  return { todayDue, missed };
}

function addOneDay(date: string) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run the shared-domain test to verify it passes**

Run:

```bash
npm test -- tests/shared/habits.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/habits.ts tests/shared/habits.test.ts
git commit -m "Add habit schedule helpers"
```

## Task 3: Persist habits and habit records in local storage

**Files:**
- Modify: `src/server/storage.ts`
- Modify: `tests/server/routes.test.ts`

- [ ] **Step 1: Write failing storage-backed route test**

Add to `tests/server/routes.test.ts`:

```ts
it("returns habits and habitRecords from api state", async () => {
  const { app, rootDir } = await makeFixture();
  const rootDataDir = dataDir(rootDir);

  await writeFile(
    path.join(rootDataDir, "habits.json"),
    JSON.stringify(
      [
        {
          id: "habit-1",
          title: "看 AI HOT 日报",
          schedule: { weekdays: [1, 2, 3, 4, 5] },
          period: { kind: "bounded", startDate: "2026-06-19", endDate: "2026-07-19" },
          createdAt: "2026-06-19T10:00:00.000Z",
          updatedAt: "2026-06-19T10:00:00.000Z"
        }
      ],
      null,
      2
    ),
    "utf8"
  );

  await writeFile(
    path.join(rootDataDir, "habit-records.json"),
    JSON.stringify(
      [
        {
          habitId: "habit-1",
          date: "2026-06-19",
          status: "completed",
          updatedAt: "2026-06-19T21:00:00.000Z"
        }
      ],
      null,
      2
    ),
    "utf8"
  );

  const response = await request(app).get("/api/state").expect(200);

  expect(response.body.habits).toHaveLength(1);
  expect(response.body.habitRecords).toHaveLength(1);
});
```

- [ ] **Step 2: Run the route test to verify it fails**

Run:

```bash
npm test -- tests/server/routes.test.ts
```

Expected:
- FAIL because `readState` does not return `habits` and `habitRecords`

- [ ] **Step 3: Extend storage initialization and state loading**

Update `src/server/storage.ts`:

```ts
await writeIfMissing(path.join(rootDataDir, "habits.json"), []);
await writeIfMissing(path.join(rootDataDir, "habit-records.json"), []);
```

Include in `readState`:

```ts
const [settings, focusMode, templates, projects, habits, habitRecords, activity] = await Promise.all([
  readJsonFile<Settings>(path.join(rootDataDir, "settings.json")),
  readJsonFile<FocusModeState>(path.join(rootDataDir, "focus-mode.json")),
  readAllJsonFiles<Template>(path.join(rootDataDir, "templates")),
  readAllJsonFiles<Project>(path.join(rootDataDir, "projects")),
  readJsonFile<Habit[]>(path.join(rootDataDir, "habits.json")),
  readJsonFile<HabitRecord[]>(path.join(rootDataDir, "habit-records.json")),
  readActivity(path.join(rootDataDir, "activity-log.jsonl"))
]);
```

Return them in state:

```ts
return {
  settings,
  templates: templates.map(normalizeTemplate),
  projects: projects.map(normalizeProject),
  habits,
  habitRecords,
  activity,
  warnings: [],
  focusMode
};
```

Add writers:

```ts
export async function writeHabits(rootDir: string, habits: Habit[]) {
  await initializeDataDir(rootDir);
  await writeJsonFile(path.join(dataDir(rootDir), "habits.json"), habits);
}

export async function writeHabitRecords(rootDir: string, records: HabitRecord[]) {
  await initializeDataDir(rootDir);
  await writeJsonFile(path.join(dataDir(rootDir), "habit-records.json"), records);
}
```

- [ ] **Step 4: Run the route test to verify it passes**

Run:

```bash
npm test -- tests/server/routes.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/storage.ts tests/server/routes.test.ts
git commit -m "Persist habits in local storage"
```

## Task 4: Add habit mutation routes

**Files:**
- Modify: `src/server/routes.ts`
- Modify: `tests/server/routes.test.ts`
- Modify: `src/shared/habits.ts`

- [ ] **Step 1: Write failing route tests for create, complete, and archive**

Add to `tests/server/routes.test.ts`:

```ts
it("creates a habit", async () => {
  const { app } = await makeFixture(["habit-1"]);

  const response = await request(app)
    .post("/api/habits")
    .send({
      title: "看 AI HOT 日报",
      schedule: { weekdays: [1, 2, 3, 4, 5] },
      period: { kind: "bounded", startDate: "2026-06-19", endDate: "2026-07-19" }
    })
    .expect(200);

  expect(response.body.habits[0].title).toBe("看 AI HOT 日报");
});

it("marks a habit date as completed", async () => {
  const { app } = await makeFixture(["habit-1"]);
  await request(app)
    .post("/api/habits")
    .send({
      title: "看 AI HOT 日报",
      schedule: { weekdays: [1, 2, 3, 4, 5] },
      period: { kind: "bounded", startDate: "2026-06-19", endDate: "2026-07-19" }
    });

  const response = await request(app)
    .put("/api/habits/habit-1/records/2026-06-19")
    .send({ status: "completed" })
    .expect(200);

  expect(response.body.habitRecords).toContainEqual(
    expect.objectContaining({ habitId: "habit-1", date: "2026-06-19", status: "completed" })
  );
});

it("archives a habit", async () => {
  const { app } = await makeFixture(["habit-1"]);
  await request(app)
    .post("/api/habits")
    .send({
      title: "爬坡",
      schedule: { weekdays: [0, 6] },
      period: { kind: "ongoing", startDate: "2026-06-19" }
    });

  const response = await request(app)
    .post("/api/habits/habit-1/archive")
    .expect(200);

  expect(response.body.habits[0].archivedAt).toBeTruthy();
});
```

- [ ] **Step 2: Run the route test to verify it fails**

Run:

```bash
npm test -- tests/server/routes.test.ts
```

Expected:
- FAIL because the habit routes do not exist

- [ ] **Step 3: Add minimal route handlers**

Update `src/server/routes.ts` with these routes:

```ts
app.post("/api/habits", asyncRoute(async (req, res) => {
  const state = await readStateWithWarnings(deps);
  const title = parseRequiredString(req.body.title, "Habit title is required");
  const now = deps.now();
  const nextHabit = {
    id: deps.id(),
    title,
    schedule: req.body.schedule,
    period: req.body.period,
    createdAt: now,
    updatedAt: now
  };

  await writeHabits(deps.rootDir, [...state.habits, nextHabit]);
  res.json(await readStateWithWarnings(deps));
}));

app.put("/api/habits/:habitId/records/:date", asyncRoute(async (req, res) => {
  const state = await readStateWithWarnings(deps);
  const now = deps.now();
  const remaining = state.habitRecords.filter(
    (record) => !(record.habitId === req.params.habitId && record.date === req.params.date)
  );

  await writeHabitRecords(deps.rootDir, [
    ...remaining,
    {
      habitId: req.params.habitId,
      date: req.params.date,
      status: "completed",
      updatedAt: now
    }
  ]);

  res.json(await readStateWithWarnings(deps));
}));

app.post("/api/habits/:habitId/archive", asyncRoute(async (req, res) => {
  const state = await readStateWithWarnings(deps);
  const now = deps.now();
  const nextHabits = state.habits.map((habit) =>
    habit.id === req.params.habitId ? { ...habit, archivedAt: now, updatedAt: now } : habit
  );

  await writeHabits(deps.rootDir, nextHabits);
  res.json(await readStateWithWarnings(deps));
}));
```

- [ ] **Step 4: Run the route test to verify it passes**

Run:

```bash
npm test -- tests/server/routes.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/routes.ts tests/server/routes.test.ts
git commit -m "Add habit mutation routes"
```

## Task 5: Add client API wrappers and app navigation

**Files:**
- Modify: `src/client/api.ts`
- Modify: `src/client/App.tsx`
- Modify: `tests/client/App.test.tsx`

- [ ] **Step 1: Write failing client navigation test**

Add to `tests/client/App.test.tsx`:

```ts
it("shows a habits page from the main navigation", async () => {
  render(<App />);

  await screen.findByRole("heading", { name: "任务进度" });
  expect(screen.getByRole("button", { name: "习惯" })).toBeInTheDocument();
});
```

Also add an initial-state override that includes:

```ts
habits: [],
habitRecords: [],
```

- [ ] **Step 2: Run the client test to verify it fails**

Run:

```bash
npm test -- tests/client/App.test.tsx
```

Expected:
- FAIL because the navigation does not include `习惯`

- [ ] **Step 3: Add client API functions and new app view**

Update `src/client/api.ts` with:

```ts
export function createHabitApi(payload: {
  title: string;
  schedule: { weekdays: number[] };
  period: { kind: "ongoing"; startDate: string } | { kind: "bounded"; startDate: string; endDate: string };
}): Promise<AppState> {
  return request<AppState>("/api/habits", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function completeHabitApi(habitId: string, date: string): Promise<AppState> {
  return request<AppState>(`/api/habits/${habitId}/records/${date}`, {
    method: "PUT",
    body: JSON.stringify({ status: "completed" })
  });
}

export function archiveHabitApi(habitId: string): Promise<AppState> {
  return request<AppState>(`/api/habits/${habitId}/archive`, {
    method: "POST",
    body: JSON.stringify({})
  });
}
```

Update `src/client/App.tsx`:

```ts
type AppView = "workbench" | "new" | "templates" | "feedback" | "habits";
```

And add nav item:

```ts
{ id: "habits", label: "习惯" }
```

- [ ] **Step 4: Run the client test to verify it passes**

Run:

```bash
npm test -- tests/client/App.test.tsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/api.ts src/client/App.tsx tests/client/App.test.tsx
git commit -m "Add habit page navigation"
```

## Task 6: Add the habits page with today and all-habits views

**Files:**
- Create: `src/client/components/HabitsPage.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/styles.css`
- Modify: `tests/client/App.test.tsx`

- [ ] **Step 1: Write failing client tests for the new habits page**

Add to `tests/client/App.test.tsx`:

```ts
it("shows today due habits and missed habit items", async () => {
  const stateWithHabits = {
    ...appState,
    habits: [
      {
        id: "habit-1",
        title: "看 AI HOT 日报",
        schedule: { weekdays: [4] },
        period: { kind: "bounded", startDate: "2026-06-18", endDate: "2026-06-30" },
        createdAt: "2026-06-18T10:00:00.000Z",
        updatedAt: "2026-06-18T10:00:00.000Z"
      }
    ],
    habitRecords: []
  };

  globalThis.fetch = vi.fn(async () => jsonResponse(stateWithHabits));

  const user = userEvent.setup();
  render(<App />);

  await user.click(await screen.findByRole("button", { name: "习惯" }));

  expect(screen.getByRole("heading", { name: "习惯" })).toBeInTheDocument();
  expect(screen.getByText("今天该做")).toBeInTheDocument();
  expect(screen.getByText("历史漏项")).toBeInTheDocument();
});

it("switches from today to all habits view", async () => {
  const stateWithHabits = {
    ...appState,
    habits: [
      {
        id: "habit-1",
        title: "爬坡",
        schedule: { weekdays: [0, 6] },
        period: { kind: "ongoing", startDate: "2026-06-01" },
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z"
      }
    ],
    habitRecords: []
  };

  globalThis.fetch = vi.fn(async () => jsonResponse(stateWithHabits));

  const user = userEvent.setup();
  render(<App />);

  await user.click(await screen.findByRole("button", { name: "习惯" }));
  await user.click(screen.getByRole("button", { name: "全部习惯" }));

  expect(screen.getByText("爬坡")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "归档：爬坡" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the client test to verify it fails**

Run:

```bash
npm test -- tests/client/App.test.tsx
```

Expected:
- FAIL because `HabitsPage` does not exist

- [ ] **Step 3: Create the habits page component and wire it into `App.tsx`**

Create `src/client/components/HabitsPage.tsx` with:

```tsx
import { useMemo, useState } from "react";
import { buildTodayHabitsView } from "../../shared/habits";
import type { AppState } from "../../shared/types";

type HabitPageTab = "today" | "all";

interface HabitsPageProps {
  state: AppState;
  onCompleteHabit?: (habitId: string, date: string) => Promise<void>;
  onArchiveHabit?: (habitId: string) => Promise<void>;
}

export function HabitsPage({ state, onCompleteHabit, onArchiveHabit }: HabitsPageProps) {
  const [tab, setTab] = useState<HabitPageTab>("today");
  const today = new Date().toISOString().slice(0, 10);
  const view = useMemo(
    () => buildTodayHabitsView({ habits: state.habits, records: state.habitRecords, today }),
    [state.habitRecords, state.habits, today]
  );
  const activeHabits = state.habits.filter((habit) => !habit.archivedAt);
  const archivedHabits = state.habits.filter((habit) => habit.archivedAt);

  return (
    <section className="panel page-panel habits-page" aria-labelledby="habits-page-title">
      <div className="page-header">
        <p className="eyebrow">重复行为维持</p>
        <h2 id="habits-page-title">习惯</h2>
      </div>

      <div className="segmented-controls">
        <button type="button" className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>
          今天
        </button>
        <button type="button" className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
          全部习惯
        </button>
      </div>

      {tab === "today" ? (
        <div className="habit-sections">
          <section>
            <h3>今天该做</h3>
            {view.todayDue.length > 0 ? (
              <ul className="habit-list">
                {view.todayDue.map((item) => (
                  <li key={`${item.habit.id}:${item.date}`} className="habit-row">
                    <span>{item.habit.title}</span>
                    <button
                      type="button"
                      disabled={item.completed}
                      onClick={() => void onCompleteHabit?.(item.habit.id, item.date)}
                    >
                      {item.completed ? "已完成" : "标记已完成"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">今天没有待执行习惯</p>
            )}
          </section>

          <section>
            <h3>历史漏项</h3>
            {view.missed.length > 0 ? (
              <ul className="habit-list">
                {view.missed.map((item) => (
                  <li key={`${item.habit.id}:${item.date}`} className="habit-row">
                    <span>{item.habit.title} · {item.date}</span>
                    <button type="button" onClick={() => void onCompleteHabit?.(item.habit.id, item.date)}>
                      补记为已完成
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">暂无历史漏项</p>
            )}
          </section>
        </div>
      ) : (
        <div className="habit-sections">
          <section>
            <h3>全部习惯</h3>
            {activeHabits.length > 0 ? (
              <ul className="habit-list">
                {activeHabits.map((habit) => (
                  <li key={habit.id} className="habit-row">
                    <span>{habit.title}</span>
                    <button type="button" aria-label={`归档：${habit.title}`} onClick={() => void onArchiveHabit?.(habit.id)}>
                      归档
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">暂无习惯</p>
            )}
          </section>

          <section>
            <h3>已归档</h3>
            {archivedHabits.length > 0 ? (
              <ul className="habit-list">
                {archivedHabits.map((habit) => (
                  <li key={habit.id} className="habit-row archived">
                    <span>{habit.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">暂无归档习惯</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
```

Wire it in `src/client/App.tsx`:

```tsx
import { HabitsPage } from "./components/HabitsPage";
```

And render branch:

```tsx
{state && view === "habits" ? (
  <HabitsPage
    state={state}
    onCompleteHabit={handleCompleteHabit}
    onArchiveHabit={handleArchiveHabit}
  />
) : null}
```

Add basic styles in `src/client/styles.css`:

```css
.segmented-controls {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.segmented-controls button.active {
  border-color: #4f6f75;
  background: #eef5f4;
}

.habit-sections {
  display: grid;
  gap: 20px;
  margin-top: 20px;
}

.habit-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.habit-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  border: 1px solid #e4dfd5;
  border-radius: 8px;
  padding: 12px;
  background: #fffefa;
}
```

- [ ] **Step 4: Run the client test to verify it passes**

Run:

```bash
npm test -- tests/client/App.test.tsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/components/HabitsPage.tsx src/client/App.tsx src/client/styles.css tests/client/App.test.tsx
git commit -m "Add habits page UI"
```

## Task 7: Wire habit completion and archive through app mutations

**Files:**
- Modify: `src/client/App.tsx`
- Modify: `tests/client/App.test.tsx`

- [ ] **Step 1: Write failing client interaction test**

Add to `tests/client/App.test.tsx`:

```ts
it("completes a habit from today view and archives it from all habits", async () => {
  const user = userEvent.setup();
  const initialState = {
    ...appState,
    habits: [
      {
        id: "habit-1",
        title: "看 AI HOT 日报",
        schedule: { weekdays: [4] },
        period: { kind: "bounded", startDate: "2026-06-18", endDate: "2026-06-30" },
        createdAt: "2026-06-18T10:00:00.000Z",
        updatedAt: "2026-06-18T10:00:00.000Z"
      }
    ],
    habitRecords: []
  };
  const completedState = {
    ...initialState,
    habitRecords: [
      {
        habitId: "habit-1",
        date: new Date().toISOString().slice(0, 10),
        status: "completed" as const,
        updatedAt: "2026-06-19T21:00:00.000Z"
      }
    ]
  };
  const archivedState = {
    ...completedState,
    habits: [
      {
        ...initialState.habits[0],
        archivedAt: "2026-06-19T22:00:00.000Z",
        updatedAt: "2026-06-19T22:00:00.000Z"
      }
    ]
  };

  globalThis.fetch = vi.fn(async (input) => {
    const path = String(input);
    if (path === "/api/state") {
      return jsonResponse(initialState);
    }
    if (path.includes("/api/habits/habit-1/records/")) {
      return jsonResponse(completedState);
    }
    if (path === "/api/habits/habit-1/archive") {
      return jsonResponse(archivedState);
    }
    return jsonResponse(initialState);
  });

  render(<App />);

  await user.click(await screen.findByRole("button", { name: "习惯" }));
  await user.click(screen.getByRole("button", { name: "标记已完成" }));
  await user.click(screen.getByRole("button", { name: "全部习惯" }));
  await user.click(screen.getByRole("button", { name: "归档：看 AI HOT 日报" }));

  expect(await screen.findByText("暂无习惯")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the client test to verify it fails**

Run:

```bash
npm test -- tests/client/App.test.tsx
```

Expected:
- FAIL because `handleCompleteHabit` and `handleArchiveHabit` are not wired

- [ ] **Step 3: Add app mutation handlers**

Update `src/client/App.tsx`:

```ts
function handleCreateHabit(input: {
  title: string;
  schedule: { weekdays: number[] };
  period: { kind: "ongoing"; startDate: string } | { kind: "bounded"; startDate: string; endDate: string };
}) {
  return runMutation(() => createHabitApi(input), {
    nextView: "habits"
  });
}

function handleCompleteHabit(habitId: string, date: string) {
  return runMutation(() => completeHabitApi(habitId, date), {
    nextView: "habits"
  });
}

function handleArchiveHabit(habitId: string) {
  return runMutation(() => archiveHabitApi(habitId), {
    nextView: "habits"
  });
}
```

Pass to `HabitsPage`:

```tsx
<HabitsPage
  state={state}
  onCreateHabit={handleCreateHabit}
  onCompleteHabit={handleCompleteHabit}
  onArchiveHabit={handleArchiveHabit}
/>
```

- [ ] **Step 4: Run the client test to verify it passes**

Run:

```bash
npm test -- tests/client/App.test.tsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/App.tsx tests/client/App.test.tsx
git commit -m "Wire habit mutations through app state"
```

## Task 8: Add habit creation and editing controls in the all-habits view

**Files:**
- Modify: `src/client/components/HabitsPage.tsx`
- Modify: `src/client/styles.css`
- Modify: `tests/client/App.test.tsx`

- [ ] **Step 1: Write failing client test for creating a habit**

Add to `tests/client/App.test.tsx`:

```ts
it("creates a habit from the all habits view", async () => {
  const user = userEvent.setup();
  const initialState = {
    ...appState,
    habits: [],
    habitRecords: []
  };
  const createdState = {
    ...initialState,
    habits: [
      {
        id: "habit-1",
        title: "爬坡",
        schedule: { weekdays: [0, 6] },
        period: { kind: "ongoing", startDate: "2026-06-19" },
        createdAt: "2026-06-19T10:00:00.000Z",
        updatedAt: "2026-06-19T10:00:00.000Z"
      }
    ]
  };

  globalThis.fetch = vi.fn(async (input) => {
    const path = String(input);
    if (path === "/api/state") {
      return jsonResponse(initialState);
    }
    if (path === "/api/habits") {
      return jsonResponse(createdState);
    }
    return jsonResponse(initialState);
  });

  render(<App />);

  await user.click(await screen.findByRole("button", { name: "习惯" }));
  await user.click(screen.getByRole("button", { name: "全部习惯" }));
  await user.type(screen.getByLabelText("习惯名称"), "爬坡");
  await user.click(screen.getByRole("checkbox", { name: "周日" }));
  await user.click(screen.getByRole("checkbox", { name: "周六" }));
  await user.click(screen.getByRole("button", { name: "创建习惯" }));

  expect(await screen.findByText("爬坡")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the client test to verify it fails**

Run:

```bash
npm test -- tests/client/App.test.tsx
```

Expected:
- FAIL because the habit creation form does not exist

- [ ] **Step 3: Add minimal create form to `HabitsPage.tsx`**

In the `all` tab, add:

```tsx
const [title, setTitle] = useState("");
const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
```

Create form:

```tsx
<form
  className="habit-create-form"
  onSubmit={(event) => {
    event.preventDefault();
    if (!title.trim() || selectedWeekdays.length === 0) {
      return;
    }
    void onCreateHabit?.({
      title: title.trim(),
      schedule: { weekdays: selectedWeekdays.sort((a, b) => a - b) },
      period: { kind: "ongoing", startDate: today }
    });
    setTitle("");
    setSelectedWeekdays([]);
  }}
>
  <label>
    <span>习惯名称</span>
    <input value={title} onChange={(event) => setTitle(event.target.value)} />
  </label>
  <fieldset>
    <legend>执行日</legend>
    {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
      <label key={weekday}>
        <input
          type="checkbox"
          checked={selectedWeekdays.includes(weekday)}
          aria-label={["周日", "周一", "周二", "周三", "周四", "周五", "周六"][weekday]}
          onChange={() =>
            setSelectedWeekdays((current) =>
              current.includes(weekday) ? current.filter((value) => value !== weekday) : [...current, weekday]
            )
          }
        />
        {["周日", "周一", "周二", "周三", "周四", "周五", "周六"][weekday]}
      </label>
    ))}
  </fieldset>
  <button type="submit" className="primary-action">
    创建习惯
  </button>
</form>
```

Add prop:

```ts
onCreateHabit?: (input: {
  title: string;
  schedule: { weekdays: number[] };
  period: { kind: "ongoing"; startDate: string } | { kind: "bounded"; startDate: string; endDate: string };
}) => Promise<void>;
```

- [ ] **Step 4: Run the client test to verify it passes**

Run:

```bash
npm test -- tests/client/App.test.tsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/components/HabitsPage.tsx src/client/styles.css tests/client/App.test.tsx
git commit -m "Add habit creation form"
```

## Task 9: Final verification and docs touch-up

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Add a short README capability line for habits**

Update the feature summary in `README.md`:

```md
- 独立的习惯页面，支持今天视图、历史漏项和全部习惯管理
```

- [ ] **Step 2: Add a short AGENTS note about the habit/page boundary**

Update `AGENTS.md` current capability section:

```md
- 习惯系统与项目系统分离：
  - 习惯是独立页面
  - 不进入项目待办清单
  - 默认页面是“今天”，并提供“全部习惯”管理
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run build
```

Expected:
- All tests PASS
- Build succeeds

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "Document habit system entry points"
```

## Self-Review

Spec coverage check:

- Dedicated habit page: covered by Tasks 5 and 6.
- Default today view: covered by Task 6.
- Full habit management view: covered by Tasks 6 and 8.
- Weekly schedule: covered by Tasks 1, 2, and 8.
- Ongoing and bounded periods: covered by Tasks 1, 2, and 4.
- Default missed behavior and backfill: covered by Tasks 2, 4, and 7.
- Archive only, no pause: covered by Tasks 4 and 6.
- Kept separate from project task tree: covered by architecture and file plan; no task routes or project routes are reused for habits.

Placeholder scan:

- No `TODO` / `TBD`
- Every test and route step contains concrete code or commands
- No “similar to previous task” references

Type consistency check:

- Shared types define `Habit`, `HabitRecord`, `HabitSchedule`, and `HabitPeriod`
- Shared helper functions use those names consistently
- Server and client both use `/api/habits`, `/api/habits/:habitId/records/:date`, and `/api/habits/:habitId/archive`

