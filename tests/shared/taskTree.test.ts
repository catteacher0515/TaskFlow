import { describe, expect, it } from "vitest";
import {
  addTaskChild,
  transitionTask,
  type AddTaskChildInput,
  type TransitionTaskInput
} from "../../src/shared/taskTree";
import { createProjectFromTemplate } from "../../src/shared/projectFactory";
import { genericTaskTemplate } from "../../src/shared/genericTaskTemplate";

function makeProject() {
  return createProjectFromTemplate({
    id: "project-1",
    template: genericTaskTemplate,
    title: "整理播客选题",
    recurrence: { kind: "none" },
    now: "2026-06-16T08:00:00.000Z"
  });
}

function addChild(project = makeProject(), input: Partial<AddTaskChildInput> = {}) {
  return addTaskChild(project, {
    id: input.id ?? "task-1",
    parentTaskId: input.parentTaskId ?? "project-1-root",
    title: input.title ?? "收集候选选题",
    now: input.now ?? "2026-06-16T08:05:00.000Z"
  });
}

function transition(project = addChild(), input: Partial<TransitionTaskInput> = {}) {
  return transitionTask(project, {
    activityId: input.activityId ?? "activity-1",
    taskId: input.taskId ?? "task-1",
    nextStatus: input.nextStatus ?? "completed",
    now: input.now ?? "2026-06-16T08:10:00.000Z"
  });
}

describe("task tree", () => {
  it("adds child tasks under the root task", () => {
    const project = addChild();

    expect(project.taskTree?.children[0]).toMatchObject({
      id: "task-1",
      title: "收集候选选题",
      status: "not_started",
      children: []
    });
  });

  it("limits task nesting to three levels including the root task", () => {
    let project = addChild();
    project = addTaskChild(project, {
      id: "task-1-1",
      parentTaskId: "task-1",
      title: "翻收藏",
      now: "2026-06-16T08:06:00.000Z"
    });

    expect(() =>
      addTaskChild(project, {
        id: "task-1-1-1",
        parentTaskId: "task-1-1",
        title: "过度拆分",
        now: "2026-06-16T08:07:00.000Z"
      })
    ).toThrow("Task tree depth limit reached: task-1-1");
  });

  it("creates one small completion feedback for a leaf task", () => {
    const firstResult = transition();
    const repeatedResult = transition(firstResult.project, {
      activityId: "activity-2",
      taskId: "task-1",
      nextStatus: "completed",
      now: "2026-06-16T08:20:00.000Z"
    });

    expect(firstResult.activity).toMatchObject({
      id: "activity-1",
      projectId: "project-1",
      kind: "small",
      type: "task_completed",
      message: "任务完成：收集候选选题",
      taskId: "task-1"
    });
    expect(repeatedResult.activity).toBeUndefined();
  });

  it("creates one small entropy feedback when a leaf task is dropped", () => {
    const result = transition(addChild(), {
      activityId: "activity-drop",
      taskId: "task-1",
      nextStatus: "dropped",
      now: "2026-06-16T08:10:00.000Z"
    });
    const revisedResult = transition(result.project, {
      activityId: "activity-complete",
      taskId: "task-1",
      nextStatus: "completed",
      now: "2026-06-16T08:20:00.000Z"
    });

    expect(result.activity).toMatchObject({
      kind: "small",
      type: "entropy_reduced",
      message: "不做了：收集候选选题"
    });
    expect(revisedResult.activity).toBeUndefined();
  });

  it("archives unresolved descendants as unhandled when a parent task is completed early", () => {
    let project = addChild(makeProject(), {
      id: "parent-task",
      title: "实际测一轮"
    });
    project = addTaskChild(project, {
      id: "child-done",
      parentTaskId: "parent-task",
      title: "跑通 demo",
      now: "2026-06-16T08:06:00.000Z"
    });
    project = addTaskChild(project, {
      id: "child-open",
      parentTaskId: "parent-task",
      title: "看源码结构",
      now: "2026-06-16T08:07:00.000Z"
    });
    project = transitionTask(project, {
      activityId: "activity-child",
      taskId: "child-done",
      nextStatus: "completed",
      now: "2026-06-16T08:10:00.000Z"
    }).project;

    const result = transitionTask(project, {
      activityId: "activity-parent",
      taskId: "parent-task",
      nextStatus: "completed",
      now: "2026-06-16T08:20:00.000Z"
    });
    const parent = result.project.taskTree?.children[0];

    expect(result.activity).toMatchObject({
      kind: "big",
      type: "task_completed",
      message: "任务完成：实际测一轮"
    });
    expect(parent?.children.map((child) => [child.id, child.status])).toEqual([
      ["child-done", "completed"],
      ["child-open", "unhandled"]
    ]);
  });

  it("restores a closed task to not started and clears its feedback marker", () => {
    const completed = transition().project;
    const restored = transition(completed, {
      activityId: "activity-restore",
      taskId: "task-1",
      nextStatus: "not_started",
      now: "2026-06-16T08:20:00.000Z"
    }).project;
    const task = restored.taskTree?.children[0];

    expect(task).toMatchObject({
      id: "task-1",
      status: "not_started"
    });
    expect(task?.feedbackRecordedAt).toBeUndefined();
    expect(task?.feedbackStatus).toBeUndefined();
  });
});
