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
    expect(project.stages).toEqual([]);
    expect(project.slots).toEqual([]);
    expect(project.progressObjects).toEqual([]);
    expect(project.taskTree?.children.map((task) => task.title)).toEqual([
      "亲测候选仓库",
      "确定本周 5 个推荐",
      "成稿",
      "发布"
    ]);
    expect(project.taskTree?.children[1]?.children).toEqual([]);
    expect(project.taskTree?.children[3]?.children.map((task) => task.title)).toEqual([
      "抖音",
      "知乎",
      "B站",
      "小红书",
      "编程导航",
      "稀土掘金"
    ]);
  });

  it("does not share mutable task metadata arrays with the template", () => {
    const project = createProjectFromTemplate({
      id: "project-1",
      template: weeklyGithubTemplate,
      title: "每周 GitHub 精选 2026-W25",
      recurrence: { kind: "weekly" },
      now: "2026-06-15T10:00:00.000Z"
    });

    project.templateSnapshot.minimumActions[0].label = "changed";

    expect(weeklyGithubTemplate.minimumActions[0].label).toBe("处理 1 个候选仓库");
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
