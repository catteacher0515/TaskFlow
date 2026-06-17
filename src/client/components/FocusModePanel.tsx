import type { AppState } from "../../shared/types";

interface FocusModePanelProps {
  state: AppState;
  onExit?: () => Promise<void>;
}

export function FocusModePanel({ state, onExit }: FocusModePanelProps) {
  if (state.focusMode.status !== "active") {
    return null;
  }

  const selectedProject = state.projects.find((project) => project.id === state.focusMode.selectedProjectId);
  const selectedAction = selectedProject?.templateSnapshot.minimumActions.find(
    (action) => action.id === state.focusMode.selectedActionId
  );
  const actionLabel = state.focusMode.customActionLabel ?? selectedAction?.label ?? "记录一个明确推进动作";

  return (
    <section className="focus-panel" aria-labelledby="focus-mode-title">
      <div>
        <p className="eyebrow">收束模式</p>
        <h2 id="focus-mode-title">当前只推进：{selectedProject?.title ?? "未选择项目"}</h2>
      </div>
      <div className="focus-action">
        <strong>5 分钟启动块</strong>
        <span>{actionLabel}</span>
      </div>
      <button className="secondary-action" type="button" onClick={() => void onExit?.()}>
        结束收束
      </button>
    </section>
  );
}
