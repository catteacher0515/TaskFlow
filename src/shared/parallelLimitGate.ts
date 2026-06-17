import type { FocusModeState, Warning } from "./types";

export function hasParallelLimitGate(warnings: Warning[], focusMode: FocusModeState): boolean {
  if (focusMode.status !== "inactive") {
    return false;
  }

  return warnings.some((warning) => warning.type === "parallel_limit" && warning.severity === "blocking");
}
