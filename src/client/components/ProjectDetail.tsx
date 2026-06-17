import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Project, ProgressObjectInstance, ProjectStatus, TaskNode, TaskNodeStatus } from "../../shared/types";
import {
  isWeeklyGithubProject,
  weeklyGithubSelectedCandidates
} from "../../shared/weeklyGithubProject";

interface ProjectDetailProps {
  project?: Project;
  onCreateProgressObject?: (projectId: string, title: string, fields: Record<string, string>) => Promise<void>;
  onFillSlot?: (projectId: string, slotId: string, progressObjectId: string) => Promise<void>;
  onTransitionProgressObject?: (projectId: string, progressObjectId: string, nextStateId: string) => Promise<void>;
  onUpdateProjectStatus?: (projectId: string, status: ProjectStatus) => Promise<void>;
  onReopenProject?: (projectId: string) => Promise<void>;
  onHideProject?: (projectId: string) => Promise<void>;
  onAddTaskChild?: (projectId: string, taskId: string, title: string) => Promise<void>;
  onUpdateTaskStatus?: (projectId: string, taskId: string, status: TaskNodeStatus) => Promise<void>;
  isReadOnly?: boolean;
  readOnlyMessage?: string;
}

interface TaskContextMenuState {
  taskId: string;
  x: number;
  y: number;
}

const projectStatusLabels: Record<Extract<ProjectStatus, "not_started" | "active" | "paused">, string> = {
  not_started: "待开始",
  active: "进行中",
  paused: "暂停"
};

const taskStatusLabels: Record<TaskNodeStatus, string> = {
  not_started: "未开始",
  active: "进行中",
  completed: "完成",
  dropped: "不做了",
  unhandled: "未处理"
};

const closedTaskStatuses = new Set<TaskNodeStatus>(["completed", "dropped", "unhandled"]);

function findProgressObject(objects: ProgressObjectInstance[], progressObjectId?: string) {
  if (!progressObjectId) {
    return undefined;
  }

  return objects.find((object) => object.id === progressObjectId);
}

