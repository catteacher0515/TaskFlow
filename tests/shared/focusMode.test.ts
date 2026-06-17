import { describe, expect, it } from "vitest";
import type { FocusModeState, Warning } from "../../src/shared/types";
import { canMutateProject, completeFocusSession, selectFocusProject } from "../../src/shared/focusMode";
import { hasParallelLimitGate } from "../../src/shared/parallelLimitGate";

const blockingWarning: Warning = {
  id: "warning-1",
  type: "stagnation",
  projectId: "project-1",
  message: "项目已停滞。",
  severity: "blocking",
  createdAt: "2026-06-16T09:00:00.000Z"
};

describe("focus mode rules", () => {
  it("selects a project and starts a 5 minute session when a blocking warning exists", () => {
    const focusMode = selectFocusProject({
      warnings: [blockingWarning],
      projectId: "project-1",
      selectedActionId: "action-1",
      customActionLabel: "写下下一步",
      now: "2026-06-16T10:00:00.000Z"
    });

    expect(focusMode).toEqual({
      status: "active",
      selectedProjectId: "project-1",
      selectedActionId: "action-1",
      customActionLabel: "写下下一步",
      session: {
        startedAt: "2026-06-16T10:00:00.000Z",
        durationMinutes: 5
      }
    });
  });

  it("rejects focus mode selection without a blocking warning", () => {
    expect(() =>
      selectFocusProject({
        warnings: [{ ...blockingWarning, severity: "warning" }],
        projectId: "project-1",
        now: "2026-06-16T10:00:00.000Z"
      })
    ).toThrow("Focus mode requires at least one blocking warning");
  });

  it("rejects selecting a project when only another project has a project-level blocking warning", () => {
    expect(() =>
      selectFocusProject({
        warnings: [
          {
            ...blockingWarning,
            projectId: "project-2"
          }
        ],
        projectId: "project-1",
        now: "2026-06-16T10:00:00.000Z"
      })
    ).toThrow("Focus mode requires a blocking warning for the selected project");
  });

  it("blocks mutation for non-selected projects while focus mode is active", () => {
    const focusMode: FocusModeState = {
      status: "active",
      selectedProjectId: "project-1",
      session: {
        startedAt: "2026-06-16T10:00:00.000Z",
        durationMinutes: 5
      }
    };

    expect(canMutateProject(focusMode, "project-1")).toBe(true);
    expect(canMutateProject(focusMode, "project-2")).toBe(false);
  });

  it("allows mutation for any project while focus mode is inactive", () => {
    expect(canMutateProject({ status: "inactive" }, "project-2")).toBe(true);
  });

  it("records the focus session result while preserving the session fields", () => {
    const focusMode: FocusModeState = {
      status: "active",
      selectedProjectId: "project-1",
      selectedActionId: "action-1",
      session: {
        startedAt: "2026-06-16T10:00:00.000Z",
        durationMinutes: 5
      }
    };

    expect(completeFocusSession(focusMode, "recorded")).toEqual({
      status: "active",
      selectedProjectId: "project-1",
      selectedActionId: "action-1",
      session: {
        startedAt: "2026-06-16T10:00:00.000Z",
        durationMinutes: 5,
        result: "recorded"
      }
    });
  });

  it("rejects completion when there is no active focus session", () => {
    expect(() => completeFocusSession({ status: "inactive" }, "blocked")).toThrow("No active focus session");
  });

  it("does not overwrite an already completed focus session result", () => {
    const focusMode: FocusModeState = {
      status: "active",
      selectedProjectId: "project-1",
      session: {
        startedAt: "2026-06-16T10:00:00.000Z",
        durationMinutes: 5,
        result: "recorded"
      }
    };

    expect(() => completeFocusSession(focusMode, "blocked")).toThrow("Focus session already completed");
  });

  it("requires unresolved selection only for a parallel limit warning while focus mode is inactive", () => {
    expect(
      hasParallelLimitGate(
        [
          {
            ...blockingWarning,
            type: "parallel_limit",
            projectId: undefined
          }
        ],
        { status: "inactive" }
      )
    ).toBe(true);
  });

  it("does not trigger the gate for non-parallel blocking warnings or after a project is selected", () => {
    expect(hasParallelLimitGate([blockingWarning], { status: "inactive" })).toBe(false);
    expect(
      hasParallelLimitGate(
        [
          {
            ...blockingWarning,
            type: "parallel_limit",
            projectId: undefined
          }
        ],
        {
          status: "active",
          selectedProjectId: "project-1",
          session: {
            startedAt: "2026-06-16T10:00:00.000Z",
            durationMinutes: 5
          }
        }
      )
    ).toBe(false);
  });
});
