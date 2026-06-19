import { useState } from "react";
import type { Project, ProjectStatus } from "../../shared/types";

interface ProjectListProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject: (projectId: string) => void;
  onRenameProject: (projectId: string, title: string) => Promise<void>;
}

const statusLabels: Record<ProjectStatus, string> = {
  not_started: "待开始",
  active: "进行中",
  paused: "暂停",
  completed: "已完成",
  abandoned: "已放弃"
};

const statusOrder: ProjectStatus[] = ["active", "not_started", "paused", "completed", "abandoned"];

const defaultExpanded: Record<ProjectStatus, boolean> = {
  active: true,
  not_started: true,
  paused: true,
  completed: false,
  abandoned: false
};

export function ProjectList({ projects, selectedProjectId, onSelectProject, onRenameProject }: ProjectListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<ProjectStatus, boolean>>(defaultExpanded);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const groupedProjects = statusOrder
    .map((status) => ({
      status,
      projects: projects.filter((project) => project.status === status)
    }))
    .filter((group) => group.projects.length > 0);

  async function saveRename(project: Project) {
    const nextTitle = editingTitle.trim();

    if (!nextTitle || nextTitle === project.title) {
      cancelRename();
      return;
    }

    await onRenameProject(project.id, nextTitle);
    setEditingProjectId(null);
    setEditingTitle("");
    setMenuProjectId(null);
  }

  function startRename(project: Project) {
    setEditingProjectId(project.id);
    setEditingTitle(project.title);
    setMenuProjectId(null);
  }

  function cancelRename() {
    setEditingProjectId(null);
    setEditingTitle("");
  }

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
                      <div
                        className={`project-row${project.id === selectedProjectId ? " selected" : ""}`}
                        key={project.id}
                      >
                        <button
                          className="project-row-main"
                          type="button"
                          aria-pressed={project.id === selectedProjectId}
                          aria-label={`选择项目：${project.title}`}
                          onClick={() => onSelectProject(project.id)}
                        >
                          {editingProjectId === project.id ? (
                            <input
                              className="project-rename-input"
                              type="text"
                              aria-label={`重命名项目：${project.title}`}
                              value={editingTitle}
                              autoFocus
                              onChange={(event) => setEditingTitle(event.target.value)}
                              onBlur={() => {
                                void saveRename(project);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void saveRename(project);
                                }

                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelRename();
                                }
                              }}
                            />
                          ) : (
                            <span className="project-title">{project.title}</span>
                          )}
                          <span className={`project-status status-${project.status}`}>
                            {statusLabels[project.status]}
                          </span>
                        </button>

                        <div className="project-row-actions">
                          <button
                            className="project-row-menu-toggle"
                            type="button"
                            aria-expanded={menuProjectId === project.id}
                            aria-label={`项目更多操作：${project.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setMenuProjectId((current) => (current === project.id ? null : project.id));
                            }}
                          >
                            更多
                          </button>

                          {menuProjectId === project.id ? (
                            <div className="project-row-menu" aria-label={`${project.title}更多操作`}>
                              <button
                                type="button"
                                onClick={() => startRename(project)}
                              >
                                重命名
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
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
