import { describe, expect, it } from "vitest";
import {
  buildTodayHabitsView,
  isHabitDateWithinPeriod,
  isHabitScheduledForDate
} from "../../src/shared/habits";
import type { Habit } from "../../src/shared/types";

describe("habits domain", () => {
  it("defines a weekly scheduled bounded habit shape", () => {
    const habit: Habit = {
      id: "habit-1",
      title: "看 AI HOT 日报",
      schedule: { weekdays: [1, 2, 3, 4, 5] },
      period: {
        kind: "bounded",
        startDate: "2026-06-19",
        endDate: "2026-07-19"
      },
      createdAt: "2026-06-19T10:00:00.000Z",
      updatedAt: "2026-06-19T10:00:00.000Z"
    };

    expect(habit.period.kind).toBe("bounded");
  });

  it("matches weekly schedule and bounded period", () => {
    const habit: Habit = {
      id: "habit-1",
      title: "看 AI HOT 日报",
      schedule: { weekdays: [1, 3, 5] },
      period: { kind: "bounded", startDate: "2026-06-01", endDate: "2026-06-30" },
      createdAt: "2026-06-19T10:00:00.000Z",
      updatedAt: "2026-06-19T10:00:00.000Z"
    };

    expect(isHabitDateWithinPeriod(habit, "2026-06-19")).toBe(true);
    expect(isHabitScheduledForDate(habit, "2026-06-19")).toBe(true);
    expect(isHabitScheduledForDate(habit, "2026-06-20")).toBe(false);
  });

  it("builds today and missed groups from habits and records", () => {
    const habits: Habit[] = [
      {
        id: "habit-1",
        title: "看 AI HOT 日报",
        schedule: { weekdays: [4, 5] },
        period: { kind: "bounded", startDate: "2026-06-18", endDate: "2026-06-30" },
        createdAt: "2026-06-18T10:00:00.000Z",
        updatedAt: "2026-06-18T10:00:00.000Z"
      }
    ];

    const records = [
      {
        habitId: "habit-1",
        date: "2026-06-18",
        status: "completed" as const,
        updatedAt: "2026-06-18T22:00:00.000Z"
      }
    ];

    const view = buildTodayHabitsView({
      habits,
      records,
      today: "2026-06-19"
    });

    expect(view.todayDue.map((item) => item.habit.title)).toEqual(["看 AI HOT 日报"]);
    expect(view.missed).toEqual([]);
  });
});
