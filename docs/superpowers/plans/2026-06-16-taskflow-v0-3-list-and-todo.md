# TaskFlow v0.3 List And Todo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collapsible project groups, reversible project completion, and Todo-style generic task interaction with feedback revocation.

**Architecture:** Keep template management unchanged. Add small domain helpers for project status restoration and task feedback revocation, then expose them through existing API routes. Update React components with grouped project list state, checkbox task rows, context menus, and filtered effective feedback.

**Tech Stack:** TypeScript, React, Express, JSONL storage, Vitest, Testing Library, Vite.

---

### Task 1: Project Status Restoration

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/shared/projectStatus.ts`
- Modify: `src/server/routes.ts`
- Test: `tests/shared/projectStatus.test.ts`
- Test: `tests/server/routes.test.ts`

- [ ] Track previous project status when a project is completed.
- [ ] Restore completed projects to their recorded previous status.
- [ ] Expose `POST /api/projects/:projectId/reopen`.

### Task 2: Feedback Revocation For Task Reopen

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/taskTree.ts`
- Modify: `src/server/storage.ts`
- Modify: `src/server/routes.ts`
- Test: `tests/shared/taskTree.test.ts`
- Test: `tests/server/routes.test.ts`

- [ ] Mark activity entries as revoked instead of deleting lines.
- [ ] When a task restores to `not_started`, clear its feedback marker and revoke matching task feedback.
- [ ] Ensure `readState` only returns non-revoked feedback.

### Task 3: Collapsible Project List

**Files:**
- Modify: `src/client/components/ProjectList.tsx`
- Modify: `src/client/styles.css`
- Test: `tests/client/App.test.tsx`

- [ ] Render status groups with counts.
- [ ] Default `active` expanded and `completed` collapsed.
- [ ] Keep project selection working inside expanded groups.

### Task 4: Todo Task UI

**Files:**
- Modify: `src/client/components/ProjectDetail.tsx`
- Modify: `src/client/styles.css`
- Test: `tests/client/App.test.tsx`

- [ ] Replace task status buttons with checkbox rows.
- [ ] Play a short Web Audio completion sound after successful completion.
- [ ] Add right-click menu with `不做了` and `恢复为待办`.
- [ ] Keep add-child controls visible for open tasks.

### Task 5: Final Verification And Push

**Files:**
- Review changed files only.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit only files changed for v0.3, leaving pre-existing unrelated changes alone.
- [ ] Push to `origin/main`.
