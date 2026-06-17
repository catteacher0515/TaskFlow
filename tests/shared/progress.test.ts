import { describe, expect, it } from "vitest";
import { addProgressObject, advanceStage, fillSlot, transitionProgressObject } from "../../src/shared/progress";
import { createProjectFromTemplate } from "../../src/shared/projectFactory";
import type { Template } from "../../src/shared/types";

const progressTemplate: Template = {
  id: "weekly-github-picks-legacy-progress",
  name: "每周 GitHub 精选",
  description: "用于验证旧的阶段/槽位/推进对象进度流。",
  stages: [
    { id: "collect", name: "候选收集" },
    { id: "hands_on", name: "亲测候选" },
    { id: "select", name: "选择推荐" },
    { id: "write_reasons", name: "撰写理由" },
    { id: "draft", name: "成稿" },
    { id: "publish", name: "发布" }
  ],
  progressObject: {
    name: "候选仓库",
    fields: ["url"],
    states: [
      { id: "untested", name: "待测试", category: "open" },
      { id: "testing", name: "测试中", category: "in_progress" },
      { id: "maybe", name: "备选", category: "concluded" },
      { id: "selected", name: "已选中", category: "concluded" },
      { id: "rejected", name: "淘汰", category: "concluded" }
    ],
    feedbackStateIds: ["maybe", "selected", "rejected"]
  },
  slots: Array.from({ length: 5 }, (_, index) => ({
    id: `recommendation-${index + 1}`,
    name: `推荐 ${index + 1}`
  })),
  minimumActions: [
    { id: "test-one-repo", label: "亲测 1 个候选仓库" },
    { id: "confirm-one-pick", label: "确认 1 个推荐位" }
  ],
  recurrence: {
    supportedRules: ["none", "weekly"],
    defaultRule: { kind: "weekly" }
  },
  warningRules: {
    stagnation: { daysWithoutActivity: 2 }
  }
};

function makeProject() {
  return createProjectFromTemplate({
    id: "project-1",
    template: progressTemplate,
    title: "每周 GitHub 精选 2026-W25",
    recurrence: { kind: "weekly" },
    now: "2026-06-15T10:00:00.000Z"
  });
}

