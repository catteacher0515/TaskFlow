import type { AppState } from "../../shared/types";

interface CurrentPanelProps {
  state: AppState;
  onViewFeedback?: () => void;
}

export function CurrentPanel({ state, onViewFeedback }: CurrentPanelProps) {
  const activeCount = state.projects.filter((project) => project.status === "active").length;
  const activeLimit = state.settings.activeProjectLimit;
  const isOverLimit = activeCount > activeLimit;
  const focusLabel = state.focusMode.status === "active" ? "收束中" : "正常";
  const recentActivity = state.activity.slice(-3).reverse();

  return (
    <section className="panel current-panel" aria-labelledby="current-panel-title">
      <div className="panel-header">
        <h2 id="current-panel-title">当前面板</h2>
        <span className={`status-badge${isOverLimit ? " danger" : ""}`}>
          进行中 {activeCount} / {activeLimit}
        </span>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <span className="metric-label">Focus</span>
          <strong>{focusLabel}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">最近反馈</span>
          <strong>{state.activity.length}</strong>
        </div>
      </div>

      <div className="activity-block">
        <div className="activity-heading">
          <h3>最近反馈</h3>
          {state.activity.length > 0 && onViewFeedback ? (
            <button className="text-action" type="button" onClick={onViewFeedback}>
              查看全部反馈
            </button>
          ) : null}
        </div>
        {recentActivity.length > 0 ? (
          <ul className="activity-list">
            {recentActivity.map((activity) => (
              <li key={activity.id}>{activity.message}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">暂无反馈</p>
        )}
      </div>
    </section>
  );
}
