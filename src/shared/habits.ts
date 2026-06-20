import type { Habit, HabitRecord } from "./types";

export interface HabitDayItem {
  habit: Habit;
  date: string;
  completed: boolean;
}

export interface TodayHabitsView {
  todayDue: HabitDayItem[];
  missed: HabitDayItem[];
}

export function isHabitDateWithinPeriod(habit: Habit, date: string) {
  if (date < habit.period.startDate) {
    return false;
  }

  if (habit.period.kind === "bounded" && date > habit.period.endDate) {
    return false;
  }

  return true;
}

export function isHabitScheduledForDate(habit: Habit, date: string) {
  if (habit.archivedAt || !isHabitDateWithinPeriod(habit, date)) {
    return false;
  }

  const weekday = new Date(`${date}T12:00:00`).getDay();
  return habit.schedule.weekdays.includes(weekday);
}

export function buildTodayHabitsView(input: {
  habits: Habit[];
  records: HabitRecord[];
  today: string;
}): TodayHabitsView {
  const completed = new Set(
    input.records.filter((record) => record.status === "completed").map((record) => `${record.habitId}:${record.date}`)
  );
  const todayDue: HabitDayItem[] = [];
  const missed: HabitDayItem[] = [];

  for (const habit of input.habits) {
    if (habit.archivedAt) {
      continue;
    }

    if (isHabitScheduledForDate(habit, input.today)) {
      todayDue.push({
        habit,
        date: input.today,
        completed: completed.has(`${habit.id}:${input.today}`)
      });
    }

    let cursor = habit.period.startDate;
    while (cursor < input.today && isHabitDateWithinPeriod(habit, cursor)) {
      if (isHabitScheduledForDate(habit, cursor) && !completed.has(`${habit.id}:${cursor}`)) {
        missed.push({
          habit,
          date: cursor,
          completed: false
        });
      }
      cursor = addOneDay(cursor);
    }
  }

  missed.sort((left, right) => right.date.localeCompare(left.date));

  return { todayDue, missed };
}

function addOneDay(date: string) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}
