import type { ActivityEntry, Project, Settings, Warning } from "./types";

interface EvaluateWarningsInput {
  settings: Settings;
  projects: Project[];
  activity: ActivityEntry[];
  now: string;
}

export function evaluateWarnings(input: EvaluateWarningsInput): Warning[] {
  const { settings, projects, activity, now } = input;
  const visibleProjects = projects.filter((project) => !project.hiddenAt);
  const activeProjects = visibleProjects.filter((project) => project.status === "active");
  const warnings: Warning[] = [];

  if (activeProjects.length > settings.activeProjectLimit) {
    warnings.push({
      id: `parallel-limit-${now}`,
      type: "parallel_limit",
      message: `进行中项目 ${activeProjects.length} / ${settings.activeProjectLimit}，超过并行上限。`,
      severity: "blocking",
      createdAt: now
    });
  }

  for (const project of activeProjects) {
    const deadlineRiskWarning = evaluateDeadlineRisk(project, now);
    if (deadlineRiskWarning) {
      warnings.push(deadlineRiskWarning);
    }

    const stagnationWarning = evaluateStagnation(project, activity, settings, now);
    if (stagnationWarning) {
      warnings.push(stagnationWarning);
    }
  }

  return warnings;
}

function evaluateDeadlineRisk(project: Project, now: string): Warning | undefined {
  const rule = project.templateSnapshot.warningRules.deadlineRisk;
  if (!project.deadline || !rule) {
    return undefined;
  }

  const daysUntilDeadline = calendarDaysBetween(now, project.deadline);
  const daysBeforeDeadline = normalizeNonNegativeDays(rule.daysBeforeDeadline);
  if (daysUntilDeadline === undefined || daysUntilDeadline > daysBeforeDeadline) {
    return undefined;
  }

  const requiredFilledSlotRatio = normalizeRatio(rule.requiredFilledSlotRatio);
  const slotRatioRisk =
    requiredFilledSlotRatio !== undefined && filledSlotRatio(project) < requiredFilledSlotRatio;
  const stageRisk = rule.requiredStageId !== undefined && !hasReachedStage(project, rule.requiredStageId);

  if (!slotRatioRisk && !stageRisk) {
    return undefined;
  }

  return {
    id: `deadline-risk-${project.id}-${now}`,
    type: "deadline_risk",
    projectId: project.id,
    message: `项目 ${project.title} 接近截止时间，关键进度不足。`,
    severity: "blocking",
    createdAt: now
  };
}

function evaluateStagnation(
  project: Project,
  activity: ActivityEntry[],
  settings: Settings,
  now: string
): Warning | undefined {
  const rule = project.templateSnapshot.warningRules.stagnation;
  const daysWithoutActivity = normalizeNonNegativeDays(rule?.daysWithoutActivity ?? settings.defaultStagnationDays);
  const lastActivityAt = latestProjectActivityAt(project, activity);
  const daysSinceMovement = calendarDaysBetween(lastActivityAt, now);

  if (daysSinceMovement === undefined || daysSinceMovement < daysWithoutActivity) {
    return undefined;
  }

  return {
    id: `stagnation-${project.id}-${now}`,
    type: "stagnation",
    projectId: project.id,
    message: `项目 ${project.title} 已 ${daysWithoutActivity} 天没有活动。`,
    severity: "blocking",
    createdAt: now
  };
}

function filledSlotRatio(project: Project): number {
  if (project.slots.length === 0) {
    return 0;
  }

  return project.slots.filter((slot) => slot.progressObjectId !== undefined).length / project.slots.length;
}

function hasReachedStage(project: Project, requiredStageId: string): boolean {
  const requiredIndex = project.stages.findIndex((stage) => stage.id === requiredStageId);
  if (requiredIndex === -1) {
    return false;
  }

  return project.stages
    .slice(requiredIndex)
    .some((stage) => stage.status === "active" || stage.status === "completed");
}

function latestProjectActivityAt(project: Project, activity: ActivityEntry[]): string {
  const projectActivity = activity.filter((entry) => entry.projectId === project.id);
  const validActivity = projectActivity.filter((entry) => Number.isFinite(Date.parse(entry.createdAt)));

  if (validActivity.length === 0) {
    return project.updatedAt;
  }

  return validActivity.reduce((latest, entry) =>
    Date.parse(entry.createdAt) > Date.parse(latest.createdAt) ? entry : latest
  ).createdAt;
}

function calendarDaysBetween(from: string, to: string): number | undefined {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);

  if (!fromDate || !toDate) {
    return undefined;
  }

  const fromDay = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const toDay = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

  return Math.floor((toDay.getTime() - fromDay.getTime()) / 86_400_000);
}

function parseDate(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function normalizeRatio(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(1, Math.max(0, value));
}

function normalizeNonNegativeDays(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}
