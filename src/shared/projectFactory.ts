import type { Project, RecurrenceRule, Template } from "./types";
import { createRootTask } from "./taskTree";
import { buildWeeklyGithubTaskTree, WEEKLY_GITHUB_TEMPLATE_ID } from "./weeklyGithubProject";

interface CreateProjectInput {
  id: string;
  template: Template;
  title: string;
  recurrence: RecurrenceRule;
  now: string;
  deadline?: string;
}

export function createProjectFromTemplate(input: CreateProjectInput): Project {
  const stages = input.template.stages.map((stage, index) => ({
    ...stage,
    status: index === 0 ? ("active" as const) : ("not_started" as const)
  }));
  const taskTree = createTemplateTaskTree(input.id, input.template.id, input.title, input.now);

  return {
    id: input.id,
    title: input.title,
    status: "not_started",
    templateId: input.template.id,
    templateSnapshot: {
      templateId: input.template.id,
      templateName: input.template.name,
      stages: structuredClone(input.template.stages),
      progressObject: input.template.progressObject
        ? structuredClone(input.template.progressObject)
        : undefined,
      slots: structuredClone(input.template.slots),
      minimumActions: structuredClone(input.template.minimumActions),
      warningRules: structuredClone(input.template.warningRules)
    },
    recurrence: input.recurrence,
    deadline: input.deadline,
    stages,
    progressObjects: [],
    slots: input.template.slots.map((slot) => ({ ...slot })),
    taskTree,
    createdAt: input.now,
    updatedAt: input.now
  };
}

function createTemplateTaskTree(projectId: string, templateId: string | undefined, title: string, now: string) {
  if (templateId === "generic-task") {
    return createRootTask({
      id: `${projectId}-root`,
      title,
      now
    });
  }

  if (templateId === WEEKLY_GITHUB_TEMPLATE_ID) {
    return buildWeeklyGithubTaskTree(projectId, title, now);
  }

  return undefined;
}
