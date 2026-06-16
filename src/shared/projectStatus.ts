import type { Project, ProjectStatus } from "./types";

type OpenProjectStatus = Exclude<ProjectStatus, "completed">;

export function setProjectStatus(project: Project, status: ProjectStatus, now: string): Project {
  if (project.status === status) {
    return project;
  }

  if (status === "completed") {
    return {
      ...project,
      status,
      completedFromStatus: project.status === "completed" ? project.completedFromStatus : project.status,
      updatedAt: now
    };
  }

  return {
    ...project,
    status,
    completedFromStatus: undefined,
    updatedAt: now
  };
}

export function reopenProject(project: Project, now: string): Project {
  if (project.status !== "completed") {
    throw new Error(`Project is not completed: ${project.id}`);
  }

  return {
    ...project,
    status: project.completedFromStatus ?? ("active" satisfies OpenProjectStatus),
    completedFromStatus: undefined,
    updatedAt: now
  };
}
