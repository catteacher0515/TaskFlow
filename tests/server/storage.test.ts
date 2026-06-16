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

  it("keeps seeded weekly GitHub template in sync with the source template", async () => {
    const raw = await readFile(path.join(process.cwd(), "data", "templates", "weekly-github-picks.json"), "utf8");

    expect(JSON.parse(raw)).toEqual(weeklyGithubTemplate);
  });

  it("keeps seeded generic task template in sync with the source template", async () => {
    const raw = await readFile(path.join(process.cwd(), "data", "templates", "generic-task.json"), "utf8");

    expect(JSON.parse(raw)).toEqual(genericTaskTemplate);
  });
});
