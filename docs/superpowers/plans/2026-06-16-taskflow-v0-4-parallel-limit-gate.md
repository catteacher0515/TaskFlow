# TaskFlow v0.4 Parallel Limit Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force the user to pick exactly one active project before any further mutation when the active project count exceeds the configured limit.

**Architecture:** Add a small shared helper that detects the unresolved parallel-limit gate from `warnings` plus `focusMode`, and reuse it in both server mutation guards and the React app. Build a focused blocking overlay component on the client and keep the existing `focusMode` flow unchanged after selection.

**Tech Stack:** TypeScript, React, Express, JSON file storage, Vitest, Testing Library, Vite.

---

### Task 1: Parallel Limit Gate Domain Helper

**Files:**
- Create: `src/shared/parallelLimitGate.ts`
- Modify: `tests/shared/focusMode.test.ts`
- Modify: `src/shared/focusMode.ts`

- [ ] Add a helper that returns whether unresolved `parallel_limit` blocking exists while `focusMode` is inactive.
- [ ] Add a helper that checks whether write operations must be blocked before focus selection.
- [ ] Cover non-parallel blocking warnings to ensure they do not trigger the gate.

### Task 2: Server Mutation Blocking

**Files:**
- Modify: `src/server/routes.ts`
- Modify: `tests/server/routes.test.ts`

- [ ] Add failing route tests for blocked project creation and blocked task/progress mutations while unresolved `parallel_limit` exists.
- [ ] Update the server guard so write routes return `409` with `Parallel limit requires selecting one focus project first`.
- [ ] Keep `/api/state`, `/api/focus/select`, and `/api/focus/complete-session` available.

### Task 3: Blocking Overlay UI

**Files:**
- Create: `src/client/components/ParallelLimitGate.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/styles.css`
- Modify: `tests/client/App.test.tsx`
- Modify: `src/client/api.ts`

- [ ] Add failing UI tests that show the blocking overlay when `parallel_limit` exists and `focusMode` is inactive.
- [ ] Render only active projects inside the gate.
- [ ] Allow choosing a template minimum action or entering a custom action.
- [ ] On selection, call the existing focus selection API and return to the current workbench flow.

### Task 4: Final Verification And Push

**Files:**
- Review changed files only.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit only v0.4 source, test, and doc files.
- [ ] Push to `origin/main`.
