import { describe, expect, it } from "vitest";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";

describe("weeklyGithubTemplate", () => {
  it("defines candidate repository states as template-local states", () => {
    expect(weeklyGithubTemplate.id).toBe("weekly-github-picks");
    expect(weeklyGithubTemplate.progressObject.name).toBe("候选仓库");
    expect(weeklyGithubTemplate.progressObject.states.map((state) => state.id)).toEqual([
      "untested",
      "testing",
      "selected",
      "maybe",
      "rejected"
    ]);
    expect(weeklyGithubTemplate.progressObject.feedbackStateIds).toEqual([
      "selected",
      "maybe",
      "rejected"
    ]);
  });

  it("defines five recommendation slots and six stages", () => {
    expect(weeklyGithubTemplate.slots).toHaveLength(5);
    expect(weeklyGithubTemplate.stages.map((stage) => stage.name)).toEqual([
      "候选收集",
      "亲测",
      "推荐选择",
      "推荐理由写作",
      "成稿",
      "发布"
    ]);
  });

  it("keeps recurrence and warning rules explicit", () => {
    expect(weeklyGithubTemplate.recurrence.defaultRule).toEqual({ kind: "weekly" });
    expect(weeklyGithubTemplate.warningRules.deadlineRisk.daysBeforeDeadline).toBe(2);
    expect(weeklyGithubTemplate.warningRules.stagnation.daysWithoutActivity).toBe(2);
  });
});
