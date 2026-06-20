import type { EmotionEntry, EmotionOption } from "./types";

export const emotionOptions: ReadonlyArray<EmotionOption> = [
  { emoji: "😭", label: "很差" },
  { emoji: "😞", label: "低落" },
  { emoji: "😐", label: "平平" },
  { emoji: "🙂", label: "还行" },
  { emoji: "😄", label: "开心" },
  { emoji: "😎", label: "很顺" },
  { emoji: "🤯", label: "爆炸" }
];

export interface EmotionCalendarDay {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  selected: boolean;
  emoji?: string;
}

export interface EmotionCalendarView {
  month: string;
  selectedDate: string;
  weeks: EmotionCalendarDay[][];
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildEmotionCalendarView(input: {
  entries: EmotionEntry[];
  month: string;
  selectedDate: string;
}): EmotionCalendarView {
  const firstOfMonth = new Date(`${input.month}-01T12:00:00`);
  const start = new Date(firstOfMonth);
  start.setDate(1 - firstOfMonth.getDay());
  const byDate = new Map(input.entries.map((entry) => [entry.date, entry]));
  const weeks: EmotionCalendarDay[][] = [];

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const week: EmotionCalendarDay[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const current = new Date(start);
      current.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      const date = formatLocalDate(current);
      const entry = byDate.get(date);

      week.push({
        date,
        dayOfMonth: current.getDate(),
        inMonth: date.startsWith(input.month),
        selected: date === input.selectedDate,
        emoji: entry?.emoji
      });
    }
    weeks.push(week);
  }

  return {
    month: input.month,
    selectedDate: input.selectedDate,
    weeks
  };
}

export function buildEmotionListView(input: { entries: EmotionEntry[]; month: string }): EmotionEntry[] {
  return input.entries
    .filter((entry) => entry.date.startsWith(input.month))
    .sort((left, right) => right.date.localeCompare(left.date));
}
