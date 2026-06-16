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

export function ProjectList({ projects, selectedProjectId, onSelectProject }: ProjectListProps) {
  return (
    <section className="panel" aria-labelledby="project-list-title">
      <div className="panel-header">
        <h2 id="project-list-title">项目列表</h2>
        <span className="muted-count">{projects.length}</span>
      </div>

      <div className="project-list">
        {projects.length > 0 ? (
          projects.map((project) => (
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
          ))
        ) : (
          <p className="empty-state">暂无项目</p>
        )}
      </div>
    </section>
  );
}
