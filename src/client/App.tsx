import { useEffect, useMemo, useState } from "react";
import {
  addTaskChildApi,
  createProgressObject,
  createProjectApi,
  exitFocusModeApi,
  fillSlotApi,
  fetchState,
  hideProjectApi,
  reopenProjectApi,
  selectFocusProjectApi,
  transitionProgressObjectApi,
  updateTaskStatusApi,
  updateProjectStatusApi
} from "./api";
import { CurrentPanel } from "./components/CurrentPanel";
import { FeedbackPage } from "./components/FeedbackPage";
import { FocusModePanel } from "./components/FocusModePanel";
import { NewProjectPanel } from "./components/NewProjectPanel";
import { ParallelLimitGate } from "./components/ParallelLimitGate";
import { ProjectDetail } from "./components/ProjectDetail";
import { ProjectList } from "./components/ProjectList";
import { TemplateManager } from "./components/TemplateManager";
import "./styles.css";
import type { AppState, ProjectStatus, TaskNodeStatus } from "../shared/types";
import { hasParallelLimitGate } from "../shared/parallelLimitGate";

type AppView = "workbench" | "new" | "templates" | "feedback";

const navItems: Array<{ id: AppView; label: string }> = [
  { id: "workbench", label: "工作台" },
  { id: "new", label: "新建任务" },
  { id: "templates", label: "模板" },
  { id: "feedback", label: "反馈" }
];

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<AppView>("workbench");
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    fetchState()
      .then((nextState) => {
        if (!isCurrent) {
          return;
        }

        setState(nextState);
        setSelectedProjectId((currentId) => resolveSelectedProjectId(nextState, currentId));
      })
      .catch((caught: unknown) => {
        if (!isCurrent) {
          return;
        }

        setError(caught instanceof Error ? caught.message : "无法加载数据");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const visibleProjects = useMemo(
    () => state?.projects.filter((project) => !project.hiddenAt) ?? [],
    [state]
  );
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) {
      return undefined;
    }

    return visibleProjects.find((project) => project.id === selectedProjectId);
  }, [selectedProjectId, visibleProjects]);
  const showParallelLimitGate = state ? hasParallelLimitGate(state.warnings, state.focusMode) : false;
  const activeProjects = visibleProjects.filter((project) => project.status === "active");
  const focusSelectedProjectId = state?.focusMode.status === "active" ? state.focusMode.selectedProjectId : undefined;
  const isFocusModeActive = state?.focusMode.status === "active";
  const isSelectedProjectReadOnly = Boolean(
    isFocusModeActive && selectedProject && selectedProject.id !== focusSelectedProjectId
  );

  async function runMutation(
    mutation: () => Promise<AppState>,
    options?: { preferredProjectId?: string; nextView?: AppView }
  ) {
    setError(null);

    try {
      const nextState = await mutation();
      setState(nextState);
      if (options?.nextView) {
        setView(options.nextView);
      }
      setSelectedProjectId((currentId) => {
        return resolveSelectedProjectId(nextState, currentId, options?.preferredProjectId);
      });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "操作失败");
    }
  }

  function handleUpdateProjectStatus(projectId: string, status: ProjectStatus) {
    return runMutation(() => updateProjectStatusApi(projectId, status));
  }

  function handleReopenProject(projectId: string) {
    return runMutation(() => reopenProjectApi(projectId));
  }

  function handleHideProject(projectId: string) {
    return runMutation(() => hideProjectApi(projectId));
  }

  function handleExitFocusMode() {
    return runMutation(() => exitFocusModeApi());
  }

  async function handleCreateProject(input: Parameters<typeof createProjectApi>[0]) {
    setError(null);

    try {
      const result = await createProjectApi(input);
      setState(result.state);
      setSelectedProjectId(result.project.id);
      setView("workbench");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "创建任务失败");
    }
  }

  function handleCreateProgressObject(projectId: string, title: string, fields: Record<string, string>) {
    return runMutation(() => createProgressObject(projectId, { title, fields }));
  }

  function handleTransitionProgressObject(projectId: string, progressObjectId: string, nextStateId: string) {
    return runMutation(() =>
      transitionProgressObjectApi(projectId, progressObjectId, {
        nextStateId,
        note: "界面更新状态"
      })
    );
  }

  function handleFillSlot(projectId: string, slotId: string, progressObjectId: string) {
    return runMutation(() => fillSlotApi(projectId, slotId, { progressObjectId }));
  }

  function handleAddTaskChild(projectId: string, taskId: string, title: string) {
    return runMutation(() => addTaskChildApi(projectId, taskId, { title }));
  }

  function handleUpdateTaskStatus(projectId: string, taskId: string, status: TaskNodeStatus) {
    return runMutation(() => updateTaskStatusApi(projectId, taskId, status));
  }

  function handleSelectFocusProject(input: {
    projectId: string;
    selectedActionId?: string;
    customActionLabel?: string;
  }) {
    return runMutation(() => selectFocusProjectApi(input), {
      preferredProjectId: input.projectId,
      nextView: "workbench"
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">本地进度工作台</p>
          <h1>任务进度</h1>
        </div>
        <nav className="app-nav" aria-label="主导航">
          {navItems.map((item) => (
            <button
              className={view === item.id ? "active" : ""}
              key={item.id}
              type="button"
              disabled={item.id === "new" && isFocusModeActive}
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {error ? (
        <section className="error" role="alert">
          {error}
        </section>
      ) : null}

      {state && showParallelLimitGate ? (
        <ParallelLimitGate projects={activeProjects} onSelect={handleSelectFocusProject} />
      ) : null}

      {state ? <FocusModePanel state={state} onExit={handleExitFocusMode} /> : null}

      {!state && !error ? (
        <section className="panel loading">加载中...</section>
      ) : null}

      {state && view === "workbench" ? (
        <div className="layout">
          <aside className="left-column">
            <CurrentPanel state={state} onViewFeedback={() => setView("feedback")} />
            <ProjectList
              projects={visibleProjects}
              selectedProjectId={selectedProject?.id}
              onSelectProject={setSelectedProjectId}
            />
            <TemplateManager templates={state.templates} />
          </aside>

          <ProjectDetail
            project={selectedProject}
            onCreateProgressObject={handleCreateProgressObject}
            onFillSlot={handleFillSlot}
            onTransitionProgressObject={handleTransitionProgressObject}
            onUpdateProjectStatus={handleUpdateProjectStatus}
            onReopenProject={handleReopenProject}
            onHideProject={handleHideProject}
            onAddTaskChild={handleAddTaskChild}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            isReadOnly={isSelectedProjectReadOnly}
            readOnlyMessage={isSelectedProjectReadOnly ? "收束模式下该项目只读" : undefined}
          />
        </div>
      ) : null}

      {state && view === "new" ? (
        <div className="single-layout">
          <NewProjectPanel templates={state.templates} onCreateProject={handleCreateProject} />
        </div>
      ) : null}

      {state && view === "templates" ? (
        <div className="single-layout">
          <section className="page-heading" aria-labelledby="templates-page-title">
            <div className="page-header">
              <p className="eyebrow">复用结构</p>
              <h2 id="templates-page-title">模板</h2>
            </div>
          </section>
          <TemplateManager templates={state.templates} />
        </div>
      ) : null}

      {state && view === "feedback" ? (
        <div className="single-layout">
          <FeedbackPage state={state} selectedProjectId={selectedProjectId} />
        </div>
      ) : null}
    </main>
  );
}

function resolveSelectedProjectId(
  nextState: AppState,
  currentId?: string,
  preferredProjectId?: string
): string | undefined {
  const visibleProjects = nextState.projects.filter((project) => !project.hiddenAt);
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));

  if (preferredProjectId && visibleProjectIds.has(preferredProjectId)) {
    return preferredProjectId;
  }

  if (currentId && visibleProjectIds.has(currentId)) {
    return currentId;
  }

  if (
    nextState.focusMode.status === "active" &&
    nextState.focusMode.selectedProjectId &&
    visibleProjectIds.has(nextState.focusMode.selectedProjectId)
  ) {
    return nextState.focusMode.selectedProjectId;
  }

  return visibleProjects[0]?.id;
}
