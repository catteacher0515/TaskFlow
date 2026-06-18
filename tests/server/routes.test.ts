import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../../src/server/app";
import { dataDir, initializeDataDir, writeSettings } from "../../src/server/storage";
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

  it("serves the built client index when a static client bundle is present", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "taskflow-static-"));
    roots.push(rootDir);
    const clientDir = path.join(rootDir, "dist", "client");
    await initializeDataDir(rootDir);
    await mkdir(clientDir, { recursive: true });
    await writeFile(path.join(clientDir, "index.html"), "<!doctype html><html><body>TaskFlow Deploy</body></html>", "utf8");

    const app = createApp({
      rootDir,
      now: () => "2026-06-16T09:00:00.000Z",
      id: () => "generated-id"
    });

    const response = await request(app).get("/").expect(200);

    expect(response.text).toContain("TaskFlow Deploy");
    expect(response.headers["content-type"]).toContain("text/html");
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

  it("creates a weekly GitHub project with a prebuilt task tree", async () => {
    const { app } = await makeFixture(["project-1"]);
    await request(app)
      .post("/api/projects")
      .send({
        templateId: "weekly-github-picks",
        title: "每周 GitHub 精选 2026-W25",
        recurrence: { kind: "weekly" }
      })
      .expect(201);

    const stateResponse = await request(app).get("/api/state").expect(200);

    expect(stateResponse.body.projects[0].stages).toEqual([]);
    expect(stateResponse.body.projects[0].progressObjects).toEqual([]);
    expect(stateResponse.body.projects[0].slots).toEqual([]);
    expect(stateResponse.body.projects[0].taskTree.children.map((task: { title: string }) => task.title)).toEqual([
      "亲测候选仓库",
      "确定本周 5 个推荐",
      "成稿",
      "发布"
    ]);
    expect(stateResponse.body.projects[0].taskTree.children[1].children).toEqual([]);
    expect(stateResponse.body.projects[0].taskTree.children[3].children.map((task: { title: string }) => task.title)).toEqual([
      "抖音",
      "知乎",
      "B站",
      "小红书",
      "编程导航",
      "稀土掘金"
    ]);
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

  it("revokes task feedback when a closed task is restored to not started", async () => {
    const { app } = await makeFixture(["project-1", "task-1", "activity-1", "activity-revoke"]);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "generic-task", title: "整理播客选题", recurrence: { kind: "none" } })
      .expect(201);
    await request(app)
      .post("/api/projects/project-1/tasks/project-1-root/children")
      .send({ title: "收集候选选题" })
      .expect(200);
    await request(app)
      .patch("/api/projects/project-1/tasks/task-1/status")
      .send({ status: "completed" })
      .expect(200);

    const restoredResponse = await request(app)
      .patch("/api/projects/project-1/tasks/task-1/status")
      .send({ status: "not_started" })
      .expect(200);

    expect(restoredResponse.body.projects[0].taskTree.children[0]).toMatchObject({
      id: "task-1",
      status: "not_started"
    });
    expect(restoredResponse.body.activity).toEqual([]);
  });

  it("revokes a feedback item manually without deleting the underlying log entry", async () => {
    const { app, rootDir } = await makeFixture(["project-1", "task-1", "activity-1", "activity-revoke"]);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "generic-task", title: "整理播客选题", recurrence: { kind: "none" } })
      .expect(201);
    await request(app)
      .post("/api/projects/project-1/tasks/project-1-root/children")
      .send({ title: "收集候选选题" })
      .expect(200);
    await request(app)
      .patch("/api/projects/project-1/tasks/task-1/status")
      .send({ status: "completed" })
      .expect(200);

    const revokeResponse = await request(app)
      .post("/api/activity/activity-1/revoke")
      .send({})
      .expect(200);

    expect(revokeResponse.body.activity).toEqual([]);
    const rawLog = await readFile(path.join(dataDir(rootDir), "activity-log.jsonl"), "utf8");
    expect(rawLog).toContain('"id":"activity-1"');
    expect(rawLog).toContain('"id":"activity-revoke"');
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

  it("exits focus mode on request", async () => {
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

    const response = await request(app)
      .post("/api/focus/exit")
      .send({})
      .expect(200);

    expect(response.body.focusMode).toEqual({ status: "inactive" });
  });

  it("blocks creating a new project until one active project is selected after parallel limit is exceeded", async () => {
    const { app } = await makeFixture(["project-1", "project-2", "project-3"]);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 1", recurrence: { kind: "weekly" } })
      .expect(201);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 2", recurrence: { kind: "weekly" } })
      .expect(201);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 3", recurrence: { kind: "weekly" } })
      .expect(201);
    await request(app).patch("/api/projects/project-1/status").send({ status: "active" }).expect(200);
    await request(app).patch("/api/projects/project-2/status").send({ status: "active" }).expect(200);

    const blockedResponse = await request(app)
      .post("/api/projects")
      .send({ templateId: "generic-task", title: "Blocked project", recurrence: { kind: "none" } })
      .expect(409);

    expect(blockedResponse.body.error).toBe("Parallel limit requires selecting one focus project first");
  });

  it("blocks project mutations until one active project is selected after parallel limit is exceeded", async () => {
    const { app } = await makeFixture(["project-1", "project-2", "project-3", "task-1"]);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "generic-task", title: "Project 1", recurrence: { kind: "none" } })
      .expect(201);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "generic-task", title: "Project 2", recurrence: { kind: "none" } })
      .expect(201);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "generic-task", title: "Project 3", recurrence: { kind: "none" } })
      .expect(201);
    await request(app).patch("/api/projects/project-1/status").send({ status: "active" }).expect(200);
    await request(app).patch("/api/projects/project-2/status").send({ status: "active" }).expect(200);

    const blockedResponse = await request(app)
      .post("/api/projects/project-1/tasks/project-1-root/children")
      .send({ title: "blocked task" })
      .expect(409);

    expect(blockedResponse.body.error).toBe("Parallel limit requires selecting one focus project first");

    await request(app)
      .post("/api/focus/select")
      .send({ projectId: "project-1", selectedActionId: "test-one-repo" })
      .expect(200);

    await request(app)
      .post("/api/projects/project-1/tasks/project-1-root/children")
      .send({ title: "allowed task" })
      .expect(200);
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

  it("reopens a completed project to the status it had before completion", async () => {
    const { app } = await makeFixture();
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 1", recurrence: { kind: "weekly" } })
      .expect(201);
    await request(app).patch("/api/projects/project-1/status").send({ status: "active" }).expect(200);

    const completedResponse = await request(app)
      .patch("/api/projects/project-1/status")
      .send({ status: "completed" })
      .expect(200);
    expect(completedResponse.body.projects[0]).toMatchObject({
      status: "completed",
      completedFromStatus: "active"
    });

    const reopenedResponse = await request(app)
      .post("/api/projects/project-1/reopen")
      .send({})
      .expect(200);

    expect(reopenedResponse.body.projects[0].status).toBe("active");
    expect(reopenedResponse.body.projects[0].completedFromStatus).toBeUndefined();
  });

  it("reopens an abandoned project to the status it had before abandonment", async () => {
    const { app } = await makeFixture();
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 1", recurrence: { kind: "weekly" } })
      .expect(201);
    await request(app).patch("/api/projects/project-1/status").send({ status: "active" }).expect(200);

    const abandonedResponse = await request(app)
      .patch("/api/projects/project-1/status")
      .send({ status: "abandoned" })
      .expect(200);
    expect(abandonedResponse.body.projects[0]).toMatchObject({
      status: "abandoned",
      completedFromStatus: "active"
    });

    const reopenedResponse = await request(app)
      .post("/api/projects/project-1/reopen")
      .send({})
      .expect(200);

    expect(reopenedResponse.body.projects[0].status).toBe("active");
    expect(reopenedResponse.body.projects[0].completedFromStatus).toBeUndefined();
  });

  it("auto exits focus mode when the selected project is completed", async () => {
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

    const response = await request(app)
      .patch("/api/projects/project-1/status")
      .send({ status: "completed" })
      .expect(200);

    expect(response.body.projects[0].status).toBe("completed");
    expect(response.body.focusMode).toEqual({ status: "inactive" });
  });

  it("hides a project without deleting it and auto exits focus mode when the selected project is hidden", async () => {
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

    const response = await request(app)
      .post("/api/projects/project-1/hide")
      .send({})
      .expect(200);

    expect(response.body.projects.find((project: { id: string }) => project.id === "project-1")).toMatchObject({
      hiddenAt: expect.any(String)
    });
    expect(response.body.focusMode).toEqual({ status: "inactive" });
  });

  it("rejects progress object mutations for task-tree driven weekly projects", async () => {
    const { app } = await makeFixture();
    await request(app)
      .post("/api/projects")
      .send({ templateId: "weekly-github-picks", title: "Project 1", recurrence: { kind: "weekly" } })
      .expect(201);

    const response = await request(app)
      .patch("/api/projects/project-1/progress-objects/missing-object/state")
      .send({ nextStateId: "selected", note: "missing" })
      .expect(400);

    expect(response.body.error).toBe("Project template does not define progress objects");
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
