import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createProjectFromTemplate } from "../../src/shared/projectFactory";
import type { ActivityEntry, FocusModeState } from "../../src/shared/types";
import { genericTaskTemplate } from "../../src/shared/genericTaskTemplate";
import { weeklyGithubTemplate } from "../../src/shared/weeklyGithubTemplate";
import {
  appendActivity,
  dataDir,
  initializeDataDir,
  readJsonFile,
  readState,
  writeFocusMode,
  writeEmotionEntries,
  writeProject
} from "../../src/server/storage";

const roots: string[] = [];

async function makeRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "taskflow-storage-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("local file storage", () => {
  it("initializes default data files and reads the default state", async () => {
    const root = await makeRoot();

    await initializeDataDir(root);
    const state = await readState(root);

    expect(state.settings).toMatchObject({
      dataVersion: 1,
      activeProjectLimit: 3,
      defaultStagnationDays: 2
    });
    expect(state.templates.map((template) => template.id)).toEqual(
      expect.arrayContaining(["generic-task", "weekly-github-picks"])
    );
    expect(state.projects).toEqual([]);
    expect(state.activity).toEqual([]);
    expect(state.focusMode).toEqual({ status: "inactive" });
    expect(state.warnings).toEqual([]);
    expect(await readFile(path.join(dataDir(root), "projects", ".gitkeep"), "utf8")).toBe("");
    expect(await readFile(path.join(dataDir(root), "activity-log.jsonl"), "utf8")).toBe("");
  });

  it("initializes default emotion entry storage in app state", async () => {
    const root = await makeRoot();

    await initializeDataDir(root);
    const state = await readState(root);
    const rawEmotionEntries = await readFile(path.join(dataDir(root), "emotion-entries.json"), "utf8");

    expect(state.emotionEntries).toEqual([]);
    expect(JSON.parse(rawEmotionEntries)).toEqual([]);
  });

  it("reads persisted emotion entries from local storage", async () => {
    const root = await makeRoot();
    const entries = [
      {
        date: "2026-06-20",
        emoji: "🙂",
        shortNote: "缓过来了",
        createdAt: "2026-06-20T14:00:00.000Z",
        updatedAt: "2026-06-20T14:00:00.000Z"
      }
    ];

    await initializeDataDir(root);
    await writeEmotionEntries(root, entries);

    const state = await readState(root);
    const rawEmotionEntries = await readFile(path.join(dataDir(root), "emotion-entries.json"), "utf8");

    expect(state.emotionEntries).toContainEqual(
      expect.objectContaining({
        date: "2026-06-20",
        emoji: "🙂",
        shortNote: "缓过来了"
      })
    );
    expect(JSON.parse(rawEmotionEntries)).toEqual(entries);
  });

  it("uses DATA_DIR when provided", async () => {
    const root = await makeRoot();
    process.env.DATA_DIR = path.join(root, "runtime-data");

    await initializeDataDir(root);
    const state = await readState(root);

    expect(state.projects).toEqual([]);
    expect(await readFile(path.join(process.env.DATA_DIR, "activity-log.jsonl"), "utf8")).toBe("");
    expect(dataDir(root)).toBe(process.env.DATA_DIR);

    delete process.env.DATA_DIR;
  });

  it("throws for corrupt JSON without overwriting the original file", async () => {
    const root = await makeRoot();
    await initializeDataDir(root);
    const settingsPath = path.join(dataDir(root), "settings.json");
    const corruptJson = "{ invalid json";
    await writeFile(settingsPath, corruptJson, "utf8");

    await expect(readJsonFile(settingsPath)).rejects.toThrow("Invalid JSON file");
    await expect(readState(root)).rejects.toThrow("Invalid JSON file");
    expect(await readFile(settingsPath, "utf8")).toBe(corruptJson);
  });

  it("writes projects and appends activity entries that readState reads back", async () => {
    const root = await makeRoot();
    const project = createProjectFromTemplate({
      id: "project-1",
      template: weeklyGithubTemplate,
      title: "每周 GitHub 精选 2026-W25",
      recurrence: { kind: "weekly" },
      now: "2026-06-16T09:00:00.000Z"
    });
    const activity: ActivityEntry = {
      id: "activity-1",
      projectId: "project-1",
      kind: "small",
      message: "测试了一个候选仓库",
      createdAt: "2026-06-16T09:10:00.000Z"
    };

    await writeProject(root, project);
    await appendActivity(root, activity);
    const state = await readState(root);

    expect(state.projects).toEqual([project]);
    expect(state.activity).toEqual([activity]);
  });

  it("filters revoked feedback from the derived app state while keeping the raw log intact", async () => {
    const root = await makeRoot();
    const effectiveActivity: ActivityEntry = {
      id: "activity-1",
      projectId: "project-1",
      kind: "small",
      type: "task_completed",
      message: "任务完成：收集候选选题",
      taskId: "task-1",
      createdAt: "2026-06-16T09:10:00.000Z"
    };
    const revocation: ActivityEntry = {
      id: "activity-revoke",
      projectId: "project-1",
      kind: "small",
      type: "feedback_revoked",
      message: "反馈撤销：收集候选选题",
      taskId: "task-1",
      revokedActivityId: "activity-1",
      createdAt: "2026-06-16T09:11:00.000Z"
    };

    await appendActivity(root, effectiveActivity);
    await appendActivity(root, revocation);
    const state = await readState(root);
    const rawLog = await readFile(path.join(dataDir(root), "activity-log.jsonl"), "utf8");

    expect(state.activity).toEqual([]);
    expect(rawLog).toContain('"id":"activity-1"');
    expect(rawLog).toContain('"id":"activity-revoke"');
  });

  it("persists active focus mode state", async () => {
    const root = await makeRoot();
    const focusMode: FocusModeState = {
      status: "active",
      selectedProjectId: "project-1",
      selectedActionId: "test-one-repo",
      session: {
        startedAt: "2026-06-16T09:00:00.000Z",
        durationMinutes: 5
      }
    };

    await writeFocusMode(root, focusMode);
    const state = await readState(root);

    expect(state.focusMode.status).toBe("active");
    expect(state.focusMode.selectedProjectId).toBe("project-1");
    expect(state.focusMode).toEqual(focusMode);
  });

  it("reports invalid activity log lines with a line number", async () => {
    const root = await makeRoot();
    await initializeDataDir(root);
    await writeFile(
      path.join(dataDir(root), "activity-log.jsonl"),
      '\n{"id":"activity-1","projectId":"project-1","kind":"small","message":"ok","createdAt":"2026-06-16T09:10:00.000Z"}\n\n{ bad json }\n',
      "utf8"
    );

    await expect(readState(root)).rejects.toThrow("Invalid JSON line 4");
  });

  it("normalizes legacy generic projects into task-tree projects", async () => {
    const root = await makeRoot();
    await initializeDataDir(root);
    await writeFile(
      path.join(dataDir(root), "projects", "legacy-generic.json"),
      JSON.stringify(
        {
          id: "legacy-generic",
          title: "测试任务",
          status: "not_started",
          templateId: "generic-task",
          templateSnapshot: {
            templateId: "generic-task",
            templateName: "通用任务",
            stages: [{ id: "clarify", name: "明确目标" }],
            slots: [],
            minimumActions: [],
            warningRules: {}
          },
          recurrence: { kind: "none" },
          stages: [{ id: "clarify", name: "明确目标", status: "active" }],
          progressObjects: [],
          slots: [],
          createdAt: "2026-06-16T08:00:00.000Z",
          updatedAt: "2026-06-16T08:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );

    const state = await readState(root);

    expect(state.projects[0].stages).toEqual([]);
    expect(state.projects[0].templateSnapshot.stages).toEqual([]);
    expect(state.projects[0].taskTree).toEqual({
      id: "legacy-generic-root",
      title: "测试任务",
      status: "not_started",
      children: [],
      createdAt: "2026-06-16T08:00:00.000Z",
      updatedAt: "2026-06-16T08:00:00.000Z"
    });
  });

  it("normalizes legacy weekly GitHub projects into task-tree projects", async () => {
    const root = await makeRoot();
    await initializeDataDir(root);
    await writeFile(
      path.join(dataDir(root), "projects", "legacy-weekly.json"),
      JSON.stringify(
        {
          id: "legacy-weekly",
          title: "GitHub 每周精选｜2026 W25",
          status: "active",
          templateId: "weekly-github-picks",
          templateSnapshot: {
            templateId: "weekly-github-picks",
            templateName: "每周 GitHub 精选",
            stages: [{ id: "collect", name: "候选收集" }],
            progressObject: {
              name: "候选仓库",
              fields: ["repoName"],
              states: [{ id: "untested", name: "未测", category: "open" }],
              feedbackStateIds: []
            },
            slots: [{ id: "recommendation-1", name: "推荐 1" }],
            minimumActions: [{ id: "test-one-repo", label: "亲测 1 个候选仓库" }],
            warningRules: {
              parallelLimit: { useGlobalLimit: true },
              stagnation: { daysWithoutActivity: 2 }
            }
          },
          recurrence: { kind: "weekly" },
          stages: [{ id: "collect", name: "候选收集", status: "active" }],
          progressObjects: [
            {
              id: "repo-1",
              title: "openai/codex",
              stateId: "untested",
              fields: { repoName: "openai/codex" },
              createdAt: "2026-06-16T08:00:00.000Z",
              updatedAt: "2026-06-16T08:00:00.000Z"
            }
          ],
          slots: [{ id: "recommendation-1", name: "推荐 1", progressObjectId: "repo-1" }],
          createdAt: "2026-06-16T08:00:00.000Z",
          updatedAt: "2026-06-16T08:00:00.000Z"
        },
        null,
        2
      ),
      "utf8"
    );

    const state = await readState(root);

    expect(state.projects[0].stages).toEqual([]);
    expect(state.projects[0].progressObjects).toEqual([]);
    expect(state.projects[0].slots).toEqual([]);
    expect(state.projects[0].templateSnapshot.stages).toEqual([]);
    expect(state.projects[0].templateSnapshot.progressObject).toBeUndefined();
    expect(state.projects[0].templateSnapshot.slots).toEqual([]);
    expect(state.projects[0].taskTree?.children.map((task) => task.title)).toEqual([
      "亲测候选仓库",
      "确定本周 5 个推荐",
      "成稿",
      "发布"
    ]);
    expect(state.projects[0].taskTree?.children[0]?.children.map((task) => [task.title, task.status])).toEqual([
      ["openai/codex", "not_started"]
    ]);
    expect(state.projects[0].taskTree?.children[1]?.children).toEqual([]);
    expect(state.projects[0].taskTree?.children[3]?.children.map((task) => task.title)).toEqual([
      "抖音",
      "知乎",
      "B站",
      "小红书",
      "编程导航",
      "稀土掘金"
    ]);
  });

  it("keeps seeded weekly GitHub template in sync with the source template", async () => {
    const raw = await readFile(path.join(process.cwd(), "data", "templates", "weekly-github-picks.json"), "utf8");

    expect(JSON.parse(raw)).toEqual(weeklyGithubTemplate);
  });

  it("keeps seeded generic task template in sync with the source template", async () => {
    const raw = await readFile(path.join(process.cwd(), "data", "templates", "generic-task.json"), "utf8");

    expect(JSON.parse(raw)).toEqual(genericTaskTemplate);
  });
});
