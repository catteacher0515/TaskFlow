import type { Express, NextFunction, Request, Response } from "express";
import {
  addProgressObject,
  advanceStage,
  fillSlot,
  transitionProgressObject
} from "../shared/progress";
import { addTaskChild, transitionTask } from "../shared/taskTree";
import { canMutateProject, completeFocusSession, selectFocusProject } from "../shared/focusMode";
import { createProjectFromTemplate } from "../shared/projectFactory";
import type {
  ActivityEntry,
  AppState,
  FocusSessionResult,
  Project,
  ProjectStatus,
  RecurrenceRule,
  TaskNodeStatus,
  Template
} from "../shared/types";
import { evaluateWarnings } from "../shared/warnings";
import {
  appendActivity,
  readState,
  writeFocusMode,
  writeProject,
  writeTemplate
} from "./storage";

const projectStatuses: ProjectStatus[] = ["not_started", "active", "paused", "completed"];
const focusSessionResults: FocusSessionResult[] = ["recorded", "continued", "blocked"];
const taskNodeStatuses: TaskNodeStatus[] = ["not_started", "active", "completed", "dropped", "unhandled"];

export interface RouteDeps {
  rootDir: string;
  now: () => string;
  id: () => string;
}

export function registerRoutes(app: Express, deps: RouteDeps) {
  app.get("/api/state", asyncRoute(async (_req, res) => {
    res.json(await readStateWithWarnings(deps));
  }));

  app.post("/api/projects", asyncRoute(async (req, res) => {
    const state = await readStateWithWarnings(deps);
    const template = state.templates.find((item) => item.id === req.body.templateId);

    if (!template) {
      throw new HttpError(404, "Template not found");
    }

    const now = deps.now();
    const project = createProjectFromTemplate({
      id: deps.id(),
      template,
      title: req.body.title,
      recurrence: req.body.recurrence ?? template.recurrence.defaultRule,
      deadline: req.body.deadline,
      now
    });

    await writeProject(deps.rootDir, project);
    res.status(201).json({ project, state: await readStateWithWarnings(deps) });
  }));

  app.put("/api/templates/:templateId", asyncRoute(async (req, res) => {
    const template = req.body as Template;

    if (template.id !== req.params.templateId) {
      throw new HttpError(400, "Template id must match route parameter");
    }

    await writeTemplate(deps.rootDir, template);
    res.json(await readStateWithWarnings(deps));
  }));

  app.patch("/api/projects/:projectId/status", asyncRoute(async (req, res) => {
    const status = parseProjectStatus(req.body.status);

    await mutateProject(deps, req.params.projectId, (project) => ({
      ...project,
      status,
      updatedAt: deps.now()
    }));

    res.json(await readStateWithWarnings(deps));
  }));

  app.post("/api/projects/:projectId/progress-objects", asyncRoute(async (req, res) => {
    await mutateProject(deps, req.params.projectId, (project) =>
      addProgressObject(project, {
        id: deps.id(),
        title: req.body.title,
        fields: req.body.fields ?? {},
        now: deps.now()
      })
    );

    res.json(await readStateWithWarnings(deps));
  }));

  app.post("/api/projects/:projectId/tasks/:taskId/children", asyncRoute(async (req, res) => {
    const title = parseRequiredString(req.body.title, "Task title is required");

    await mutateProject(deps, req.params.projectId, (project) =>
      addTaskChild(project, {
        id: deps.id(),
        parentTaskId: req.params.taskId,
        title,
        now: deps.now()
      })
    );

    res.json(await readStateWithWarnings(deps));
  }));

  app.patch("/api/projects/:projectId/tasks/:taskId/status", asyncRoute(async (req, res) => {
    let activity: ActivityEntry | undefined;
    await mutateProject(deps, req.params.projectId, (project) => {
      const result = transitionTask(project, {
        activityId: deps.id(),
        taskId: req.params.taskId,
        nextStatus: parseTaskNodeStatus(req.body.status),
        now: deps.now()
      });
      activity = result.activity;
      return result.project;
    });

    if (activity) {
      await appendActivity(deps.rootDir, activity);
    }

    res.json(await readStateWithWarnings(deps));
  }));

  app.patch("/api/projects/:projectId/progress-objects/:progressObjectId/state", asyncRoute(async (req, res) => {
    let activity: ActivityEntry | undefined;
    await mutateProject(deps, req.params.projectId, (project) => {
      const result = transitionProgressObject(project, {
        activityId: deps.id(),
        progressObjectId: req.params.progressObjectId,
        nextStateId: req.body.nextStateId,
        note: req.body.note ?? "",
        now: deps.now()
      });
      activity = result.activity;
      return result.project;
    });

    if (activity) {
      await appendActivity(deps.rootDir, activity);
    }

    res.json(await readStateWithWarnings(deps));
  }));

  app.post("/api/projects/:projectId/slots/:slotId/fill", asyncRoute(async (req, res) => {
    let activity: ActivityEntry | undefined;
    await mutateProject(deps, req.params.projectId, (project) => {
      const result = fillSlot(project, {
        activityId: deps.id(),
        slotId: req.params.slotId,
        progressObjectId: req.body.progressObjectId,
        now: deps.now()
      });
      activity = result.activity;
      return result.project;
    });

    await appendRequiredActivity(deps.rootDir, activity);
    res.json(await readStateWithWarnings(deps));
  }));

  app.post("/api/projects/:projectId/stages/:stageId/complete", asyncRoute(async (req, res) => {
    let activity: ActivityEntry | undefined;
    await mutateProject(deps, req.params.projectId, (project) => {
      const result = advanceStage(project, {
        activityId: deps.id(),
        completedStageId: req.params.stageId,
        nextStageId: req.body.nextStageId,
        now: deps.now()
      });
      activity = result.activity;
      return result.project;
    });

    await appendRequiredActivity(deps.rootDir, activity);
    res.json(await readStateWithWarnings(deps));
  }));

  app.post("/api/focus/select", asyncRoute(async (req, res) => {
    const state = await readStateWithWarnings(deps);
    requireProject(state, req.body.projectId);

    const focusMode = selectFocusProject({
      warnings: state.warnings,
      projectId: req.body.projectId,
      selectedActionId: req.body.selectedActionId,
      customActionLabel: req.body.customActionLabel,
      now: deps.now()
    });

    await writeFocusMode(deps.rootDir, focusMode);
    res.json(await readStateWithWarnings(deps));
  }));

  app.post("/api/focus/complete-session", asyncRoute(async (req, res) => {
    const state = await readStateWithWarnings(deps);
    const focusMode = completeFocusSession(state.focusMode, parseFocusSessionResult(req.body.result));

    await writeFocusMode(deps.rootDir, focusMode);
    res.json(await readStateWithWarnings(deps));
  }));

  app.use(errorHandler);
}

