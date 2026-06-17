import { useState } from "react";
import type { Project } from "../../shared/types";

interface ParallelLimitGateProps {
  projects: Project[];
  onSelect: (input: { projectId: string; selectedActionId?: string; customActionLabel?: string }) => Promise<void>;
}

export function ParallelLimitGate({ projects, onSelect }: ParallelLimitGateProps) {
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});

  return (
    <section className="parallel-limit-gate" aria-labelledby="parallel-limit-gate-title">
      <div className="parallel-limit-gate-backdrop" />
      <div className="parallel-limit-gate-panel">
        <p className="eyebrow">强约束</p>
        <h2 id="parallel-limit-gate-title">进行中项目超出上限，先只选一个继续</h2>
        <p className="gate-copy">先选一个项目，其他任务暂时不要再推进。</p>

        <div className="gate-project-list">
          {projects.map((project) => (
            <article className="gate-project-card" key={project.id}>
              <div className="gate-project-header">
                <strong>{project.title}</strong>
                <span className="project-status status-active">进行中</span>
              </div>

              {project.templateSnapshot.minimumActions.length > 0 ? (
                <div className="gate-actions">
                  {project.templateSnapshot.minimumActions.map((action) => (
                    <button
                      className="primary-action compact"
                      key={action.id}
                      type="button"
                      onClick={() => onSelect({ projectId: project.id, selectedActionId: action.id })}
                    >
                      选这个项目：{action.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="gate-custom-action">
                <label>
                  <span>自定义动作</span>
                  <input
                    value={customLabels[project.id] ?? ""}
                    onChange={(event) =>
                      setCustomLabels((current) => ({ ...current, [project.id]: event.target.value }))
                    }
                    placeholder="例如：先测一个仓库"
                  />
                </label>
                <button
                  className="secondary-action compact"
                  type="button"
                  disabled={!customLabels[project.id]?.trim()}
                  onClick={() =>
                    onSelect({
                      projectId: project.id,
                      customActionLabel: customLabels[project.id]?.trim()
                    })
                  }
                >
                  选这个项目
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
