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
    expect(response.body.habits).toEqual([]);
    expect(response.body.habitRecords).toEqual([]);
    expect(response.body.activity).toEqual([]);
    expect(response.body.warnings).toEqual([]);
  });

  it("returns habits and habitRecords from api state", async () => {
    const { app, rootDir } = await makeFixture();
    const rootDataDir = dataDir(rootDir);

    await writeFile(
      path.join(rootDataDir, "habits.json"),
      JSON.stringify(
        [
          {
            id: "habit-1",
            title: "看 AI HOT 日报",
            schedule: { weekdays: [1, 2, 3, 4, 5] },
            period: { kind: "bounded", startDate: "2026-06-19", endDate: "2026-07-19" },
            createdAt: "2026-06-19T10:00:00.000Z",
            updatedAt: "2026-06-19T10:00:00.000Z"
          }
        ],
        null,
        2
      ),
      "utf8"
    );

    await writeFile(
      path.join(rootDataDir, "habit-records.json"),
      JSON.stringify(
        [
          {
            habitId: "habit-1",
            date: "2026-06-19",
            status: "completed",
            updatedAt: "2026-06-19T21:00:00.000Z"
          }
        ],
        null,
        2
      ),
      "utf8"
    );

    const response = await request(app).get("/api/state").expect(200);

    expect(response.body.habits).toHaveLength(1);
    expect(response.body.habitRecords).toHaveLength(1);
  });

  it("returns emotion entries from api state", async () => {
    const { app, rootDir } = await makeFixture();
    const rootDataDir = dataDir(rootDir);

    await writeFile(
      path.join(rootDataDir, "emotion-entries.json"),
      JSON.stringify(
        [
          {
            date: "2026-06-20",
            emoji: "😄",
            shortNote: "今天顺了",
            detail: "下午明显轻松很多",
            createdAt: "2026-06-20T12:00:00.000Z",
            updatedAt: "2026-06-20T12:00:00.000Z"
          }
        ],
        null,
        2
      ),
      "utf8"
    );

    const response = await request(app).get("/api/state").expect(200);

    expect(response.body.emotionEntries).toHaveLength(1);
  });

  it("creates a habit", async () => {
    const { app } = await makeFixture(["habit-1"]);

    const response = await request(app)
      .post("/api/habits")
      .send({
        title: "看 AI HOT 日报",
        schedule: { weekdays: [1, 2, 3, 4, 5] },
        period: { kind: "bounded", startDate: "2026-06-19", endDate: "2026-07-19" }
      })
      .expect(200);

    expect(response.body.habits[0].title).toBe("看 AI HOT 日报");
  });

  it("marks a habit date as completed", async () => {
    const { app } = await makeFixture(["habit-1"]);
    await request(app)
      .post("/api/habits")
      .send({
        title: "看 AI HOT 日报",
        schedule: { weekdays: [1, 2, 3, 4, 5] },
        period: { kind: "bounded", startDate: "2026-06-19", endDate: "2026-07-19" }
      })
      .expect(200);

    const response = await request(app)
      .put("/api/habits/habit-1/records/2026-06-19")
      .send({ status: "completed" })
      .expect(200);

    expect(response.body.habitRecords).toContainEqual(
      expect.objectContaining({ habitId: "habit-1", date: "2026-06-19", status: "completed" })
    );
  });

  it("archives a habit", async () => {
    const { app } = await makeFixture(["habit-1"]);
    await request(app)
      .post("/api/habits")
      .send({
        title: "爬坡",
        schedule: { weekdays: [0, 6] },
        period: { kind: "ongoing", startDate: "2026-06-19" }
      })
      .expect(200);

    const response = await request(app)
      .post("/api/habits/habit-1/archive")
      .expect(200);

    expect(response.body.habits[0].archivedAt).toBeTruthy();
  });

  it("updates a habit", async () => {
    const { app } = await makeFixture(["habit-1"]);
    await request(app)
      .post("/api/habits")
      .send({
        title: "看 AI HOT 日报",
        schedule: { weekdays: [1, 2, 3, 4, 5] },
        period: { kind: "bounded", startDate: "2026-06-19", endDate: "2026-07-19" }
      })
      .expect(200);

    const response = await request(app)
      .patch("/api/habits/habit-1")
      .send({
        title: "看 AI HOT + Hacker News",
        schedule: { weekdays: [1, 3, 5] },
        period: { kind: "ongoing", startDate: "2026-06-20" }
      })
      .expect(200);

    expect(response.body.habits).toContainEqual(
      expect.objectContaining({
        id: "habit-1",
        title: "看 AI HOT + Hacker News",
        schedule: { weekdays: [1, 3, 5] },
        period: { kind: "ongoing", startDate: "2026-06-20" }
      })
    );
  });

  it("creates an emotion entry for an unrecorded date", async () => {
    const { app } = await makeFixture();

    const response = await request(app)
      .put("/api/emotions/2026-06-20")
      .send({
        emoji: "🙂",
        shortNote: "状态稳住了",
        detail: "虽然还没完全解决，但没有昨天慌"
      })
      .expect(200);

    expect(response.body.emotionEntries).toContainEqual(
      expect.objectContaining({
        date: "2026-06-20",
        emoji: "🙂",
        shortNote: "状态稳住了",
        detail: "虽然还没完全解决，但没有昨天慌"
      })
    );
  });

  it("updates an existing emotion entry instead of creating a second one", async () => {
    const { app } = await makeFixture();
    await request(app)
      .put("/api/emotions/2026-06-20")
      .send({
        emoji: "😞",
        shortNote: "早上很卡",
        detail: ""
      })
      .expect(200);

    const response = await request(app)
      .put("/api/emotions/2026-06-20")
      .send({
        emoji: "😄",
        shortNote: "晚上缓过来了",
        detail: "最后还是有收尾"
      })
      .expect(200);

    expect(response.body.emotionEntries).toHaveLength(1);
    expect(response.body.emotionEntries[0]).toMatchObject({
      date: "2026-06-20",
      emoji: "😄",
      shortNote: "晚上缓过来了",
      detail: "最后还是有收尾"
    });
  });

  it("accepts a leap-day emotion entry on 2024-02-29", async () => {
    const { app } = await makeFixture();

    const response = await request(app)
      .put("/api/emotions/2024-02-29")
      .send({
        emoji: "😄",
        shortNote: "今天顺了",
        detail: "闰日也要记一下"
      })
      .expect(200);

    expect(response.body.emotionEntries).toContainEqual(
      expect.objectContaining({
        date: "2024-02-29",
        emoji: "😄",
        shortNote: "今天顺了",
        detail: "闰日也要记一下"
      })
    );
  });

  it("accepts a low-year emotion entry on 0001-01-01", async () => {
    const { app } = await makeFixture();

    const response = await request(app)
      .put("/api/emotions/0001-01-01")
      .send({
        emoji: "🙂",
        shortNote: "低年份测试",
        detail: "确保不会被错误拒绝"
      })
      .expect(200);

    expect(response.body.emotionEntries).toContainEqual(
      expect.objectContaining({
        date: "0001-01-01",
        emoji: "🙂",
        shortNote: "低年份测试",
        detail: "确保不会被错误拒绝"
      })
    );
  });

  it("keeps an emotion entry when shortNote and detail are cleared to empty", async () => {
    const { app } = await makeFixture();
    await request(app)
      .put("/api/emotions/2026-06-20")
      .send({
        emoji: "😄",
        shortNote: "晚上缓过来了",
        detail: "最后还是有收尾"
      })
      .expect(200);

    const response = await request(app)
      .put("/api/emotions/2026-06-20")
      .send({
        emoji: "🙂",
        shortNote: "   ",
        detail: ""
      })
      .expect(200);

    expect(response.body.emotionEntries).toHaveLength(1);
    expect(response.body.emotionEntries[0]).toMatchObject({
      date: "2026-06-20",
      emoji: "🙂"
    });
    expect(response.body.emotionEntries[0].shortNote).toBeUndefined();
    expect(response.body.emotionEntries[0].detail).toBeUndefined();
  });

  it("rejects an emotion entry with an invalid date format", async () => {
    const { app } = await makeFixture();

    const response = await request(app)
      .put("/api/emotions/2026-6-20")
      .send({
        emoji: "🙂",
        shortNote: "状态稳住了",
        detail: "今天比昨天好一点"
      })
      .expect(400);

    expect(response.body.error).toBe("Emotion date must use YYYY-MM-DD format");
  });

  it("rejects an emotion entry with a non-existent calendar date", async () => {
    const { app } = await makeFixture();

    const response = await request(app)
      .put("/api/emotions/2026-02-31")
      .send({
        emoji: "🙂",
        shortNote: "状态稳住了",
        detail: "今天比昨天好一点"
      })
      .expect(400);

    expect(response.body.error).toBe("Emotion date must be a real calendar date");
  });

  it("rejects an emotion entry with an invalid emoji", async () => {
    const { app } = await makeFixture();

    const response = await request(app)
      .put("/api/emotions/2026-06-20")
      .send({
        emoji: "😀",
        shortNote: "状态稳住了",
        detail: "今天比昨天好一点"
      })
      .expect(400);

    expect(response.body.error).toBe("Emotion emoji is invalid");
  });

  it("rejects an emotion entry when shortNote is not a string", async () => {
    const { app } = await makeFixture();

    const response = await request(app)
      .put("/api/emotions/2026-06-20")
      .send({
        emoji: "🙂",
        shortNote: 123,
        detail: "今天比昨天好一点"
      })
      .expect(400);

    expect(response.body.error).toBe("Emotion note fields must be strings when provided");
  });

  it("rejects an emotion entry when detail is not a string", async () => {
    const { app } = await makeFixture();

    const response = await request(app)
      .put("/api/emotions/2026-06-20")
      .send({
        emoji: "🙂",
        shortNote: "状态稳住了",
        detail: { text: "今天比昨天好一点" }
      })
      .expect(400);

    expect(response.body.error).toBe("Emotion note fields must be strings when provided");
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

  it("renames a project and persists the updated title", async () => {
    const { app, rootDir } = await makeFixture(["project-1"]);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "generic-task", title: "抖音视频发布字段填写", recurrence: { kind: "none" } })
      .expect(201);

    const response = await request(app)
      .patch("/api/projects/project-1/title")
      .send({ title: "发布平台视频字段统计" })
      .expect(200);

    expect(response.body.projects[0].title).toBe("发布平台视频字段统计");

    const storedProject = JSON.parse(
      await readFile(path.join(dataDir(rootDir), "projects", "project-1.json"), "utf8")
    ) as { title: string };
    expect(storedProject.title).toBe("发布平台视频字段统计");
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

  it("renames and deletes a non-root task", async () => {
    const { app } = await makeFixture(["project-1", "task-1"]);
    await request(app)
      .post("/api/projects")
      .send({ templateId: "generic-task", title: "整理播客选题", recurrence: { kind: "none" } })
      .expect(201);
    await request(app)
      .post("/api/projects/project-1/tasks/project-1-root/children")
      .send({ title: "收集候选选题" })
      .expect(200);

    const renamedResponse = await request(app)
      .patch("/api/projects/project-1/tasks/task-1/title")
      .send({ title: "确认推荐仓库名单" })
      .expect(200);

    expect(renamedResponse.body.projects[0].taskTree.children[0]).toMatchObject({
      id: "task-1",
      title: "确认推荐仓库名单"
    });

    const deletedResponse = await request(app)
      .delete("/api/projects/project-1/tasks/task-1")
      .expect(200);

    expect(deletedResponse.body.projects[0].taskTree.children).toEqual([]);
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
    const { app } = await makeFixture(["project-1", "activity-project-complete", "activity-project-revoke"]);
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
    expect(completedResponse.body.activity).toContainEqual(
      expect.objectContaining({
        id: "activity-project-complete",
        projectId: "project-1",
        kind: "big",
        type: "project_completed",
        message: "项目完成：Project 1"
      })
    );

    const reopenedResponse = await request(app)
      .post("/api/projects/project-1/reopen")
      .send({})
      .expect(200);

    expect(reopenedResponse.body.projects[0].status).toBe("active");
    expect(reopenedResponse.body.projects[0].completedFromStatus).toBeUndefined();
    expect(reopenedResponse.body.activity).toEqual([]);
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
