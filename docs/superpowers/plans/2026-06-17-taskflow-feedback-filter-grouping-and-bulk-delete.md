# TaskFlow Feedback Filter, Grouping, and Bulk Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为反馈页增加时间筛选、自定义范围、按天/周/月分组，以及“一键删除当前筛选结果”。

**Architecture:** 继续复用现有 `state.activity` 前端派生模型，不新增后端数据结构或批量接口。所有筛选、分组和计数都在 `FeedbackPage` 内计算；删除动作继续逐条调用已有 `revoke` 接口，由 `App` 负责把一组删除结果收敛成最终状态。

**Tech Stack:** React, TypeScript, Vitest, Testing Library

---

### Task 1: Add failing feedback page tests for time filters and grouping

**Files:**
- Modify: `tests/client/App.test.tsx`
- Test: `tests/client/App.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add tests that cover:

```ts
it("filters feedback by quick time ranges and custom date range", async () => {
  // Seed activities across multiple dates.
  // Open feedback page.
  // Verify "今天", "近 7 天", "近 30 天", "全部" switch visible records.
  // Fill custom start/end dates and verify inclusive filtering.
});

it("groups feedback by day, week, and month", async () => {
  // Seed activities spanning multiple days/weeks/months.
  // Verify default day grouping heading.
  // Switch to week grouping and verify week heading/count.
  // Switch to month grouping and verify month heading/count.
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/client/App.test.tsx`

Expected: FAIL because feedback page does not yet render time filter controls or grouped headings.

- [ ] **Step 3: Commit**

```bash
git add tests/client/App.test.tsx
git commit -m "test: cover feedback time filters and grouping"
```

### Task 2: Add failing tests for delete current filtered results

**Files:**
- Modify: `tests/client/App.test.tsx`
- Test: `tests/client/App.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test like:

```ts
it("deletes all current filtered feedback results after confirmation", async () => {
  // Seed visible and non-visible activities.
  // Apply a time/type filter that leaves a subset.
  // Click "一键删除当前筛选结果（N 条)".
  // Verify only filtered items trigger revoke requests and disappear.
  // Verify unfiltered items remain.
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `npm test -- tests/client/App.test.tsx`

Expected: FAIL because the one-click delete button does not yet exist.

- [ ] **Step 3: Commit**

```bash
git add tests/client/App.test.tsx
git commit -m "test: cover delete current filtered feedback"
```

### Task 3: Implement feedback filtering, grouping, and bulk delete UI

**Files:**
- Modify: `src/client/components/FeedbackPage.tsx`
- Modify: `src/client/styles.css`
- Test: `tests/client/App.test.tsx`

- [ ] **Step 1: Implement minimal filtering/grouping state in `FeedbackPage.tsx`**

Add state and helpers for:

```ts
type FeedbackTimeFilter = "today" | "last7" | "last30" | "all" | "custom";
type FeedbackGrouping = "day" | "week" | "month";

const [timeFilter, setTimeFilter] = useState<FeedbackTimeFilter>("all");
const [grouping, setGrouping] = useState<FeedbackGrouping>("day");
const [customStartDate, setCustomStartDate] = useState("");
const [customEndDate, setCustomEndDate] = useState("");
const [dateRangeError, setDateRangeError] = useState<string | null>(null);
```

Implement helpers to:

```ts
function startOfLocalDay(date: Date): Date { ... }
function endOfLocalDay(date: Date): Date { ... }
function isActivityVisible(activity: ActivityEntry): boolean { ... }
function groupFeedback(activity: ActivityEntry[], grouping: FeedbackGrouping): FeedbackGroup[] { ... }
```

- [ ] **Step 2: Render new controls and grouped list**

Render:

```tsx
<div className="filter-row" aria-label="时间筛选">...</div>
<div className="feedback-date-range">...</div>
<div className="filter-row" aria-label="反馈分组">...</div>
<div className="feedback-groups">
  {groupedActivity.map((group) => (
    <section key={group.id}>
      <div className="feedback-group-header">{group.label}</div>
      <ol className="feedback-list">...</ol>
    </section>
  ))}
</div>
```

Also render:

```tsx
<button>一键删除当前筛选结果（{visibleActivity.length} 条）</button>
```

with confirmation text:

```ts
`确定要删除当前筛选结果中的 ${count} 条反馈吗？这只会移除当前筛选出的反馈，底层历史记录会保留。`
```

- [ ] **Step 3: Add minimal styles in `styles.css`**

Add focused styles for:

```css
.feedback-groups { ... }
.feedback-group { ... }
.feedback-group-header { ... }
.feedback-toolbar { ... }
.feedback-date-range { ... }
.feedback-range-error { ... }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/client/App.test.tsx`

Expected: PASS for new feedback-page interaction tests.

- [ ] **Step 5: Commit**

```bash
git add src/client/components/FeedbackPage.tsx src/client/styles.css tests/client/App.test.tsx
git commit -m "feat: add feedback filters and grouping"
```

### Task 4: Implement one-click filtered delete state handling in App

**Files:**
- Modify: `src/client/App.tsx`
- Test: `tests/client/App.test.tsx`

- [ ] **Step 1: Ensure grouped and filtered deletes converge to a final state**

Keep using the existing revoke API per activity, but merge the final state like:

```ts
const revokedActivityIds = new Set(activityIds);
const finalState: AppState = {
  ...nextState,
  activity: nextState.activity.filter((activity) => !revokedActivityIds.has(activity.id))
};
```

Pass the existing multi-delete handler into the new button path through `FeedbackPage`.

- [ ] **Step 2: Run tests to verify delete behavior passes**

Run: `npm test -- tests/client/App.test.tsx`

Expected: PASS for both selected-delete and filtered-delete tests.

- [ ] **Step 3: Commit**

```bash
git add src/client/App.tsx tests/client/App.test.tsx
git commit -m "feat: support deleting filtered feedback results"
```

### Task 5: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: PASS with all tests green.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS with `vite build` completing successfully.

- [ ] **Step 3: Commit**

```bash
git add src/client/App.tsx src/client/components/FeedbackPage.tsx src/client/styles.css tests/client/App.test.tsx docs/superpowers/plans/2026-06-17-taskflow-feedback-filter-grouping-and-bulk-delete.md
git commit -m "feat: enhance feedback filters grouping and bulk delete"
```
