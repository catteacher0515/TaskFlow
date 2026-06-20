import { describe, expect, it } from "vitest";
import { buildEmotionCalendarView, buildEmotionListView, emotionOptions } from "../../src/shared/emotions";
import type { EmotionEntry } from "../../src/shared/types";

describe("emotion options", () => {
  it("exposes the fixed lightweight emoji choice set", () => {
    expect(emotionOptions).toEqual([
      { emoji: "😭", label: "很差" },
      { emoji: "😞", label: "低落" },
      { emoji: "😐", label: "平平" },
      { emoji: "🙂", label: "还行" },
      { emoji: "😄", label: "开心" },
      { emoji: "😎", label: "很顺" },
      { emoji: "🤯", label: "爆炸" }
    ]);
  });
});

describe("emotion calendar view", () => {
  it("builds a fixed 6x7 month grid with spillover days and a single selected date", () => {
    const entries: EmotionEntry[] = [
      {
        date: "2026-06-02",
        emoji: "🙂",
        shortNote: "还在推进",
        createdAt: "2026-06-02T14:00:00.000Z",
        updatedAt: "2026-06-02T14:00:00.000Z"
      }
    ];

    const view = buildEmotionCalendarView({
      entries,
      month: "2026-06",
      selectedDate: "2026-06-02"
    });

    expect(view.weeks).toHaveLength(6);
    expect(view.weeks.every((week) => week.length === 7)).toBe(true);
    expect(view.selectedDate).toBe("2026-06-02");
    expect(view.weeks[0][0]).toMatchObject({
      date: "2026-05-31",
      dayOfMonth: 31,
      inMonth: false,
      selected: false
    });
    expect(view.weeks[0][1]).toMatchObject({
      date: "2026-06-01",
      dayOfMonth: 1,
      inMonth: true,
      selected: false
    });
    expect(view.weeks.flat().find((day) => day.date === "2026-06-02")).toMatchObject({
      date: "2026-06-02",
      inMonth: true,
      emoji: "🙂",
      selected: true
    });
    expect(view.weeks[5][6]).toMatchObject({
      date: "2026-07-11",
      dayOfMonth: 11,
      inMonth: false,
      selected: false
    });
    expect(view.weeks.flat().filter((day) => day.selected)).toEqual([
      expect.objectContaining({
        date: "2026-06-02",
        selected: true
      })
    ]);
  });

  it("formats dates from local calendar parts without relying on UTC ISO conversion", () => {
    const originalToISOString = Date.prototype.toISOString;
    Date.prototype.toISOString = function toISOString(): string {
      throw new Error("calendar view should not call toISOString");
    };

    try {
      const view = buildEmotionCalendarView({
        entries: [],
        month: "2026-06",
        selectedDate: "2026-06-15"
      });

      expect(view.weeks[0][0].date).toBe("2026-05-31");
      expect(view.weeks[2][1].date).toBe("2026-06-15");
      expect(view.weeks[5][6].date).toBe("2026-07-11");
    } finally {
      Date.prototype.toISOString = originalToISOString;
    }
  });
});

describe("emotion list view", () => {
  it("returns the current month entries in reverse date order", () => {
    const entries: EmotionEntry[] = [
      {
        date: "2026-06-02",
        emoji: "🙂",
        createdAt: "2026-06-02T14:00:00.000Z",
        updatedAt: "2026-06-02T14:00:00.000Z"
      },
      {
        date: "2026-06-12",
        emoji: "😄",
        shortNote: "终于顺了",
        createdAt: "2026-06-12T14:00:00.000Z",
        updatedAt: "2026-06-12T14:00:00.000Z"
      },
      {
        date: "2026-05-28",
        emoji: "😞",
        createdAt: "2026-05-28T14:00:00.000Z",
        updatedAt: "2026-05-28T14:00:00.000Z"
      }
    ];

    expect(buildEmotionListView({ entries, month: "2026-06" }).map((entry) => entry.date)).toEqual([
      "2026-06-12",
      "2026-06-02"
    ]);
  });
});
