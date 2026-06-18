import { appendFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ActivityEntry, AppState, FocusModeState, Project, Settings, Template } from "../shared/types";
import { genericTaskTemplate } from "../shared/genericTaskTemplate";
import { createRootTask } from "../shared/taskTree";
import { weeklyGithubTemplate } from "../shared/weeklyGithubTemplate";
import { normalizeWeeklyGithubTaskTree, WEEKLY_GITHUB_TEMPLATE_ID } from "../shared/weeklyGithubProject";

const defaultSettings: Settings = {
  dataVersion: 1,
  activeProjectLimit: 3,
  defaultStagnationDays: 2
};

const defaultFocusMode: FocusModeState = {
  status: "inactive"
};

export function dataDir(rootDir: string) {
  return process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, "data");
}

export async function initializeDataDir(rootDir: string) {
  const rootDataDir = dataDir(rootDir);
  const templatesDir = path.join(rootDataDir, "templates");
  const projectsDir = path.join(rootDataDir, "projects");

  await mkdir(templatesDir, { recursive: true });
  await mkdir(projectsDir, { recursive: true });
  await writeIfMissing(path.join(rootDataDir, "settings.json"), defaultSettings);
  await writeIfMissing(path.join(rootDataDir, "focus-mode.json"), defaultFocusMode);
  await writeIfMissing(path.join(templatesDir, `${genericTaskTemplate.id}.json`), genericTaskTemplate);
  await writeIfMissing(path.join(templatesDir, `${weeklyGithubTemplate.id}.json`), weeklyGithubTemplate);
  await writeIfMissing(path.join(projectsDir, ".gitkeep"), "");
  await writeIfMissing(path.join(rootDataDir, "activity-log.jsonl"), "");
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");

  try {
    return JSON.parse(content) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON file: ${filePath}`);
    }
    throw error;
  }
}

export async function readState(rootDir: string): Promise<AppState> {
  await initializeDataDir(rootDir);

  const rootDataDir = dataDir(rootDir);
  const [settings, focusMode, templates, projects, activity] = await Promise.all([
    readJsonFile<Settings>(path.join(rootDataDir, "settings.json")),
    readJsonFile<FocusModeState>(path.join(rootDataDir, "focus-mode.json")),
    readAllJsonFiles<Template>(path.join(rootDataDir, "templates")),
    readAllJsonFiles<Project>(path.join(rootDataDir, "projects")),
    readActivity(path.join(rootDataDir, "activity-log.jsonl"))
  ]);

  return {
    settings,
    templates: templates.map(normalizeTemplate),
    projects: projects.map(normalizeProject),
    activity,
    warnings: [],
    focusMode
  };
}

export async function writeProject(rootDir: string, project: Project) {
  await initializeDataDir(rootDir);
  await writeJsonFile(path.join(dataDir(rootDir), "projects", `${project.id}.json`), project);
}

export async function writeTemplate(rootDir: string, template: Template) {
  await initializeDataDir(rootDir);
  await writeJsonFile(path.join(dataDir(rootDir), "templates", `${template.id}.json`), template);
}

export async function writeSettings(rootDir: string, settings: Settings) {
  await initializeDataDir(rootDir);
  await writeJsonFile(path.join(dataDir(rootDir), "settings.json"), settings);
}

export async function writeFocusMode(rootDir: string, focusMode: FocusModeState) {
  await initializeDataDir(rootDir);
  await writeJsonFile(path.join(dataDir(rootDir), "focus-mode.json"), focusMode);
}

export async function appendActivity(rootDir: string, activity: ActivityEntry) {
  await initializeDataDir(rootDir);
  await appendFile(path.join(dataDir(rootDir), "activity-log.jsonl"), `${JSON.stringify(activity)}\n`, "utf8");
}

async function readAllJsonFiles<T>(dirPath: string): Promise<T[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(jsonFiles.map((fileName) => readJsonFile<T>(path.join(dirPath, fileName))));
}

async function readActivity(filePath: string): Promise<ActivityEntry[]> {
  const content = await readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const entries: ActivityEntry[] = [];

  lines.forEach((line, index) => {
    if (line.trim().length === 0) {
      return;
    }

    try {
      entries.push(JSON.parse(line) as ActivityEntry);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON line ${index + 1} in ${filePath}`);
      }
      throw error;
    }
  });

  const revokedIds = new Set(
    entries
      .filter((entry) => entry.type === "feedback_revoked" && entry.revokedActivityId)
      .map((entry) => entry.revokedActivityId as string)
  );

  return entries.filter((entry) => entry.type !== "feedback_revoked" && !revokedIds.has(entry.id));
}

function normalizeTemplate(template: Template): Template {
  if (template.id === genericTaskTemplate.id) {
    return genericTaskTemplate;
  }

  if (template.id === weeklyGithubTemplate.id) {
    return weeklyGithubTemplate;
  }

  return template;
}

function normalizeProject(project: Project): Project {
  if (project.templateId === genericTaskTemplate.id) {
    return {
      ...project,
      templateSnapshot: {
        ...project.templateSnapshot,
        stages: []
      },
      stages: [],
      taskTree: project.taskTree ?? createRootTask({
        id: `${project.id}-root`,
        title: project.title,
        now: project.createdAt
      })
    };
  }

  if (project.templateId === WEEKLY_GITHUB_TEMPLATE_ID) {
    return {
      ...project,
      templateSnapshot: {
        ...project.templateSnapshot,
        stages: [],
        progressObject: undefined,
        slots: []
      },
      stages: [],
      progressObjects: [],
      slots: [],
      taskTree: normalizeWeeklyGithubTaskTree(project)
    };
  }

  return project;
}

async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);

  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

async function writeIfMissing(filePath: string, value: unknown) {
  const content = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;

  try {
    await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (isFileExistsError(error)) {
      return;
    }
    throw error;
  }
}

function isFileExistsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}
