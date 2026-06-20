import { describe, expect, it } from "vitest";
import { emotionOptions } from "../../src/shared/emotions";

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
