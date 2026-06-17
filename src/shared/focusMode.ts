import type { FocusModeState, FocusSessionResult, Warning } from "./types";

interface SelectFocusProjectInput {
  warnings: Warning[];
  projectId: string;
  selectedActionId?: string;
  customActionLabel?: string;
  now: string;
}

export function selectFocusProject(input: SelectFocusProjectInput): FocusModeState {
  const hasBlockingWarning = input.warnings.some((warning) => warning.severity === "blocking");
  if (!hasBlockingWarning) {
    throw new Error("Focus mode requires at least one blocking warning");
  }

  const canSelectProject = input.warnings.some(
    (warning) =>
      warning.severity === "blocking" && (warning.projectId === undefined || warning.projectId === input.projectId)
  );

  if (!canSelectProject) {
    throw new Error("Focus mode requires a blocking warning for the selected project");
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
  if (focusMode.status === "inactive") {
    return true;
  }

  return focusMode.selectedProjectId === projectId;
}

export function completeFocusSession(
  focusMode: FocusModeState,
  result: FocusSessionResult
): FocusModeState {
  if (focusMode.status !== "active" || !focusMode.session) {
    throw new Error("No active focus session");
  }

  if (focusMode.session.result) {
    throw new Error("Focus session already completed");
  }

  return {
    ...focusMode,
    session: {
      ...focusMode.session,
      result
    }
  };
}

export function exitFocusMode(): FocusModeState {
  return {
    status: "inactive"
  };
}