function findTaskNode(node: TaskNode, taskId?: string): TaskNode | undefined {
  if (!taskId) {
    return undefined;
  }

  if (node.id === taskId) {
    return node;
  }

  for (const child of node.children) {
    const found = findTaskNode(child, taskId);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function renderSlotValue(objects: ProgressObjectInstance[], progressObjectId?: string) {
  if (!progressObjectId) {
    return "未填";
  }

  const object = findProgressObject(objects, progressObjectId);
  return object?.title ?? `对象缺失：${progressObjectId}`;
}

function findTaskNodeByTitle(rootTask: TaskNode, title: string) {
  return rootTask.children.find((task) => task.title === title);
}

function weeklyCandidateStatusLabel(status: TaskNodeStatus) {
  if (status === "completed") {
    return "入选";
  }

  if (status === "dropped") {
    return "淘汰";
  }

  if (status === "unhandled") {
    return "暂缓";
  }

  if (status === "active") {
    return "进行中";
  }

  return "未定";
}

function nextStatusAction(status: ProjectStatus) {
  if (status === "not_started" || status === "paused") {
    return { label: "开始项目", nextStatus: "active" as const };
  }

  if (status === "active") {
    return { label: "暂停项目", nextStatus: "paused" as const };
  }

  return undefined;
}

function reopenProjectLabel(status?: Extract<ProjectStatus, "not_started" | "active" | "paused">) {
  if (!status) {
    return "恢复项目";
  }

  return `恢复为${projectStatusLabels[status]}`;
}

function countTaskChildren(task: TaskNode) {
  const total = task.children.length;
  const closed = task.children.filter((child) => closedTaskStatuses.has(child.status)).length;
  return { closed, total };
}

function hasOpenDescendants(task: TaskNode): boolean {
  return task.children.some((child) => !closedTaskStatuses.has(child.status) || hasOpenDescendants(child));
}

function playCompletionTone() {
  const AudioContextClass =
    globalThis.AudioContext ??
    (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  try {
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency?.setValueAtTime?.(880, context.currentTime);
    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain?.setValueAtTime?.(0.0001, context.currentTime);
    gain.gain?.linearRampToValueAtTime?.(0.12, context.currentTime + 0.01);
    gain.gain?.linearRampToValueAtTime?.(0.0001, context.currentTime + 0.18);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.18);
  } catch {
    // Ignore audio capability failures and keep the task mutation successful.
  }
}

export function ProjectDetail({
  project,
  onCreateProgressObject,
  onFillSlot,
  onTransitionProgressObject,
  onUpdateProjectStatus,
  onReopenProject,
  onHideProject,
  onAddTaskChild,
  onUpdateTaskStatus,
  isReadOnly = false,
  readOnlyMessage
}: ProjectDetailProps) {
  const [progressObjectTitle, setProgressObjectTitle] = useState("");
  const [progressObjectUrl, setProgressObjectUrl] = useState("");
  const [slotSelections, setSlotSelections] = useState<Record<string, string>>({});
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});
  const [taskContextMenu, setTaskContextMenu] = useState<TaskContextMenuState | undefined>();

  useEffect(() => {
    if (!taskContextMenu) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest(".task-context-menu")) {
        return;
      }

      setTaskContextMenu(undefined);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTaskContextMenu(undefined);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [taskContextMenu]);

  if (!project) {
    return (
      <section className="panel detail-panel" aria-labelledby="detail-title">
        <p className="eyebrow">项目详情</p>
        <h2 id="detail-title">选择一个项目</h2>
      </section>
    );
  }

  const filledSlots = project.slots.filter((slot) => slot.progressObjectId).length;
  const taskProgress = project.taskTree ? countTaskChildren(project.taskTree) : undefined;
  const projectId = project.id;
  const progressObjectName = project.templateSnapshot.progressObject?.name ?? "推进对象";
  const progressObjectStates = project.templateSnapshot.progressObject?.states ?? [];
  const stateNameById = new Map(progressObjectStates.map((state) => [state.id, state.name]));
  const statusAction = nextStatusAction(project.status);
  const canCreateProgressObject = Boolean(project.templateSnapshot.progressObject && onCreateProgressObject);
  const fillableProgressObjects = project.progressObjects.filter((object) => {
    const state = progressObjectStates.find((item) => item.id === object.stateId);
    return state?.category === "concluded";
  });
  const rootTask = project.taskTree;
  const isWeeklyProject = isWeeklyGithubProject(project);
  const weeklyHandsOnTask = rootTask ? findTaskNodeByTitle(rootTask, "亲测候选仓库") : undefined;
  const weeklyPickTask = rootTask ? findTaskNodeByTitle(rootTask, "确定本周 5 个推荐") : undefined;
  const weeklySelectedCandidates = rootTask ? weeklyGithubSelectedCandidates(rootTask) : [];
  const contextTask = rootTask ? findTaskNode(rootTask, taskContextMenu?.taskId) : undefined;

  async function handleCreateProgressObject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = progressObjectTitle.trim();
    if (!title || !onCreateProgressObject || isReadOnly) {
      return;
    }

    await onCreateProgressObject(projectId, title, {
      repoName: title,
      url: progressObjectUrl.trim()
    });
    setProgressObjectTitle("");
    setProgressObjectUrl("");
  }

  async function handleFillSlot(slotId: string) {
    const progressObjectId = slotSelections[slotId];
    if (!progressObjectId || !onFillSlot || isReadOnly) {
      return;
    }

    await onFillSlot(projectId, slotId, progressObjectId);
    setSlotSelections((current) => {
      const next = { ...current };
      delete next[slotId];
      return next;
    });
  }

  async function handleAddTaskChild(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();

    const title = taskTitles[taskId]?.trim();
    if (!title || !onAddTaskChild || isReadOnly) {
      return;
    }

    await onAddTaskChild(projectId, taskId, title);
    setTaskTitles((current) => ({ ...current, [taskId]: "" }));
  }

  async function handleTaskStatus(task: TaskNode, status: TaskNodeStatus, options?: { playSound?: boolean }) {
    if (!onUpdateTaskStatus || isReadOnly) {
      return;
    }

    if (status === "completed" && hasOpenDescendants(task)) {
      const unresolvedCount = task.children.filter((child) => !closedTaskStatuses.has(child.status)).length;
      const shouldContinue = window.confirm(`还有 ${unresolvedCount} 个未处理的小任务，仍然完成这个任务吗？`);
      if (!shouldContinue) {
        return;
      }
    }

    await onUpdateTaskStatus(projectId, task.id, status);
    setTaskContextMenu(undefined);

    if (status === "completed" && options?.playSound) {
      playCompletionTone();
    }
  }

  async function handleTaskCheckbox(task: TaskNode, checked: boolean) {
    if (checked) {
      await handleTaskStatus(task, "completed", { playSound: true });
      return;
    }

    if (task.status === "completed") {
      await handleTaskStatus(task, "not_started");
    }
  }

  function renderWeeklyCandidateActions(task: TaskNode) {
    if (!onUpdateTaskStatus || isReadOnly) {
      return (
        <div className="todo-meta">
          <span className={`task-status status-${task.status}`}>{weeklyCandidateStatusLabel(task.status)}</span>
        </div>
      );
    }

    return (
      <div className="object-actions">
        <button
          className="secondary-action compact"
          type="button"
          disabled={task.status === "completed"}
          onClick={() => void handleTaskStatus(task, "completed")}
        >
          将 {task.title} 标记为入选
        </button>
        <button
          className="secondary-action compact"
          type="button"
          disabled={task.status === "dropped"}
          onClick={() => void handleTaskStatus(task, "dropped")}
        >
          将 {task.title} 标记为淘汰
        </button>
        <button
          className="secondary-action compact"
          type="button"
          disabled={task.status === "unhandled"}
          onClick={() => void handleTaskStatus(task, "unhandled")}
        >
          将 {task.title} 标记为暂缓
        </button>
      </div>
    );
  }

  function renderTaskNode(task: TaskNode, depth: number): JSX.Element {
    const progress = countTaskChildren(task);
    const isClosed = closedTaskStatuses.has(task.status);
    const isChecked = isWeeklyCandidateChildLike(task) ? isClosed : task.status === "completed";
    const isWeeklyCandidateChild = Boolean(
      isWeeklyProject && weeklyHandsOnTask && weeklyHandsOnTask.children.some((candidate) => candidate.id === task.id)
    );
    const canAddChild = depth < 3 && !isClosed && Boolean(onAddTaskChild) && !isReadOnly;
    const canStart = task.status === "not_started" && Boolean(onUpdateTaskStatus) && !isReadOnly;
    const canToggleCheckbox =
      Boolean(onUpdateTaskStatus) &&
      task.status !== "dropped" &&
      task.status !== "unhandled" &&
      !isReadOnly &&
      !isWeeklyCandidateChild;
    const hideTaskAddForm = Boolean(
      isWeeklyProject && ((weeklyPickTask && weeklyPickTask.id === task.id) || isWeeklyCandidateChild)
    );

    return (
      <li className={`task-node depth-${depth}`} key={task.id}>
        <article
          className={`task-card todo-card${isChecked ? " completed" : ""}${task.status === "dropped" ? " dropped" : ""}`}
          onContextMenu={(event) => {
            if (isReadOnly) {
              return;
            }
            event.preventDefault();
            setTaskContextMenu({ taskId: task.id, x: event.clientX, y: event.clientY });
          }}
        >
          <div className="todo-line">
            <label className={`todo-check${isChecked ? " checked" : ""}${!canToggleCheckbox ? " disabled" : ""}`}>
                <input
                  aria-label={task.title}
                  checked={isChecked}
                  disabled={!canToggleCheckbox}
                  type="checkbox"
                onChange={(event) => void handleTaskCheckbox(task, event.target.checked)}
              />
              <span className="todo-title">{task.title}</span>
            </label>

            <div className="todo-meta">
              {isWeeklyCandidateChild ? (
                <span className={`task-status status-${task.status}`}>{weeklyCandidateStatusLabel(task.status)}</span>
              ) : progress.total > 0 ? (
                <span className="task-progress">
                  子任务 {progress.closed} / {progress.total}
                </span>
              ) : null}
              {canStart ? (
                <button
                  className="text-action task-start"
                  type="button"
                  onClick={() => void handleTaskStatus(task, "active")}
                >
                  开始
                </button>
              ) : null}
              {!isWeeklyCandidateChild && task.status !== "not_started" && task.status !== "completed" ? (
                <span className={`task-status status-${task.status}`}>{taskStatusLabels[task.status]}</span>
              ) : null}
            </div>
          </div>

          {isWeeklyCandidateChild ? renderWeeklyCandidateActions(task) : null}

          {canAddChild && !hideTaskAddForm ? (
            <form className="task-add-form" onSubmit={(event) => handleAddTaskChild(event, task.id)}>
              <label>
                <span>添加到{task.title}</span>
                <input
                  disabled={isReadOnly}
                  value={taskTitles[task.id] ?? ""}
                  onChange={(event) => setTaskTitles((current) => ({ ...current, [task.id]: event.target.value }))}
                  placeholder="写下一个小任务"
                />
              </label>
              <button className="primary-action compact" type="submit" disabled={!taskTitles[task.id]?.trim()}>
                添加小任务
              </button>
            </form>
          ) : null}
        </article>

        {isWeeklyProject && weeklyPickTask && weeklyPickTask.id === task.id ? (
          <div className="object-list">
            <p className="metric-label">已入选 {weeklySelectedCandidates.length}</p>
            {weeklySelectedCandidates.length > 0 ? (
              weeklySelectedCandidates.map((candidate) => (
                <div className="object-row" key={candidate.id}>
                  <div className="object-main">
                    <span className="object-title">{candidate.title}</span>
                    <span className="object-state">入选</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">暂无入选仓库</p>
            )}
          </div>
        ) : task.children.length > 0 ? (
          <ol className="task-tree nested">{task.children.map((child) => renderTaskNode(child, depth + 1))}</ol>
        ) : null}
      </li>
    );
  }

  function isWeeklyCandidateChildLike(task: TaskNode) {
    return Boolean(isWeeklyProject && weeklyHandsOnTask && weeklyHandsOnTask.children.some((candidate) => candidate.id === task.id));
  }

  return (
    <section className="panel detail-panel" aria-labelledby="detail-title">
      <div className="detail-header">
        <div>
          <p className="eyebrow">项目详情</p>
          <h2 id="detail-title">{project.title}</h2>
        </div>
        <span className="status-badge">
          {taskProgress ? `任务 ${taskProgress.closed} / ${taskProgress.total}` : `槽位 ${filledSlots} / ${project.slots.length}`}
        </span>
      </div>

      <div className="detail-actions" aria-label="项目操作">
        {project.status === "completed" || project.status === "abandoned" ? (
          <button
            className="secondary-action"
            type="button"
            disabled={isReadOnly}
            onClick={() => onReopenProject?.(projectId)}
          >
            {reopenProjectLabel(project.completedFromStatus)}
          </button>
        ) : (
          <>
            {statusAction ? (
              <button
                className="primary-action"
                type="button"
                disabled={isReadOnly}
                onClick={() => onUpdateProjectStatus?.(projectId, statusAction.nextStatus)}
              >
                {statusAction.label}
              </button>
            ) : null}
            <button
              className="secondary-action"
              type="button"
              disabled={isReadOnly}
              onClick={() => onUpdateProjectStatus?.(projectId, "completed")}
            >
              标记完成
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={isReadOnly}
              onClick={() => onUpdateProjectStatus?.(projectId, "abandoned")}
            >
              放弃项目
            </button>
          </>
        )}
        <button
          className="secondary-action"
          type="button"
          disabled={isReadOnly}
          onClick={() => {
            if (!onHideProject) {
              return;
            }

            const shouldHide = window.confirm("确定要隐藏这个项目吗？隐藏后它会从界面中移除，但底层历史数据会保留。");
            if (!shouldHide) {
              return;
            }

            void onHideProject(projectId);
          }}
        >
          隐藏项目
        </button>
      </div>

      {isReadOnly && readOnlyMessage ? <p className="readonly-banner">{readOnlyMessage}</p> : null}

      {rootTask ? (
        <section className="detail-section" aria-labelledby="task-tree-title">
          <h3 id="task-tree-title">任务拆解</h3>

          {!isWeeklyProject ? (
            <form className="task-add-form root-task-form" onSubmit={(event) => handleAddTaskChild(event, rootTask.id)}>
              <label>
                <span>添加到{project.title}</span>
                <input
                  disabled={isReadOnly}
                  value={taskTitles[rootTask.id] ?? ""}
                  onChange={(event) => setTaskTitles((current) => ({ ...current, [rootTask.id]: event.target.value }))}
                  placeholder="写下一个小任务"
                />
              </label>
              <button
                className="primary-action compact"
                type="submit"
                disabled={isReadOnly || !taskTitles[rootTask.id]?.trim()}
              >
                添加小任务
              </button>
            </form>
          ) : null}

          {rootTask.children.length > 0 ? (
            <ol className="task-tree">{rootTask.children.map((task) => renderTaskNode(task, 2))}</ol>
          ) : (
            <p className="empty-state">暂无任务，先添加一个小任务</p>
          )}

          {taskContextMenu && contextTask ? (
            <div
              className="task-context-menu"
              role="menu"
              style={{ left: taskContextMenu.x, top: taskContextMenu.y }}
            >
              {contextTask.status !== "dropped" && contextTask.status !== "unhandled" ? (
                <button role="menuitem" type="button" onClick={() => void handleTaskStatus(contextTask, "dropped")}>
                  不做了
                </button>
              ) : null}
              {contextTask.status !== "not_started" ? (
                <button role="menuitem" type="button" onClick={() => void handleTaskStatus(contextTask, "not_started")}>
                  恢复为待办
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <section className="detail-section" aria-labelledby="stage-progress-title">
            <h3 id="stage-progress-title">阶段进度</h3>
            {project.stages.length > 0 ? (
              <div className="stage-track">
                {project.stages.map((stage) => (
                  <span className={`stage-pill ${stage.status}`} key={stage.id}>
                    {stage.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="empty-state">暂无阶段</p>
            )}
          </section>

          <section className="detail-section" aria-labelledby="progress-objects-title">
            <h3 id="progress-objects-title">{progressObjectName}</h3>
            {canCreateProgressObject ? (
              <form className="inline-form" onSubmit={handleCreateProgressObject}>
                <label>
                  <span>{progressObjectName}名称</span>
                  <input
                    disabled={isReadOnly}
                    value={progressObjectTitle}
                    onChange={(event) => setProgressObjectTitle(event.target.value)}
                    placeholder="owner/repo"
                  />
                </label>
                <label>
                  <span>GitHub URL</span>
                  <input
                    disabled={isReadOnly}
                    value={progressObjectUrl}
                    onChange={(event) => setProgressObjectUrl(event.target.value)}
                    placeholder="https://github.com/owner/repo"
                  />
                </label>
                <button className="primary-action" type="submit" disabled={isReadOnly || !progressObjectTitle.trim()}>
                  添加候选
                </button>
              </form>
            ) : null}
            {project.progressObjects.length > 0 ? (
              <div className="object-list">
                {project.progressObjects.map((object) => (
                  <div className="object-row" key={object.id}>
                    <div className="object-main">
                      <span className="object-title">{object.title}</span>
                      <span className="object-state">{stateNameById.get(object.stateId) ?? `未知状态：${object.stateId}`}</span>
                    </div>
                    {progressObjectStates.length > 0 && onTransitionProgressObject ? (
                      <div className="object-actions">
                        {progressObjectStates
                          .filter((state) => state.id !== object.stateId)
                          .map((state) => (
                            <button
                              className="secondary-action compact"
                              key={state.id}
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => onTransitionProgressObject(projectId, object.id, state.id)}
                            >
                              将 {object.title} 标记为{state.name}
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">暂无{progressObjectName}</p>
            )}
          </section>

          <section className="detail-section" aria-labelledby="slots-title">
            <h3 id="slots-title">成果槽位</h3>
            {project.slots.length > 0 ? (
              <div className="slot-grid">
                {project.slots.map((slot) => (
                  <article className="slot-card" key={slot.id}>
                    <span className="slot-name">{slot.name}</span>
                    <strong>{renderSlotValue(project.progressObjects, slot.progressObjectId)}</strong>
                    {!slot.progressObjectId && onFillSlot ? (
                      <div className="slot-controls">
                        <label>
                          <span>选择填入{slot.name} 的候选</span>
                          <select
                            disabled={isReadOnly}
                            value={slotSelections[slot.id] ?? ""}
                            onChange={(event) =>
                              setSlotSelections((current) => ({ ...current, [slot.id]: event.target.value }))
                            }
                          >
                            <option value="">选择候选</option>
                            {fillableProgressObjects.map((object) => (
                              <option key={object.id} value={object.id}>
                                {object.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="primary-action compact"
                          type="button"
                          disabled={isReadOnly || !slotSelections[slot.id]}
                          onClick={() => handleFillSlot(slot.id)}
                        >
                          填入{slot.name}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">暂无成果槽位</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
