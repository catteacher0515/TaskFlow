import { useMemo, useState } from "react";
import type { ActivityEntry, AppState, FeedbackKind } from "../../shared/types";

type FeedbackFilter = "all" | FeedbackKind | "current";

interface FeedbackPageProps {
  state: AppState;
  selectedProjectId?: string;
}

const filterLabels: Array<{ id: FeedbackFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "small", label: "小反馈" },
  { id: "big", label: "大反馈" },
  { id: "current", label: "当前项目" }
];

const typeLabels: Record<string, string> = {
  progress_concluded: "结论",
  slot_filled: "槽位填充",
  stage_completed: "阶段完成",
  task_completed: "完成",
  entropy_reduced: "熵减",
  project_completed: "项目完成"
};

export function FeedbackPage({ state, selectedProjectId }: FeedbackPageProps) {
  const [filter, setFilter] = useState<FeedbackFilter>("all");
  const projectNameById = useMemo(
    () => new Map(state.projects.map((project) => [project.id, project.title])),
    [state.projects]
  );
  const sortedActivity = [...state.activity].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const visibleActivity = sortedActivity.filter((activity) => {
    if (filter === "all") {
      return true;
    }

    if (filter === "current") {
      return activity.projectId === selectedProjectId;
    }

    return activity.kind === filter;
  });

  return (
    <section className="panel page-panel feedback-page" aria-labelledby="feedback-page-title">
      <div className="detail-header">
        <div>
          <p className="eyebrow">有效推进记录</p>
          <h2 id="feedback-page-title">反馈</h2>
        </div>
        <span className="status-badge">共 {state.activity.length}</span>
      </div>

      <div className="filter-row" aria-label="反馈筛选">
        {filterLabels.map((item) => (
          <button
            className={filter === item.id ? "active" : ""}
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visibleActivity.length > 0 ? (
        <ol className="feedback-list">
          {visibleActivity.map((activity) => (
            <li key={activity.id}>
              <FeedbackRow activity={activity} projectTitle={projectNameById.get(activity.projectId) ?? "未知项目"} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-state">暂无反馈</p>
      )}
    </section>
  );
}

function FeedbackRow({ activity, projectTitle }: { activity: ActivityEntry; projectTitle: string }) {
  return (
    <article className="feedback-row">
      <div className="feedback-meta">
        <span>{formatDateTime(activity.createdAt)}</span>
        <span>{projectTitle}</span>
        <span>{activity.kind === "big" ? "大反馈" : "小反馈"}</span>
        <span>{activity.type ? typeLabels[activity.type] ?? activity.type : "反馈"}</span>
      </div>
      <p>{activity.message}</p>
    </article>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
