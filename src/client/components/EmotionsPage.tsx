import { useEffect, useMemo, useState } from "react";
import {
  buildEmotionCalendarView,
  buildEmotionListView,
  emotionOptions
} from "../../shared/emotions";
import type { AppState } from "../../shared/types";

type EmotionViewMode = "calendar" | "list";

export interface EmotionsPageProps {
  state: AppState;
  onUpsertEmotionEntry: (input: {
    date: string;
    emoji: string;
    shortNote: string;
    detail: string;
  }) => Promise<void>;
}

function buildTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthStart(month: string) {
  return `${month}-01`;
}

function isMonthValue(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function isDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function EmotionsPage({
  state,
  onUpsertEmotionEntry
}: EmotionsPageProps) {
  const today = buildTodayDate();
  const [viewMode, setViewMode] = useState<EmotionViewMode>("calendar");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [emoji, setEmoji] = useState("");
  const [shortNote, setShortNote] = useState("");
  const [detail, setDetail] = useState("");
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const emotionByEmoji = useMemo(
    () => new Map(emotionOptions.map((option) => [option.emoji, option.label])),
    []
  );
  const calendarView = useMemo(
    () => buildEmotionCalendarView({ entries: state.emotionEntries, month, selectedDate }),
    [month, selectedDate, state.emotionEntries]
  );
  const listEntries = useMemo(
    () => buildEmotionListView({ entries: state.emotionEntries, month }),
    [month, state.emotionEntries]
  );
  const selectedEntry = state.emotionEntries.find((entry) => entry.date === selectedDate);
  const selectedOptionLabel = emoji ? emotionByEmoji.get(emoji) : undefined;

  useEffect(() => {
    setEmoji(selectedEntry?.emoji ?? "");
    setShortNote(selectedEntry?.shortNote ?? "");
    setDetail(selectedEntry?.detail ?? "");
    setDetailExpanded(Boolean(selectedEntry?.detail));
  }, [selectedEntry]);

  function handleMonthChange(nextMonth: string) {
    if (!isMonthValue(nextMonth)) {
      return;
    }

    setMonth(nextMonth);
  }

  function handleDateSelect(nextDate: string) {
    if (!isDateValue(nextDate)) {
      return;
    }

    setSelectedDate(nextDate);
    if (!nextDate.startsWith(month)) {
      setMonth(nextDate.slice(0, 7));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emoji || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onUpsertEmotionEntry({
        date: selectedDate,
        emoji,
        shortNote,
        detail
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel page-panel emotions-page" aria-labelledby="emotions-page-title">
      <div className="page-header">
        <div>
          <p className="eyebrow">情绪记录</p>
          <h2 id="emotions-page-title">情绪</h2>
        </div>
        <div className="emotion-selected-summary" aria-live="polite">
          <strong>{selectedDate}</strong>
          <span>{selectedOptionLabel ? `${emoji} ${selectedOptionLabel}` : "还没记录这一天"}</span>
        </div>
      </div>

      <div className="emotion-toolbar">
        <label className="emotion-month-field">
          <span>查看月份</span>
          <input
            aria-label="查看月份"
            type="month"
            value={month}
            onChange={(event) => handleMonthChange(event.target.value)}
          />
        </label>
        <div className="filter-row" role="group" aria-label="情绪视图切换">
          <button
            type="button"
            aria-pressed={viewMode === "calendar"}
            className={viewMode === "calendar" ? "active" : ""}
            onClick={() => setViewMode("calendar")}
          >
            月历
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "list"}
            className={viewMode === "list" ? "active" : ""}
            onClick={() => setViewMode("list")}
          >
            列表
          </button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <div className="emotion-calendar" role="grid" aria-label="情绪月历">
          <div className="emotion-weekdays" aria-hidden="true">
            {["日", "一", "二", "三", "四", "五", "六"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          {calendarView.weeks.map((week, weekIndex) => (
            <div className="emotion-calendar-row" role="row" key={`${calendarView.month}-${weekIndex}`}>
              {week.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  className={[
                    "emotion-day",
                    day.selected ? "selected" : "",
                    day.inMonth ? "" : "outside-month"
                  ].filter(Boolean).join(" ")}
                  aria-label={day.emoji ? `${day.date} ${day.emoji}` : day.date}
                  aria-pressed={day.selected}
                  onClick={() => handleDateSelect(day.date)}
                >
                  <span className="emotion-day-number">{day.dayOfMonth}</span>
                  <strong className="emotion-day-emoji">{day.emoji ?? ""}</strong>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <ul className="emotion-list" role="list" aria-label="情绪列表">
          {listEntries.length > 0 ? (
            listEntries.map((entry) => (
              <li key={entry.date}>
                <button
                  type="button"
                  className={`emotion-list-row${entry.date === selectedDate ? " selected" : ""}`}
                  aria-pressed={entry.date === selectedDate}
                  onClick={() => handleDateSelect(entry.date)}
                >
                  <span className="emotion-list-date">{entry.date}</span>
                  <strong className="emotion-list-summary">
                    {entry.shortNote ? `${entry.emoji} ${entry.shortNote}` : entry.emoji}
                  </strong>
                </button>
              </li>
            ))
          ) : (
            <li className="empty-state">这个月还没有情绪记录。</li>
          )}
        </ul>
      )}

      <form className="emotion-editor" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <span>日期</span>
          <input
            aria-label="情绪日期"
            type="date"
            value={selectedDate}
            onChange={(event) => handleDateSelect(event.target.value)}
          />
        </label>

        <fieldset className="emotion-options">
          <legend>今日情绪</legend>
          <div className="emotion-option-grid">
            {emotionOptions.map((option) => (
              <label
                key={option.emoji}
                className={`emotion-option${emoji === option.emoji ? " selected" : ""}`}
              >
                <input
                  type="radio"
                  name="emotion-emoji"
                  checked={emoji === option.emoji}
                  onChange={() => setEmoji(option.emoji)}
                />
                <span>{`${option.emoji} ${option.label}`}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label>
          <span>一句话总结</span>
          <input
            aria-label="一句话总结"
            value={shortNote}
            onChange={(event) => setShortNote(event.target.value)}
            placeholder="可选，写一句当天的感受"
          />
        </label>

        <div className="emotion-detail-toggle">
          <button
            type="button"
            className="secondary-action compact"
            aria-expanded={detailExpanded}
            aria-controls="emotion-detail-field"
            onClick={() => setDetailExpanded((current) => !current)}
          >
            {detailExpanded ? "收起详细内容" : "展开详细内容"}
          </button>
        </div>

        {detailExpanded ? (
          <label>
            <span>详细内容</span>
            <textarea
              id="emotion-detail-field"
              aria-label="详细内容"
              rows={5}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="可选，记录更具体的触发因素和当天进展"
            />
          </label>
        ) : null}

        <div className="detail-actions">
          <button className="primary-action" type="submit" disabled={!emoji || isSaving}>
            {isSaving ? "保存中..." : "保存这一天"}
          </button>
        </div>
      </form>
    </section>
  );
}
