import { useMemo, useState } from "react";
import type { ActivityEntry, AppState, FeedbackKind } from "../../shared/types";

type FeedbackFilter = "all" | FeedbackKind | "current";
type FeedbackTimeFilter = "today" | "last7" | "last30" | "all" | "custom";
type FeedbackGrouping = "day" | "week" | "month";

interface FeedbackPageProps {
  state: AppState;
  selectedProjectId?: string;
  onRevokeActivity?: (activityId: string) => Promise<void>;
  onRevokeActivities?: (activityIds: string[]) => Promise<void>;
}

interface FeedbackGroup {
  id: string;
  label: string;
  items: ActivityEntry[];
  sortValue: number;
}

const filterLabels: Array<{ id: FeedbackFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "small", label: "小反馈" },
  { id: "big", label: "大反馈" },
  { id: "current", label: "当前项目" }
];

const timeFilterLabels: Array<{ id: FeedbackTimeFilter; label: string }> = [
  { id: "today", label: "今天" },
  { id: "last7", label: "近 7 天" },
  { id: "last30", label: "近 30 天" },
  { id: "all", label: "全部" },
  { id: "custom", label: "自定义" }
];

const groupingLabels: Array<{ id: FeedbackGrouping; label: string }> = [
  { id: "day", label: "按天" },
  { id: "week", label: "按周" },
  { id: "month", label: "按月" }
];

const typeLabels: Record<string, string> = {
  progress_concluded: "结论",
  slot_filled: "槽位填充",
  stage_completed: "阶段完成",
  task_completed: "完成",
  entropy_reduced: "熵减",
  project_completed: "项目完成"
};

