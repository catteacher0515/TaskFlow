import { useState } from "react";
import type { Project, ProjectStatus } from "../../shared/types";

interface ProjectListProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject: (projectId: string) => void;
}

const statusLabels: Record<ProjectStatus, string> = {
  not_started: "待开始",
  active: "进行中",
  paused: "暂停",
  completed: "已完成"
};

const statusOrder: ProjectStatus[] = ["active", "not_started", "paused", "completed"];

const defaultExpanded: Record<ProjectStatus, boolean> = {
  active: true,
  not_started: true,
  paused: true,
  completed: false
};

export function ProjectList({ projects, selectedProjectId, onSelectProject }: ProjectListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<ProjectStatus, boolean>>(defaultExpanded);
  const groupedProjects = statusOrder
    .map((status) => ({
      status,
      projects: projects.filter((project) => project.status === status)
    }))
    .filter((group) => group.projects.length > 0);

  return (
    <section className="panel" aria-labelledby="project-list-title">
      <div className="panel-header">
        <h2 id="project-list-title">项目列表</h2>
        <span className="muted-count">{projects.length}</span>
      </div>

      <div className="project-list">
        {projects.length > 0 ? (
          groupedProjects.map((group) => {
            const isExpanded = expandedGroups[group.status];

            return (
              <section className="project-group" key={group.status}>
                <button
                  className="project-group-toggle"
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedGroups((current) => ({
                      ...current,
                      [group.status]: !current[group.status]
                    }))
                  }
                >
                  <span>{statusLabels[group.status]}</span>
                  <span className="project-group-count">{group.projects.length}</span>
                </button>

                {isExpanded ? (
                  <div className="project-group-items">
                    {group.projects.map((project) => (
                      <button
                        className={`project-row${project.id === selectedProjectId ? " selected" : ""}`}
                        key={project.id}
                        type="button"
                        aria-pressed={project.id === selectedProjectId}
                        onClick={() => onSelectProject(project.id)}
                      >
                        <span className="project-title">{project.title}</span>
                        <span className={`project-status status-${project.status}`}>
                          {statusLabels[project.status]}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })
        ) : (
          <p className="empty-state">暂无项目</p>
        )}
      </div>
    </section>
  );
}