describe("progress updates", () => {
  it("adds a progress object using template-local initial state", () => {
    const project = makeProject();
    const updated = addProgressObject(project, {
      id: "repo-1",
      title: "owner/repo",
      fields: { url: "https://github.com/owner/repo" },
      now: "2026-06-15T10:05:00.000Z"
    });

    expect(updated.progressObjects[0].stateId).toBe("untested");
    expect(updated.progressObjects[0].fields.url).toBe("https://github.com/owner/repo");
  });

  it("copies progress object fields so callers cannot mutate project state", () => {
    const fields = { url: "https://github.com/owner/repo" };
    const updated = addProgressObject(makeProject(), {
      id: "repo-1",
      title: "owner/repo",
      fields,
      now: "2026-06-15T10:05:00.000Z"
    });

    fields.url = "https://github.com/other/repo";

    expect(updated.progressObjects[0].fields.url).toBe("https://github.com/owner/repo");
  });

  it("creates small feedback when a progress object has an empty title", () => {
    const project = addProgressObject(makeProject(), {
      id: "repo-1",
      title: "",
      fields: {},
      now: "2026-06-15T10:05:00.000Z"
    });

    const result = transitionProgressObject(project, {
      activityId: "activity-1",
      progressObjectId: "repo-1",
      nextStateId: "rejected",
      note: "安装失败，无法推荐",
      now: "2026-06-15T10:10:00.000Z"
    });

    expect(result.activity?.message).toBe("候选仓库  进入 淘汰：安装失败，无法推荐");
  });

  it("creates small feedback when a progress object reaches a feedback state", () => {
    const project = addProgressObject(makeProject(), {
      id: "repo-1",
      title: "owner/repo",
      fields: {},
      now: "2026-06-15T10:05:00.000Z"
    });

    const result = transitionProgressObject(project, {
      activityId: "activity-1",
      progressObjectId: "repo-1",
      nextStateId: "rejected",
      note: "安装失败，无法推荐",
      now: "2026-06-15T10:10:00.000Z"
    });

    expect(result.project.progressObjects[0].stateId).toBe("rejected");
    expect(result.activity).toEqual({
      id: "activity-1",
      projectId: "project-1",
      kind: "small",
      message: "候选仓库 owner/repo 进入 淘汰：安装失败，无法推荐",
      progressObjectId: "repo-1",
      createdAt: "2026-06-15T10:10:00.000Z"
    });
  });

  it("only creates one small feedback for a progress object even when its concluded state changes", () => {
    const project = addProgressObject(makeProject(), {
      id: "repo-1",
      title: "owner/repo",
      fields: {},
      now: "2026-06-15T10:05:00.000Z"
    });

    const firstResult = transitionProgressObject(project, {
      activityId: "activity-1",
      progressObjectId: "repo-1",
      nextStateId: "maybe",
      note: "可以作为备选",
      now: "2026-06-15T10:10:00.000Z"
    });
    const revisedResult = transitionProgressObject(firstResult.project, {
      activityId: "activity-2",
      progressObjectId: "repo-1",
      nextStateId: "selected",
      note: "后来确认可以入选",
      now: "2026-06-15T10:20:00.000Z"
    });

    expect(firstResult.activity?.message).toBe("候选仓库 owner/repo 进入 备选：可以作为备选");
    expect(revisedResult.project.progressObjects[0].stateId).toBe("selected");
    expect(revisedResult.activity).toBeUndefined();
  });

  it("does not change project state or create feedback when a progress object is transitioned to its current state", () => {
    const project = addProgressObject(makeProject(), {
      id: "repo-1",
      title: "owner/repo",
      fields: {},
      now: "2026-06-15T10:05:00.000Z"
    });

    const firstResult = transitionProgressObject(project, {
      activityId: "activity-1",
      progressObjectId: "repo-1",
      nextStateId: "rejected",
      note: "无法推荐",
      now: "2026-06-15T10:10:00.000Z"
    });
    const repeatedResult = transitionProgressObject(firstResult.project, {
      activityId: "activity-2",
      progressObjectId: "repo-1",
      nextStateId: "rejected",
      note: "重复点击",
      now: "2026-06-15T10:20:00.000Z"
    });

    expect(repeatedResult.activity).toBeUndefined();
    expect(repeatedResult.project.progressObjects[0]).toEqual(firstResult.project.progressObjects[0]);
    expect(repeatedResult.project.updatedAt).toBe(firstResult.project.updatedAt);
  });

  it("creates big feedback when filling a slot", () => {
    const project = addProgressObject(makeProject(), {
      id: "repo-1",
      title: "owner/repo",
      fields: {},
      now: "2026-06-15T10:05:00.000Z"
    });

    const result = fillSlot(project, {
      activityId: "activity-2",
      slotId: "recommendation-1",
      progressObjectId: "repo-1",
      now: "2026-06-15T10:20:00.000Z"
    });

    expect(result.project.slots[0].progressObjectId).toBe("repo-1");
    expect(result.activity.kind).toBe("big");
    expect(result.activity.message).toBe("推荐 1 已填入 owner/repo，槽位进度 1 / 5");
  });

  it("does not overwrite a filled slot", () => {
    const projectWithFirstRepo = addProgressObject(makeProject(), {
      id: "repo-1",
      title: "owner/repo",
      fields: {},
      now: "2026-06-15T10:05:00.000Z"
    });
    const projectWithSecondRepo = addProgressObject(projectWithFirstRepo, {
      id: "repo-2",
      title: "owner/other",
      fields: {},
      now: "2026-06-15T10:06:00.000Z"
    });
    const filled = fillSlot(projectWithSecondRepo, {
      activityId: "activity-2",
      slotId: "recommendation-1",
      progressObjectId: "repo-1",
      now: "2026-06-15T10:20:00.000Z"
    }).project;

    expect(() =>
      fillSlot(filled, {
        activityId: "activity-3",
        slotId: "recommendation-1",
        progressObjectId: "repo-2",
        now: "2026-06-15T10:25:00.000Z"
      })
    ).toThrow("Slot already filled: recommendation-1");
  });

  it("fills a slot with an empty name", () => {
    const baseProject = makeProject();
    const project = addProgressObject(
      {
        ...baseProject,
        slots: baseProject.slots.map((slot, index) => (index === 0 ? { ...slot, name: "" } : slot))
      },
      {
        id: "repo-1",
        title: "owner/repo",
        fields: {},
        now: "2026-06-15T10:05:00.000Z"
      }
    );

    const result = fillSlot(project, {
      activityId: "activity-2",
      slotId: "recommendation-1",
      progressObjectId: "repo-1",
      now: "2026-06-15T10:20:00.000Z"
    });

    expect(result.project.slots[0].progressObjectId).toBe("repo-1");
    expect(result.activity.message).toBe(" 已填入 owner/repo，槽位进度 1 / 5");
  });

  it("creates big feedback when advancing a stage", () => {
    const result = advanceStage(makeProject(), {
      activityId: "activity-3",
      completedStageId: "collect",
      nextStageId: "hands_on",
      now: "2026-06-15T10:30:00.000Z"
    });

    expect(result.project.stages[0].status).toBe("completed");
    expect(result.project.stages[1].status).toBe("active");
    expect(result.activity.message).toBe("阶段完成：候选收集");
  });

  it("completes the final stage without activating a next stage", () => {
    let project = makeProject();
    project = advanceStage(project, {
      activityId: "activity-collect",
      completedStageId: "collect",
      nextStageId: "hands_on",
      now: "2026-06-15T10:30:00.000Z"
    }).project;
    project = advanceStage(project, {
      activityId: "activity-hands-on",
      completedStageId: "hands_on",
      nextStageId: "select",
      now: "2026-06-15T10:40:00.000Z"
    }).project;
    project = advanceStage(project, {
      activityId: "activity-select",
      completedStageId: "select",
      nextStageId: "write_reasons",
      now: "2026-06-15T10:50:00.000Z"
    }).project;
    project = advanceStage(project, {
      activityId: "activity-write-reasons",
      completedStageId: "write_reasons",
      nextStageId: "draft",
      now: "2026-06-15T11:00:00.000Z"
    }).project;
    project = advanceStage(project, {
      activityId: "activity-draft",
      completedStageId: "draft",
      nextStageId: "publish",
      now: "2026-06-15T11:10:00.000Z"
    }).project;

    const result = advanceStage(project, {
      activityId: "activity-publish",
      completedStageId: "publish",
      now: "2026-06-15T11:20:00.000Z"
    });

    expect(result.project.stages[5].status).toBe("completed");
    expect(result.project.stages.some((stage) => stage.status === "active")).toBe(false);
    expect(result.activity.message).toBe("阶段完成：发布");
  });

  it("does not advance a non-active stage", () => {
    expect(() =>
      advanceStage(makeProject(), {
        activityId: "activity-3",
        completedStageId: "hands_on",
        nextStageId: "select",
        now: "2026-06-15T10:30:00.000Z"
      })
    ).toThrow("Stage is not active: hands_on");
  });

  it("does not advance without a next stage", () => {
    expect(() =>
      advanceStage(makeProject(), {
        activityId: "activity-3",
        completedStageId: "collect",
        now: "2026-06-15T10:30:00.000Z"
      })
    ).toThrow("Next stage is required");
  });

  it("does not advance to an unknown next stage", () => {
    expect(() =>
      advanceStage(makeProject(), {
        activityId: "activity-3",
        completedStageId: "collect",
        nextStageId: "missing",
        now: "2026-06-15T10:30:00.000Z"
      })
    ).toThrow("Unknown next stage: missing");
  });

  it("does not skip stages when advancing", () => {
    expect(() =>
      advanceStage(makeProject(), {
        activityId: "activity-3",
        completedStageId: "collect",
        nextStageId: "select",
        now: "2026-06-15T10:30:00.000Z"
      })
    ).toThrow("Next stage must follow completed stage: collect -> select");
  });

  it("does not reactivate an already completed next stage", () => {
    const project = makeProject();
    const inconsistentProject = {
      ...project,
      stages: project.stages.map((stage) => {
        if (stage.id === "hands_on") {
          return { ...stage, status: "completed" as const };
        }

        return stage;
      })
    };

    expect(() =>
      advanceStage(inconsistentProject, {
        activityId: "activity-3",
        completedStageId: "collect",
        nextStageId: "hands_on",
        now: "2026-06-15T10:30:00.000Z"
      })
    ).toThrow("Next stage is not ready: hands_on");
  });
});