export function FeedbackPage({ state, selectedProjectId, onRevokeActivity, onRevokeActivities }: FeedbackPageProps) {
  const [filter, setFilter] = useState<FeedbackFilter>("all");
  const [timeFilter, setTimeFilter] = useState<FeedbackTimeFilter>("all");
  const [grouping, setGrouping] = useState<FeedbackGrouping>("day");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);

  const projectNameById = useMemo(
    () => new Map(state.projects.map((project) => [project.id, project.title])),
    [state.projects]
  );

  const sortedActivity = useMemo(
    () => [...state.activity].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [state.activity]
  );

  const customDateRange = useMemo(() => {
    if (timeFilter !== "custom" || !customStartDate) {
      return { start: undefined, end: undefined, error: null as string | null };
    }

    const resolvedEndDate = customEndDate || customStartDate;
    if (resolvedEndDate < customStartDate) {
      return {
        start: undefined,
        end: undefined,
        error: "结束日期不能早于开始日期"
      };
    }

    return {
      start: startOfLocalDay(parseLocalDate(customStartDate)),
      end: endOfLocalDay(parseLocalDate(resolvedEndDate)),
      error: null as string | null
    };
  }, [customEndDate, customStartDate, timeFilter]);

  const visibleActivity = useMemo(() => {
    const now = new Date();
    const todayStart = startOfLocalDay(now);
    const todayEnd = endOfLocalDay(now);
    const last7Start = startOfLocalDay(addDays(now, -6));
    const last30Start = startOfLocalDay(addDays(now, -29));

    return sortedActivity.filter((activity) => {
      if (filter === "current" && activity.projectId !== selectedProjectId) {
        return false;
      }

      if (filter !== "all" && filter !== "current" && activity.kind !== filter) {
        return false;
      }

      const activityDate = new Date(activity.createdAt);

      if (Number.isNaN(activityDate.getTime())) {
        return timeFilter === "all" || (timeFilter === "custom" && customDateRange.error !== null);
      }

      if (timeFilter === "today") {
        return activityDate >= todayStart && activityDate <= todayEnd;
      }

      if (timeFilter === "last7") {
        return activityDate >= last7Start && activityDate <= todayEnd;
      }

      if (timeFilter === "last30") {
        return activityDate >= last30Start && activityDate <= todayEnd;
      }

      if (timeFilter === "custom") {
        if (customDateRange.error || !customDateRange.start || !customDateRange.end) {
          return true;
        }

        return activityDate >= customDateRange.start && activityDate <= customDateRange.end;
      }

      return true;
    });
  }, [customDateRange, filter, selectedProjectId, sortedActivity, timeFilter]);

  const groupedActivity = useMemo(() => groupActivityBy(visibleActivity, grouping), [grouping, visibleActivity]);

  const selectedVisibleActivityIds = visibleActivity
    .filter((activity) => selectedActivityIds.includes(activity.id))
    .map((activity) => activity.id);

  async function handleRevokeMany(activityIds: string[], confirmationMessage: string) {
    if (!onRevokeActivities || activityIds.length === 0) {
      return;
    }

    const shouldRevoke = window.confirm(confirmationMessage);
    if (!shouldRevoke) {
      return;
    }

    await onRevokeActivities(activityIds);
    setSelectedActivityIds((current) => current.filter((id) => !activityIds.includes(id)));
  }

  return (
    <section className="panel page-panel feedback-page" aria-labelledby="feedback-page-title">
      <div className="detail-header">
        <div>
          <p className="eyebrow">有效推进记录</p>
          <h2 id="feedback-page-title">反馈</h2>
        </div>
        <div className="feedback-actions">
          {onRevokeActivities ? (
            isBulkMode ? (
              <>
                <button
                  className="secondary-action compact"
                  type="button"
                  onClick={() => {
                    setIsBulkMode(false);
                    setSelectedActivityIds([]);
                  }}
                >
                  退出批量管理
                </button>
                <button
                  className="secondary-action compact"
                  type="button"
                  disabled={selectedVisibleActivityIds.length === 0}
                  onClick={() =>
                    void handleRevokeMany(
                      selectedVisibleActivityIds,
                      `确定要批量删除这 ${selectedVisibleActivityIds.length} 条反馈吗？删除后它们会从界面隐藏，但底层历史记录会保留。`
                    )
                  }
                >
                  {selectedVisibleActivityIds.length > 0 ? `批量删除 ${selectedVisibleActivityIds.length} 条` : "批量删除"}
                </button>
                <button
                  className="secondary-action compact"
                  type="button"
                  disabled={visibleActivity.length === 0}
                  onClick={() =>
                    void handleRevokeMany(
                      visibleActivity.map((activity) => activity.id),
                      `确定要删除当前筛选结果中的 ${visibleActivity.length} 条反馈吗？这只会移除当前筛选出的反馈，底层历史记录会保留。`
                    )
                  }
                >
                  {`一键删除当前筛选结果（${visibleActivity.length} 条）`}
                </button>
              </>
            ) : (
              <button className="secondary-action compact" type="button" onClick={() => setIsBulkMode(true)}>
                批量管理
              </button>
            )
          ) : null}
          <span className="status-badge">共 {state.activity.length}</span>
        </div>
      </div>

      <div className="filter-row" role="group" aria-label="反馈筛选">
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

      <div className="filter-row" role="group" aria-label="时间筛选">
        {timeFilterLabels.map((item) => (
          <button
            className={timeFilter === item.id ? "active" : ""}
            key={item.id}
            type="button"
            aria-pressed={timeFilter === item.id}
            onClick={() => setTimeFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="feedback-date-range">
        <label className="feedback-date-field">
          <span>开始日期</span>
          <input
            type="date"
            aria-label="开始日期"
            value={customStartDate}
            disabled={timeFilter !== "custom"}
            onChange={(event) => setCustomStartDate(event.target.value)}
          />
        </label>
        <label className="feedback-date-field">
          <span>结束日期</span>
          <input
            type="date"
            aria-label="结束日期"
            value={customEndDate}
            disabled={timeFilter !== "custom"}
            onChange={(event) => setCustomEndDate(event.target.value)}
          />
        </label>
      </div>

      {customDateRange.error ? <p className="feedback-range-error">{customDateRange.error}</p> : null}

      <div className="filter-row" role="group" aria-label="反馈分组">
        {groupingLabels.map((item) => (
          <button
            className={grouping === item.id ? "active" : ""}
            key={item.id}
            type="button"
            aria-pressed={grouping === item.id}
            onClick={() => setGrouping(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visibleActivity.length > 0 ? (
        <div className="feedback-groups">
          {groupedActivity.map((group) => (
            <section className="feedback-group" key={group.id}>
              <h3 className="feedback-group-header">{group.label}</h3>
              <ol className="feedback-list">
                {group.items.map((activity) => (
                  <li key={activity.id}>
                    <FeedbackRow
                      activity={activity}
                      projectTitle={projectNameById.get(activity.projectId) ?? "未知项目"}
                      onRevokeActivity={onRevokeActivity}
                      checked={isBulkMode ? selectedActivityIds.includes(activity.id) : undefined}
                      onToggleSelected={
                        isBulkMode
                          ? (checked) =>
                              setSelectedActivityIds((current) =>
                                checked
                                  ? [...new Set([...current, activity.id])]
                                  : current.filter((id) => id !== activity.id)
                              )
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <p className="empty-state">暂无反馈</p>
      )}
    </section>
  );
}

function FeedbackRow({
  activity,
  projectTitle,
  onRevokeActivity,
  checked,
  onToggleSelected
}: {
  activity: ActivityEntry;
  projectTitle: string;
  onRevokeActivity?: (activityId: string) => Promise<void>;
  checked?: boolean;
  onToggleSelected?: (checked: boolean) => void;
}) {
  return (
    <article className="feedback-row">
      <div className="feedback-header">
        <div className="feedback-header-main">
          {onToggleSelected ? (
            <label className="feedback-select">
              <input
                type="checkbox"
                aria-label={`选择反馈：${activity.message}`}
                checked={checked ?? false}
                onChange={(event) => onToggleSelected(event.target.checked)}
              />
            </label>
          ) : null}
          <div className="feedback-meta">
            <span>{formatDateTime(activity.createdAt)}</span>
            <span>{projectTitle}</span>
            <span>{activity.kind === "big" ? "大反馈" : "小反馈"}</span>
            <span>{activity.type ? typeLabels[activity.type] ?? activity.type : "反馈"}</span>
          </div>
        </div>
        {onRevokeActivity ? (
          <button
            className="text-action"
            type="button"
            aria-label={`删除反馈：${activity.message}`}
            onClick={() => {
              const shouldRevoke = window.confirm("确定要删除这条反馈吗？删除后它会从界面隐藏，但底层历史记录会保留。");
              if (!shouldRevoke) {
                return;
              }

              void onRevokeActivity(activity.id);
            }}
          >
            删除
          </button>
        ) : null}
      </div>
      <p>{activity.message}</p>
    </article>
  );
}

function groupActivityBy(activity: ActivityEntry[], grouping: FeedbackGrouping): FeedbackGroup[] {
  const groups = new Map<string, FeedbackGroup>();
  const now = new Date();

  for (const item of activity) {
    const date = new Date(item.createdAt);
    if (Number.isNaN(date.getTime())) {
      const existing = groups.get("invalid");
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set("invalid", {
          id: "invalid",
          label: "时间异常 · 1 条",
          items: [item],
          sortValue: Number.MIN_SAFE_INTEGER
        });
      }
      continue;
    }

    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (grouping === "day") {
      const key = formatDateKey(localDate);
      const label = buildDayGroupLabel(localDate, now, 0);
      mergeGroup(groups, key, label, item, localDate.getTime());
      continue;
    }

    if (grouping === "week") {
      const weekInfo = getWeekInfo(localDate);
      const key = `week-${weekInfo.year}-${weekInfo.week}`;
      const label = `${weekInfo.year} 第 ${weekInfo.week} 周 · 0 条`;
      mergeGroup(groups, key, label, item, weekInfo.startOfWeek.getTime());
      continue;
    }

    const monthKey = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}`;
    mergeGroup(groups, `month-${monthKey}`, `${monthKey} · 0 条`, item, new Date(localDate.getFullYear(), localDate.getMonth(), 1).getTime());
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      label: updateGroupCount(group.label, group.items.length)
    }))
    .sort((left, right) => right.sortValue - left.sortValue);
}

function mergeGroup(
  groups: Map<string, FeedbackGroup>,
  id: string,
  label: string,
  item: ActivityEntry,
  sortValue: number
) {
  const existing = groups.get(id);
  if (existing) {
    existing.items.push(item);
    return;
  }

  groups.set(id, {
    id,
    label,
    items: [item],
    sortValue
  });
}

function updateGroupCount(label: string, count: number) {
  return label.replace(/0 条$/, `${count} 条`);
}

function buildDayGroupLabel(date: Date, now: Date, count: number) {
  const dateLabel = formatDateKey(date);
  const diffDays = Math.round((startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime()) / 86400000);

  if (diffDays === 0) {
    return `${dateLabel} · 今天 · ${count} 条`;
  }

  if (diffDays === -1) {
    return `${dateLabel} · 昨天 · ${count} 条`;
  }

  return `${dateLabel} · ${count} 条`;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map((item) => Number(item));
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getWeekInfo(date: Date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (target.getDay() + 6) % 7;
  const startOfWeek = new Date(target);
  startOfWeek.setDate(target.getDate() - weekday);

  const thursday = new Date(startOfWeek);
  thursday.setDate(startOfWeek.getDate() + 3);

  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const firstWeekday = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstWeekday + 3);

  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000);

  return {
    year: thursday.getFullYear(),
    week,
    startOfWeek
  };
}
