# TaskFlow v0.2 Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement v0.2 interaction fixes: deduplicated feedback, generic task trees, and a full feedback page.

**Architecture:** Extend the shared domain types first so server and client agree on task-tree and feedback semantics. Keep weekly GitHub candidates on the existing progress-object path, but add a per-object feedback marker to prevent duplicate positive feedback. Add a generic task-tree path for templates without progress objects, then render it in `ProjectDetail` and expose all activity in a new feedback page.

**Tech Stack:** TypeScript, React, Express, JSON-file storage, Vitest, Testing Library, Playwright for final browser verification.

---

### Task 1: Feedback Semantics And Types

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/progress.ts`
- Test: `tests/shared/progress.test.ts`

- [ ] Add optional feedback metadata to `ProgressObjectInstance`.
- [ ] Add `ActivityType` and `type` to `ActivityEntry`.
- [ ] Write failing tests that a candidate only creates one small feedback when entering concluded states repeatedly.
- [ ] Implement `transitionProgressObject` so repeated or revised concluded states update status but do not create additional feedback.
- [ ] Run `npm test -- tests/shared/progress.test.ts`.

### Task 2: Generic Task Tree Domain

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/shared/taskTree.ts`
- Modify: `src/shared/projectFactory.ts`
- Modify: `src/shared/genericTaskTemplate.ts`
- Test: `tests/shared/taskTree.test.ts`
- Test: `tests/shared/projectFactory.test.ts`

- [ ] Add generic task node types with max depth 3.
- [ ] Create task-tree domain functions: add child task, transition task, complete parent with unresolved descendants archived as `unhandled`.
- [ ] Write failing tests for max depth, completed feedback, dropped entropy feedback, and parent completion with unhandled descendants.
- [ ] Initialize generic projects with a root task node matching the project title.
- [ ] Run `npm test -- tests/shared/taskTree.test.ts tests/shared/projectFactory.test.ts`.

### Task 3: Server Routes

**Files:**
- Modify: `src/server/routes.ts`
- Test: `tests/server/routes.test.ts`

- [ ] Add routes for generic task-tree mutations:
  - `POST /api/projects/:projectId/tasks/:taskId/children`
  - `PATCH /api/projects/:projectId/tasks/:taskId/status`
- [ ] Append feedback activity only when domain functions return activity.
- [ ] Map task-tree domain errors to 400, 404, or 409.
- [ ] Run `npm test -- tests/server/routes.test.ts`.

### Task 4: Client API And Current Panel

**Files:**
- Modify: `src/client/api.ts`
- Modify: `src/client/components/CurrentPanel.tsx`
- Test: `tests/client/App.test.tsx`

- [ ] Add API helpers for adding child tasks and transitioning task nodes.
- [ ] Add `onViewFeedback` to `CurrentPanel`.
- [ ] Render `查看全部反馈` when there is activity.
- [ ] Write failing client tests for the feedback link.
- [ ] Run `npm test -- tests/client/App.test.tsx`.

### Task 5: Project Detail Task Tree UI

**Files:**
- Modify: `src/client/components/ProjectDetail.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/styles.css`
- Test: `tests/client/App.test.tsx`

- [ ] Render task-tree controls for generic tasks.
- [ ] Allow adding child tasks until depth 3.
- [ ] Allow marking tasks as `进行中`, `完成`, or `不做了`.
- [ ] Hide candidate current-state action buttons.
- [ ] Run `npm test -- tests/client/App.test.tsx`.

### Task 6: Feedback Page

**Files:**
- Create: `src/client/components/FeedbackPage.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/styles.css`
- Test: `tests/client/App.test.tsx`

- [ ] Add top navigation item `反馈`.
- [ ] Render all activity sorted newest first.
- [ ] Add filters: all, small, big, current project.
- [ ] Ensure the current-panel link opens the feedback page.
- [ ] Run `npm test -- tests/client/App.test.tsx`.

### Task 7: Final Verification

**Files:**
- Review changed files only.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Use Playwright against the local app to verify:
  - candidate repeated state changes do not inflate feedback;
  - generic task can add child tasks and mark `不做了`;
  - feedback page shows more than three entries.
- [ ] Because this directory is not a git repository, record changed file paths instead of committing.