async function readStateWithWarnings(deps: RouteDeps): Promise<AppState> {
  const state = await readState(deps.rootDir);

  return {
    ...state,
    warnings: evaluateWarnings({
      settings: state.settings,
      projects: state.projects,
      activity: state.activity,
      now: deps.now()
    })
  };
}

async function mutateProject(
  deps: RouteDeps,
  projectId: string,
  update: (project: Project) => Project
) {
  const state = await readStateWithWarnings(deps);
  const project = requireProject(state, projectId);
  assertCanMutate(state, projectId);
  await writeProject(deps.rootDir, update(project));
}

function requireProject(state: AppState, projectId: string): Project {
  const project = state.projects.find((item) => item.id === projectId);

  if (!project) {
    throw new HttpError(404, "Unknown project");
  }

  return project;
}

function assertCanMutate(state: AppState, projectId: string) {
  if (!canMutateProject(state.focusMode, projectId)) {
    throw new HttpError(409, `Focus mode only allows mutations on ${state.focusMode.selectedProjectId}`);
  }
}

function parseProjectStatus(value: unknown): ProjectStatus {
  if (typeof value === "string" && projectStatuses.includes(value as ProjectStatus)) {
    return value as ProjectStatus;
  }

  throw new HttpError(400, "Invalid project status");
}

function parseFocusSessionResult(value: unknown): FocusSessionResult {
  if (typeof value === "string" && focusSessionResults.includes(value as FocusSessionResult)) {
    return value as FocusSessionResult;
  }

  throw new HttpError(400, "Invalid focus session result");
}

function parseTaskNodeStatus(value: unknown): TaskNodeStatus {
  if (typeof value === "string" && taskNodeStatuses.includes(value as TaskNodeStatus)) {
    return value as TaskNodeStatus;
  }

  throw new HttpError(400, "Invalid task status");
}

function parseRequiredString(value: unknown, message: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  throw new HttpError(400, message);
}

async function appendRequiredActivity(rootDir: string, activity: ActivityEntry | undefined) {
  if (!activity) {
    throw new Error("Expected activity entry");
  }

  await appendActivity(rootDir, activity);
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const mappedError = mapDomainError(error);

  if (mappedError) {
    res.status(mappedError.status).json({ error: mappedError.message });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  if (error instanceof Error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(500).json({ error: "Unexpected error" });
}

function mapDomainError(error: unknown): HttpError | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  if (
    error.message.startsWith("Unknown progress object:") ||
    error.message.startsWith("Unknown slot:") ||
    error.message.startsWith("Unknown stage:") ||
    error.message.startsWith("Unknown next stage:") ||
    error.message.startsWith("Unknown task:")
  ) {
    return new HttpError(404, error.message);
  }

  if (
    error.message.startsWith("Slot already filled:") ||
    error.message.startsWith("Task tree depth limit reached:") ||
    error.message === "Focus session already completed"
  ) {
    return new HttpError(409, error.message);
  }

  if (
    error.message.startsWith("Unknown progress state:") ||
    error.message === "Next stage is required" ||
    error.message.startsWith("Next stage must follow completed stage:") ||
    error.message.startsWith("Next stage is not ready:") ||
    error.message.startsWith("Stage is not active:") ||
    error.message === "Project does not define a task tree" ||
    error.message === "No active focus session" ||
    error.message === "Focus mode requires at least one blocking warning" ||
    error.message === "Focus mode requires a blocking warning for the selected project"
  ) {
    return new HttpError(400, error.message);
  }

  return undefined;
}
