import { describe, expect, it } from "vitest";
import { reopenProject, setProjectStatus } from "../../src/shared/projectStatus";
import { createProjectFromTemplate } from "../../src/shared/projectFactory";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";

function makeProject() {
  return createProjectFromTemplate({
    id: "project-1",
    template: weeklyGithubTemplate,
    title: "每周 GitHub 精选 2026-W25",
    recurrence: { kind: "weekly" },
    now: "2026-06-16T08:00:00.000Z"
  });
}

describe("project status", () => {
  it("remembers the previous status when completing a project", () => {
    const active = setProjectStatus(makeProject(), "active", "2026-06-16T08:05:00.000Z");
    const completed = setProjectStatus(active, "completed", "2026-06-16T08:10:00.000Z");

    expect(completed.status).toBe("completed");
    expect(completed.completedFromStatus).toBe("active");
  });

  it("reopens a completed project to its previous status", () => {
    const active = setProjectStatus(makeProject(), "active", "2026-06-16T08:05:00.000Z");
    const completed = setProjectStatus(active, "completed", "2026-06-16T08:10:00.000Z");
    const reopened = reopenProject(completed, "2026-06-16T08:15:00.000Z");

    expect(reopened.status).toBe("active");
    expect(reopened.completedFromStatus).toBeUndefined();
    expect(reopened.updatedAt).toBe("2026-06-16T08:15:00.000Z");
  });

  it("does not reopen a project that is not completed", () => {
    expect(() => reopenProject(makeProject(), "2026-06-16T08:15:00.000Z")).toThrow(
      "Project is not completed: project-1"
    );
  });
});
