import { describe, expect, it } from "vitest";
import type { Template } from "../../src/shared/types";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";

describe("weeklyGithubTemplate", () => {
  it("uses the weekly template id and keeps recurrence explicit", () => {
    expect(weeklyGithubTemplate.id).toBe("weekly-github-picks");
    expect(weeklyGithubTemplate.recurrence.defaultRule).toEqual({ kind: "weekly" });
  });

  it("defines no stages, slots, or progress objects because it is task-tree driven", () => {
    const template: Template = weeklyGithubTemplate;

    expect(weeklyGithubTemplate.stages).toEqual([]);
    expect(weeklyGithubTemplate.slots).toEqual([]);
    expect(template.progressObject).toBeUndefined();
  });

  it("keeps warning rules explicit for task-tree driven weekly work", () => {
    expect(weeklyGithubTemplate.warningRules.stagnation.daysWithoutActivity).toBe(2);
    expect(weeklyGithubTemplate.warningRules.parallelLimit?.useGlobalLimit).toBe(true);
  });
});
