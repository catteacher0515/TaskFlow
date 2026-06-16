import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../../src/server/app";
import { initializeDataDir, writeSettings } from "../../src/server/storage";
import type { Template } from "../../src/shared/types";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";

const roots: string[] = [];

async function makeFixture(idValues = ["project-1", "project-2", "progress-object-1", "activity-1", "activity-2", "activity-3"]) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "taskflow-routes-"));
  roots.push(rootDir);
  await initializeDataDir(rootDir);
  await writeSettings(rootDir, {
    dataVersion: 1,
    activeProjectLimit: 1,
    defaultStagnationDays: 2
  });

  const nowValues = [
    "2026-06-16T09:00:00.000Z",
    "2026-06-16T09:01:00.000Z",
    "2026-06-16T09:02:00.000Z",
    "2026-06-16T09:03:00.000Z",
    "2026-06-16T09:04:00.000Z",
    "2026-06-16T09:05:00.000Z",
    "2026-06-16T09:06:00.000Z",
    "2026-06-16T09:07:00.000Z",
    "2026-06-16T09:08:00.000Z",
    "2026-06-16T09:09:00.000Z"
  ];
  return {
    rootDir,
    app: createApp({
      rootDir,
      now: () => nowValues.shift() ?? "2026-06-16T09:59:00.000Z",
      id: () => idValues.shift() ?? "generated-id"
    })
  };
}

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("Express API routes", () => {
  it("returns initial state with recalculated warnings", async () => {
    const { app } = await makeFixture();

    const response = await request(app).get("/api/state").expect(200);

    expect(response.body.templates.map((template: Template) => template.id)).toEqual(
      expect.arrayContaining(["generic-task", "weekly-github-picks"])
    );
    expect(response.body.projects).toEqual([]);
    expect(response.body.activity).toEqual([]);
    expect(response.body.warnings).toEqual([]);
  });

  it("creates a project from a template", async () => {
    const { app } = await makeFixture();

    const response = await request(app)
      .post("/api/projects")
      .send({
        templateId: "weekly-github-picks",
        title: "每周 GitHub 精选 2026-W25",
        recurrence: { kind: "weekly" }
      })
      .expect(201);

    expect(response.body.project.title).toBe("每周 GitHub 精选 2026-W25");
    expect(response.body.state.projects).toHaveLength(1);
    expect(response.body.state.projects[0].id).toBe("project-1");
  });

  it("returns the planned error when a project template is missing", async () => {
    const { app } = await makeFixture();

    const response = await request(app)
      .post("/api/projects")
      .send({
        templateId: "missing-template",
        title: "Missing",
        recurrence: { kind: "weekly" }
      })
      .expect(404);

    expect(response.body.error).toBe("Template not found");
  });

  it("saves a custom template and returns the updated state", async () => {
    const { app } = await makeFixture();
    const customTemplate: Template = {
      ...weeklyGithubTemplate,
      id: "custom-weekly-picks",
      name: "自定义周刊"
    };

    const response = await request(app)
      .put("/api/templates/custom-weekly-picks")
      .send(customTemplate)
      .expect(200);

    expect(response.body.templates.map((template: Template) => template.id)).toContain("custom-weekly-picks");
  });

  it("rejects a custom template whose id does not match the route", async () => {
    const { app } = await makeFixture();
    const customTemplate: Template = {
      ...weeklyGithubTemplate,
      id: "different-template-id",
      name: "自定义周刊"
    };

    const response = await request(app)
      .put("/api/templates/custom-weekly-picks")
      .send(customTemplate)
      .expect(400);

    expect(response.body.error).toBe("Template id must match route parameter");
  });

  it("adds a progress object and records small feedback on feedback state transition", async () => {
    const { app } = await makeFixture(["project-1", "progress-object-1", "activity-1"]);
    await request(app)
      .post("/api/projects")
      .send({
        templateId: "weekly-github-picks",
        title: "每周 GitHub 精选 2026-W25",
        recurrence: { kind: "weekly" }
      })
      .expect(201);

    const addResponse = await request(app)
      .post("/api/projects/project-1/progress-objects")
      .send({
        title: "openai/codex",
        fields: { repoName: "openai/codex", url: "https://github.com/openai/codex" }
      })
      .expect(200);

    expect(addResponse.body.projects[0].progressObjects[0]).toMatchObject({
      id: "progress-object-1",
      title: "openai/codex",
      stateId: "untested"
    });

    const transitionResponse = await request(app)
      .patch("/api/projects/project-1/progress-objects/progress-object-1/state")
      .send({ nextStateId: "selected", note: "值得写进本周推荐" })
      .expect(200);

    expect(transitionResponse.body.projects[0].progressObjects[0].stateId).toBe("selected");
    expect(transitionResponse.body.activity[0]).toMatchObject({
      id: "activity-1",
      kind: "small",
      projectId: "project-1",
      progressObjectId: "progress-object-1"
    });
    expect(transitionResponse.body.activity[0].message).toContain("值得写进本周推荐");
  });

  it("does not append duplicate feedback when a concluded progress object is revised", async () => {
    const { app } = await makeFixture(["project-1", "progress-object-1", "activity-1", "activity-2"]);
    await request(app)
      .post("/api/projects")
      .send({
        templateId: "weekly-github-picks",
        title: "每周 GitHub 精选 2026-W25",
        recurrence: { kind: "weekly" }
      })
      .expect(201);
    await request(app)
      .post("/api/projects/project-1/progress-objects")
      .send({ title: "openai/codex", fields: {} })
      .expect(200);
    await request(app)
      .patch("/api/projects/project-1/progress-objects/progress-object-1/state")
      .send({ nextStateId: "maybe", note: "先备选" })
      .expect(200);

    const response = await request(app)
      .patch("/api/projects/project-1/progress-objects/progress-object-1/state")
      .send({ nextStateId: "selected", note: "改为入选" })
      .expect(200);

    expect(response.body.projects[0].progressObjects[0].stateId).toBe("selected");
    expect(response.body.activity).toHaveLength(1);
    expect(response.body.activity[0]).toMatchObject({
      id: "activity-1",
      message: "候选仓库 openai/codex 进入 备选：先备选"
    });
  });

  it("adds and transitions generic task tree children", async () => {
    const { app } = await makeFixture(["project-1", "task-1", "activity-1", "activity-2"]);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "generic-task", title: "整理播客选题", recurrence: { kind: "none" } })
      .expect(201);

    const addResponse = await request(app)
      .post("/api/projects/project-1/tasks/project-1-root/children")
      .send({ title: "收集候选选题" })
      .expect(200);

    expect(addResponse.body.projects[0].taskTree.children[0]).toMatchObject({
      id: "task-1",
      title: "收集候选选题",
      status: "not_started"
    });

    const droppedResponse = await request(app)
      .patch("/api/projects/project-1/tasks/task-1/status")
      .send({ status: "dropped" })
      .expect(200);
    expect(droppedResponse.body.activity[0]).toMatchObject({
      id: "activity-1",
      kind: "small",
      type: "entropy_reduced",
      message: "不做了：收集候选选题",
      taskId: "task-1"
    });

    const revisedResponse = await request(app)
      .patch("/api/projects/project-1/tasks/task-1/status")
      .send({ status: "completed" })
      .expect(200);
    expect(revisedResponse.body.projects[0].taskTree.children[0].status).toBe("completed");
    expect(revisedResponse.body.activity).toHaveLength(1);
  });

  it("enforces focus mode mutations and completes the focus session", async () => {
    const { app } = await makeFixture();
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 1", recurrence: { kind: "weekly" } })
      .expect(201);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 2", recurrence: { kind: "weekly" } })
      .expect(201);
    await request(app).patch("/api/projects/project-1/status").send({ status: "active" }).expect(200);
    const activeState = await request(app).patch("/api/projects/project-2/status").send({ status: "active" }).expect(200);
    expect(activeState.body.warnings[0]).toMatchObject({
      type: "parallel_limit",
      severity: "blocking"
    });
    expect(activeState.body.warnings[0].projectId).toBeUndefined();

    const focusResponse = await request(app)
      .post("/api/focus/select")
      .send({ projectId: "project-1", selectedActionId: "test-one-repo" })
      .expect(200);
    expect(focusResponse.body.focusMode).toMatchObject({
      status: "active",
      selectedProjectId: "project-1",
      selectedActionId: "test-one-repo"
    });

    const blockedResponse = await request(app)
      .post("/api/projects/project-2/progress-objects")
      .send({ title: "blocked repo", fields: {} })
      .expect(409);
    expect(blockedResponse.body.error).toBe("Focus mode only allows mutations on project-1");

    const completedResponse = await request(app)
      .post("/api/focus/complete-session")
      .send({ result: "recorded" })
      .expect(200);
    expect(completedResponse.body.focusMode.session.result).toBe("recorded");
  });

  it("rejects invalid project status without persisting it", async () => {
    const { app } = await makeFixture();
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 1", recurrence: { kind: "weekly" } })
      .expect(201);

    const response = await request(app)
      .patch("/api/projects/project-1/status")
      .send({ status: "invalid-status" })
      .expect(400);

    expect(response.body.error).toBe("Invalid project status");

    const stateResponse = await request(app).get("/api/state").expect(200);
    expect(stateResponse.body.projects[0].status).toBe("not_started");
  });

  it("maps unknown progress object mutations to not found", async () => {
    const { app } = await makeFixture();
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 1", recurrence: { kind: "weekly" } })
      .expect(201);

    const response = await request(app)
      .patch("/api/projects/project-1/progress-objects/missing-object/state")
      .send({ nextStateId: "selected", note: "missing" })
      .expect(404);

    expect(response.body.error).toBe("Unknown progress object: missing-object");
  });

  it("maps duplicate focus session completion to conflict", async () => {
    const { app } = await makeFixture();
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 1", recurrence: { kind: "weekly" } })
      .expect(201);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 2", recurrence: { kind: "weekly" } })
      .expect(201);
    await request(app).patch("/api/projects/project-1/status").send({ status: "active" }).expect(200);
    await request(app).patch("/api/projects/project-2/status").send({ status: "active" }).expect(200);
    await request(app)
      .post("/api/focus/select")
      .send({ projectId: "project-1", selectedActionId: "test-one-repo" })
      .expect(200);
    await request(app).post("/api/focus/complete-session").send({ result: "recorded" }).expect(200);

    const response = await request(app)
      .post("/api/focus/complete-session")
      .send({ result: "blocked" })
      .expect(409);

    expect(response.body.error).toBe("Focus session already completed");
  });
});
