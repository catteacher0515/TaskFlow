import { useMemo, useState } from "react";
import { buildTodayHabitsView } from "../../shared/habits";
import type { AppState, Habit, HabitPeriod } from "../../shared/types";

type HabitPageView = "today" | "all";

interface HabitsPageProps {
  state: AppState;
  onCreateHabit?: (input: {
    title: string;
    schedule: { weekdays: number[] };
    period: HabitPeriod;
  }) => Promise<void>;
  onCompleteHabit?: (habitId: string, date: string) => Promise<void>;
  onArchiveHabit?: (habitId: string) => Promise<void>;
  onUpdateHabit?: (habitId: string, input: {
    title: string;
    schedule: { weekdays: number[] };
    period: HabitPeriod;
  }) => Promise<void>;
}

const weekdayOptions: Array<{ value: number; label: string }> = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" }
];

export function HabitsPage({ state, onCreateHabit, onCompleteHabit, onArchiveHabit, onUpdateHabit }: HabitsPageProps) {
  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);
  const [view, setView] = useState<HabitPageView>("today");
  const [title, setTitle] = useState("");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [periodKind, setPeriodKind] = useState<"bounded" | "ongoing">("bounded");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);

  const todayView = useMemo(
    () =>
      buildTodayHabitsView({
        habits: state.habits,
        records: state.habitRecords,
        today
      }),
    [state.habitRecords, state.habits, today]
  );

  const activeHabits = state.habits.filter((habit) => !habit.archivedAt);
  const archivedHabits = state.habits.filter((habit) => Boolean(habit.archivedAt));
  const isCreateDisabled =
    !title.trim() ||
    selectedWeekdays.length === 0 ||
    !startDate ||
    (periodKind === "bounded" && (!endDate || endDate < startDate));

  async function handleSubmitHabit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreateDisabled) {
      return;
    }

    const normalizedWeekdays = [...selectedWeekdays].sort((left, right) => left - right);
    const period: HabitPeriod =
      periodKind === "ongoing"
        ? {
            kind: "ongoing",
            startDate
          }
        : {
            kind: "bounded",
            startDate,
            endDate
          };

    if (editingHabitId) {
      if (!onUpdateHabit) {
        return;
      }

      await onUpdateHabit(editingHabitId, {
        title: title.trim(),
        schedule: { weekdays: normalizedWeekdays },
        period
      });
    } else {
      if (!onCreateHabit) {
        return;
      }

      await onCreateHabit({
        title: title.trim(),
        schedule: { weekdays: normalizedWeekdays },
        period
      });
    }

    resetForm();
    setView("all");
  }

  function toggleWeekday(weekday: number) {
    setSelectedWeekdays((current) =>
      current.includes(weekday) ? current.filter((value) => value !== weekday) : [...current, weekday]
    );
  }

  function startEditingHabit(habit: Habit) {
    setEditingHabitId(habit.id);
    setTitle(habit.title);
    setSelectedWeekdays([...habit.schedule.weekdays]);
    setPeriodKind(habit.period.kind);
    setStartDate(habit.period.startDate);
    setEndDate(habit.period.kind === "bounded" ? habit.period.endDate : today);
  }

  function resetForm() {
    setEditingHabitId(null);
    setTitle("");
    setSelectedWeekdays([1, 2, 3, 4, 5]);
    setPeriodKind("bounded");
    setStartDate(today);
    setEndDate(today);
  }

  return (
    <section className="panel page-panel habits-page" aria-labelledby="habits-page-title">
      <div className="detail-header">
        <div>
          <p className="eyebrow">重复行为维持</p>
          <h2 id="habits-page-title">习惯</h2>
        </div>
        <div className="habit-summary">
          <span className="status-badge">进行中 {activeHabits.length}</span>
          <span className="status-badge">{`今天 ${todayView.todayDue.length}`}</span>
        </div>
      </div>

      <div className="filter-row" role="group" aria-label="习惯视图">
        <button
          className={view === "today" ? "active" : ""}
          type="button"
          aria-pressed={view === "today"}
          onClick={() => setView("today")}
        >
          今天
        </button>
        <button
          className={view === "all" ? "active" : ""}
          type="button"
          aria-pressed={view === "all"}
          onClick={() => setView("all")}
        >
          全部习惯
        </button>
      </div>

      {view === "today" ? (
        <div className="habits-today-layout">
          <section className="habit-group">
            <div className="habit-group-header">
              <h3>今天该做</h3>
              <span>{todayView.todayDue.length}</span>
            </div>
            {todayView.todayDue.length === 0 ? (
              <p className="empty-state">今天没有安排的习惯</p>
            ) : (
              <div className="habit-list">
                {todayView.todayDue.map((item) => (
                  <article className="habit-row" key={`${item.habit.id}:${item.date}`}>
                    <div>
                      <p className="habit-title">{item.habit.title}</p>
                      <p className="habit-meta">{formatHabitDate(item.date)}</p>
                    </div>
                    <button
                      className="secondary-action compact"
                      type="button"
                      disabled={item.completed}
                      onClick={() => void onCompleteHabit?.(item.habit.id, item.date)}
                    >
                      {item.completed ? "已完成" : "标记完成"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="habit-group">
            <div className="habit-group-header">
              <h3>历史漏项</h3>
              <span>{todayView.missed.length}</span>
            </div>
            {todayView.missed.length === 0 ? (
              <p className="empty-state">暂无历史漏项</p>
            ) : (
              <div className="habit-list">
                {todayView.missed.map((item) => (
                  <article className="habit-row" key={`${item.habit.id}:${item.date}`}>
                    <div>
                      <p className="habit-title">{item.habit.title}</p>
                      <p className="habit-meta">{formatHabitDate(item.date)}</p>
                    </div>
                    <button
                      className="secondary-action compact"
                      type="button"
                      onClick={() => void onCompleteHabit?.(item.habit.id, item.date)}
                    >
                      补记完成
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="habits-all-layout">
          <section className="habit-group">
            <div className="habit-group-header">
              <h3>{editingHabitId ? "编辑习惯" : "新建习惯"}</h3>
              {editingHabitId ? (
                <button className="secondary-action compact" type="button" onClick={resetForm}>
                  取消编辑
                </button>
              ) : null}
            </div>
            <form className="habit-form" onSubmit={(event) => void handleSubmitHabit(event)}>
              <label>
                <span>习惯名称</span>
                <input
                  aria-label="习惯名称"
                  placeholder="比如：看 AI HOT 日报"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <fieldset className="habit-fieldset">
                <legend>执行日</legend>
                <div className="habit-weekdays">
                  {weekdayOptions.map((item) => (
                    <label className="habit-weekday" key={item.value}>
                      <input
                        type="checkbox"
                        checked={selectedWeekdays.includes(item.value)}
                        onChange={() => toggleWeekday(item.value)}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="habit-fieldset">
                <legend>周期</legend>
                <div className="habit-period-options">
                  <label className="habit-radio">
                    <input
                      type="radio"
                      name="habit-period-kind"
                      checked={periodKind === "bounded"}
                      onChange={() => setPeriodKind("bounded")}
                    />
                    <span>有起止日期</span>
                  </label>
                  <label className="habit-radio">
                    <input
                      type="radio"
                      name="habit-period-kind"
                      checked={periodKind === "ongoing"}
                      onChange={() => setPeriodKind("ongoing")}
                    />
                    <span>长期进行</span>
                  </label>
                </div>
                <div className="habit-period-fields">
                  <label>
                    <span>开始日期</span>
                    <input
                      type="date"
                      aria-label="习惯开始日期"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </label>
                  {periodKind === "bounded" ? (
                    <label>
                      <span>结束日期</span>
                      <input
                        type="date"
                        aria-label="习惯结束日期"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                      />
                    </label>
                  ) : null}
                </div>
              </fieldset>

              <div className="habit-form-actions">
                <button className="primary-action" type="submit" disabled={isCreateDisabled}>
                  {editingHabitId ? "保存习惯" : "新建习惯"}
                </button>
              </div>
            </form>
          </section>

          <section className="habit-group">
            <div className="habit-group-header">
              <h3>全部习惯</h3>
              <span>{activeHabits.length}</span>
            </div>
            {activeHabits.length === 0 ? (
              <p className="empty-state">暂无习惯</p>
            ) : (
              <div className="habit-list">
                {activeHabits.map((habit) => (
                  <article className="habit-row" key={habit.id}>
                    <div>
                      <p className="habit-title">{habit.title}</p>
                      <p className="habit-meta">
                        {formatHabitSchedule(habit)} · {formatHabitPeriod(habit)}
                      </p>
                    </div>
                    <div className="habit-actions">
                      <button
                        className="secondary-action compact"
                        type="button"
                        aria-label={`编辑：${habit.title}`}
                        onClick={() => startEditingHabit(habit)}
                      >
                        编辑
                      </button>
                      <button
                        className="secondary-action compact"
                        type="button"
                        aria-label={`归档：${habit.title}`}
                        onClick={() => void onArchiveHabit?.(habit.id)}
                      >
                        归档
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="habit-group">
            <div className="habit-group-header">
              <h3>已归档</h3>
              <span>{archivedHabits.length}</span>
            </div>
            {archivedHabits.length === 0 ? (
              <p className="empty-state">暂无已归档习惯</p>
            ) : (
              <div className="habit-list">
                {archivedHabits.map((habit) => (
                  <article className="habit-row archived" key={habit.id}>
                    <div>
                      <p className="habit-title">{habit.title}</p>
                      <p className="habit-meta">
                        {formatHabitSchedule(habit)} · 已归档
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function formatHabitSchedule(habit: Habit) {
  if (habit.schedule.weekdays.length === 7) {
    return "每天";
  }

  return weekdayOptions
    .filter((item) => habit.schedule.weekdays.includes(item.value))
    .map((item) => item.label)
    .join("、");
}

function formatHabitPeriod(habit: Habit) {
  if (habit.period.kind === "ongoing") {
    return `长期进行 · ${habit.period.startDate} 开始`;
  }

  return `${habit.period.startDate} 到 ${habit.period.endDate}`;
}

function formatHabitDate(date: string) {
  const weekday = weekdayOptions.find((item) => item.value === new Date(`${date}T12:00:00`).getDay())?.label;
  return weekday ? `${date} · ${weekday}` : date;
}
