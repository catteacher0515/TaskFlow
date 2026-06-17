import type { Project, ProjectStatus } from "./types";

type RecoverableProjectStatus = Extract<ProjectStatus, "completed" | "abandoned">;
type OpenProjectStatus = Exclude<ProjectStatus, RecoverableProjectStatus>;

export function setProjectStatus(project: Project, status: ProjectStatus, now: string): Project {
  if (project.status === status) {
    return project;
  }

  if (status === "completed" || status === "abandoned") {
    return {
      ...project,
      status,
      completedFromStatus:
        project.status === "completed" || project.status === "abandoned"
          ? project.completedFromStatus
          : project.status,
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
  if (project.status !== "completed" && project.status !== "abandoned") {
    throw new Error(`Project is not reopenable: ${project.id}`);
  }

  return {
    ...project,
    status: project.completedFromStatus ?? ("active" satisfies OpenProjectStatus),
    completedFromStatus: undefined,
    updatedAt: now
  };
}

export function hideProject(project: Project, now: string): Project {
  if (project.hiddenAt) {
    return project;
  }

  return {
    ...project,
    hiddenAt: now,
    updatedAt: now
  };
}
