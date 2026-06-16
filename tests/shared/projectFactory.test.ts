import { describe, expect, it } from "vitest";
import { createProjectFromTemplate } from "../../src/shared/projectFactory";
import { genericTaskTemplate } from "../../src/shared/genericTaskTemplate";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";

describe("createProjectFromTemplate", () => {
  it("creates a project with a template snapshot", () => {
    const project = createProjectFromTemplate({
      id: "project-1",
      template: weeklyGithubTemplate,
      title: "每周 GitHub 精选 2026-W25",
      deadline: "2026-06-21T14:00:00.000Z",
      recurrence: { kind: "weekly" },
      now: "2026-06-15T10:00:00.000Z"
    });

    expect(project.templateId).toBe("weekly-github-picks");
    expect(project.templateSnapshot.templateName).toBe("每周 GitHub 精选");
    expect(project.stages[0]).toEqual({ id: "collect", name: "候选收集", status: "active" });
    expect(project.stages.slice(1).every((stage) => stage.status === "not_started")).toBe(true);
    expect(project.slots).toHaveLength(5);
    expect(project.progressObjects).toEqual([]);
  });

  it("does not share mutable stage arrays with the template", () => {
    const project = createProjectFromTemplate({
      id: "project-1",
      template: weeklyGithubTemplate,
      title: "每周 GitHub 精选 2026-W25",
      recurrence: { kind: "weekly" },
      now: "2026-06-15T10:00:00.000Z"
    });

    project.templateSnapshot.stages[0].name = "changed";

    expect(weeklyGithubTemplate.stages[0].name).toBe("候选收集");
  });

  it("creates a root task tree for generic task projects", () => {
    const project = createProjectFromTemplate({
      id: "project-1",
      template: genericTaskTemplate,
      title: "整理播客选题",
      recurrence: { kind: "none" },
      now: "2026-06-16T08:00:00.000Z"
    });

    expect(project.stages).toEqual([]);
    expect(project.taskTree).toEqual({
      id: "project-1-root",
      title: "整理播客选题",
      status: "not_started",
      children: [],
      createdAt: "2026-06-16T08:00:00.000Z",
      updatedAt: "2026-06-16T08:00:00.000Z"
    });
  });
});
