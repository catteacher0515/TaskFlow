import { useEffect, useMemo, useState } from "react";
import {
  addTaskChildApi,
  createProgressObject,
  createProjectApi,
  fillSlotApi,
  fetchState,
  transitionProgressObjectApi,
  updateTaskStatusApi,
  updateProjectStatusApi
} from "./api";
import { CurrentPanel } from "./components/CurrentPanel";
import { FeedbackPage } from "./components/FeedbackPage";
import { FocusModePanel } from "./components/FocusModePanel";
import { NewProjectPanel } from "./components/NewProjectPanel";
import { ProjectDetail } from "./components/ProjectDetail";
import { ProjectList } from "./components/ProjectList";
import { TemplateManager } from "./components/TemplateManager";
import "./styles.css";
import type { AppState, ProjectStatus, TaskNodeStatus } from "../shared/types";

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
        setSelectedProjectId((currentId) => currentId ?? nextState.projects[0]?.id);
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

  const selectedProject = useMemo(() => {
    if (!state || !selectedProjectId) {
      return undefined;
    }

    return state.projects.find((project) => project.id === selectedProjectId);
  }, [selectedProjectId, state]);

  async function runMutation(mutation: () => Promise<AppState>) {
    setError(null);

    try {
      const nextState = await mutation();
      setState(nextState);
      setSelectedProjectId((currentId) => {
        if (currentId && nextState.projects.some((project) => project.id === currentId)) {
          return currentId;
        }

        return nextState.projects[0]?.id;
      });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "操作失败");
    }
  }

  function handleUpdateProjectStatus(projectId: string, status: ProjectStatus) {
    return runMutation(() => updateProjectStatusApi(projectId, status));
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

      {state ? <FocusModePanel state={state} /> : null}

      {!state && !error ? (
        <section className="panel loading">加载中...</section>
      ) : null}

      {state && view === "workbench" ? (
        <div className="layout">
          <aside className="left-column">
            <CurrentPanel state={state} onViewFeedback={() => setView("feedback")} />
            <ProjectList
              projects={state.projects}
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
            onAddTaskChild={handleAddTaskChild}
            onUpdateTaskStatus={handleUpdateTaskStatus}
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
