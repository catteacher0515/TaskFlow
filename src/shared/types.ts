export type ProjectStatus = "not_started" | "active" | "paused" | "completed" | "abandoned";
export type WarningType = "parallel_limit" | "deadline_risk" | "stagnation";
export type FeedbackKind = "small" | "big";
export type ActivityType =
  | "progress_concluded"
  | "slot_filled"
  | "stage_completed"
  | "task_completed"
  | "entropy_reduced"
  | "project_completed"
  | "feedback_revoked";
export type FocusSessionResult = "recorded" | "continued" | "blocked";
export type TaskNodeStatus = "not_started" | "active" | "completed" | "dropped" | "unhandled";

export interface Settings {
  dataVersion: 1;
  activeProjectLimit: number;
  defaultStagnationDays: number;
}

export interface RecurrenceRule {
  kind: "none" | "daily" | "weekly" | "monthly" | "workdays" | "custom_interval";
  intervalDays?: number;
}

export interface StageDefinition {
  id: string;
  name: string;
}

export interface ProgressStateDefinition {
  id: string;
  name: string;
  category: "open" | "in_progress" | "concluded";
}

export interface ProgressObjectDefinition {
  name: string;
  fields: string[];
  states: ProgressStateDefinition[];
  feedbackStateIds: string[];
}

export interface SlotDefinition {
  id: string;
  name: string;
}

export interface MinimumActionDefinition {
  id: string;
  label: string;
}

export interface WarningRules {
  parallelLimit?: {
    useGlobalLimit: boolean;
    limit?: number;
  };
  deadlineRisk?: {
    daysBeforeDeadline: number;
    requiredFilledSlotRatio?: number;
    requiredStageId?: string;
  };
  stagnation?: {
    daysWithoutActivity: number;
  };
}

export interface Template {
  id: string;
  name: string;
  description: string;
  stages: StageDefinition[];
  progressObject?: ProgressObjectDefinition;
  slots: SlotDefinition[];
  minimumActions: MinimumActionDefinition[];
  recurrence: {
    supportedRules: RecurrenceRule["kind"][];
    defaultRule: RecurrenceRule;
  };
  warningRules: WarningRules;
}

export interface StageInstance extends StageDefinition {
  status: "not_started" | "active" | "completed";
}

export interface ProgressObjectInstance {
  id: string;
  title: string;
  stateId: string;
  fields: Record<string, string>;
  feedbackRecordedAt?: string;
  feedbackStateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlotInstance extends SlotDefinition {
  progressObjectId?: string;
  filledAt?: string;
}

export interface TaskNode {
  id: string;
  title: string;
  status: TaskNodeStatus;
  children: TaskNode[];
  feedbackRecordedAt?: string;
  feedbackStatus?: Extract<TaskNodeStatus, "completed" | "dropped">;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSnapshot {
  templateId?: string;
  templateName: string;
  stages: StageDefinition[];
  progressObject?: ProgressObjectDefinition;
  slots: SlotDefinition[];
  minimumActions: MinimumActionDefinition[];
  warningRules: WarningRules;
}

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  completedFromStatus?: Exclude<ProjectStatus, "completed" | "abandoned">;
  templateId?: string;
  templateSnapshot: TemplateSnapshot;
  recurrence: RecurrenceRule;
  deadline?: string;
  stages: StageInstance[];
  progressObjects: ProgressObjectInstance[];
  slots: SlotInstance[];
  taskTree?: TaskNode;
  hiddenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: string;
  projectId: string;
  kind: FeedbackKind;
  message: string;
  createdAt: string;
  type?: ActivityType;
  progressObjectId?: string;
  slotId?: string;
  stageId?: string;
  taskId?: string;
  revokedActivityId?: string;
}

export interface Warning {
  id: string;
  type: WarningType;
  projectId?: string;
  message: string;
  severity: "warning" | "blocking";
  createdAt: string;
}

export interface FocusModeState {
  status: "inactive" | "active";
  selectedProjectId?: string;
  selectedActionId?: string;
  customActionLabel?: string;
  session?: {
    startedAt: string;
    durationMinutes: 5;
    result?: FocusSessionResult;
  };
}

export interface AppState {
  settings: Settings;
  templates: Template[];
  projects: Project[];
  activity: ActivityEntry[];
  warnings: Warning[];
  focusMode: FocusModeState;
}
