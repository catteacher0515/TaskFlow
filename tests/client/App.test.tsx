import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/client/App";
import type { AppState, Project } from "../../src/shared/types";

const appState: AppState = {
  settings: {
    dataVersion: 1,
    activeProjectLimit: 3,
    defaultStagnationDays: 7
  },
  templates: [],
  projects: [
    {
      id: "project-1",
      title: "每周 GitHub 精选 2026-W25",
      status: "active",
      templateId: "weekly-github-picks",
      templateSnapshot: {
        templateId: "weekly-github-picks",
        templateName: "每周 GitHub 精选",
        stages: [
          { id: "collect", name: "候选收集" },
          { id: "hands_on", name: "亲测" }
        ],
        progressObject: {
          name: "候选仓库",
          fields: ["repoName", "url"],
          states: [
            { id: "untested", name: "未测", category: "open" },
            { id: "selected", name: "入选", category: "concluded" }
          ],
          feedbackStateIds: ["selected"]
        },
        slots: [
          { id: "slot-1", name: "槽位 1" },
          { id: "slot-2", name: "槽位 2" }
        ],
        minimumActions: [],
        warningRules: {}
      },
      recurrence: {
        kind: "weekly"
      },
      stages: [
        { id: "collect", name: "候选收集", status: "completed" },
        { id: "hands_on", name: "亲测", status: "active" }
      ],
      progressObjects: [
        {
          id: "repo-1",
          title: "owner/repo",
          stateId: "selected",
          fields: { repoName: "owner/repo", url: "https://github.com/owner/repo" },
          createdAt: "2026-06-15T00:00:00.000Z",
          updatedAt: "2026-06-15T00:00:00.000Z"
        },
        {
          id: "repo-2",
          title: "another/repo",
          stateId: "untested",
          fields: { repoName: "another/repo" },
          createdAt: "2026-06-15T00:00:00.000Z",
          updatedAt: "2026-06-15T00:00:00.000Z"
        }
      ],
      slots: [
        {
          id: "slot-1",
          name: "槽位 1",
          progressObjectId: "repo-1",
          filledAt: "2026-06-15T01:00:00.000Z"
        },
        {
          id: "slot-2",
          name: "槽位 2"
        }
      ],
      createdAt: "2026-06-15T00:00:00.000Z",
      updatedAt: "2026-06-15T00:00:00.000Z"
    },
    {
      id: "project-2",
      title: "暂停的项目",
      status: "paused",
      templateSnapshot: {
        templateName: "普通项目",
        stages: [],
        slots: [],
        minimumActions: [],
        warningRules: {}
      },
      recurrence: {
        kind: "none"
      },
      stages: [],
      progressObjects: [],
      slots: [],
      createdAt: "2026-06-15T00:00:00.000Z",
      updatedAt: "2026-06-15T00:00:00.000Z"
    }
  ],
  activity: [
    {
      id: "activity-1",
      projectId: "project-1",
      kind: "small",
      message: "补齐候选仓库列表",
      createdAt: "2026-06-15T08:00:00.000Z"
    },
    {
      id: "activity-2",
      projectId: "project-1",
      kind: "big",
      message: "完成本周精选初稿",
      createdAt: "2026-06-15T09:00:00.000Z"
    }
  ],
  warnings: [],
  focusMode: {
    status: "active",
    selectedProjectId: "project-1"
  }
};

const genericTemplate = {
  id: "generic-task",
  name: "通用任务",
  description: "适合没有固定候选池的普通任务。",
  stages: [],
  slots: [],
  minimumActions: [
    { id: "start-five-minutes", label: "先推进 5 分钟" },
    { id: "record-one-result", label: "记录一个结果" }
  ],
  recurrence: {
    supportedRules: ["none", "daily", "weekly", "monthly", "workdays", "custom_interval"],
    defaultRule: { kind: "none" }
  },
  warningRules: {
    parallelLimit: { useGlobalLimit: true },
    stagnation: { daysWithoutActivity: 7 }
  }
} satisfies AppState["templates"][number];

describe("App", () => {
  function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  function mockState(nextState: AppState = appState) {
    globalThis.fetch = vi.fn(async () => jsonResponse(nextState));
  }

  function replaceProject(project: Project, baseState: AppState = appState): AppState {
    return {
      ...baseState,
      projects: baseState.projects.map((item) => (item.id === project.id ? project : item))
    };
  }

  beforeEach(() => {
    mockState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the main dashboard from API state", async () => {
    render(<App />);

    expect(await screen.findByText("当前面板")).toBeInTheDocument();
    expect(screen.getByText("进行中 1 / 3")).toBeInTheDocument();
    expect(screen.getAllByText("每周 GitHub 精选 2026-W25").length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith("/api/state", {
      headers: { "Content-Type": "application/json" }
    });
  });

  it("shows loading and API errors", async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectRequest = reject;
        })
    );

    render(<App />);

    expect(screen.getByText("加载中...")).toBeInTheDocument();
    rejectRequest(new Error("读取失败"));

    expect(await screen.findByRole("alert")).toHaveTextContent("读取失败");
    expect(screen.queryByText("加载中...")).not.toBeInTheDocument();
  });

  it("shows empty states when there are no projects or activity", async () => {
    mockState({
      ...appState,
      projects: [],
      activity: [],
      focusMode: { status: "inactive" }
    });

    render(<App />);

    expect(await screen.findByText("暂无反馈")).toBeInTheDocument();
    expect(screen.getByText("暂无项目")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "选择一个项目" })).toBeInTheDocument();
  });

  it("shows templates and their configured progress object", async () => {
    mockState({
      ...appState,
      templates: [
        {
          id: "weekly-github-picks",
          name: "每周 GitHub 精选",
          description: "亲测候选仓库",
          stages: [],
          progressObject: {
            name: "候选仓库",
            fields: [],
            states: [
              { id: "untested", name: "未测", category: "open" },
              { id: "selected", name: "入选", category: "concluded" }
            ],
            feedbackStateIds: ["selected"]
          },
          slots: [],
          minimumActions: [],
          recurrence: { supportedRules: ["weekly"], defaultRule: { kind: "weekly" } },
          warningRules: {}
        }
      ]
    });

    render(<App />);

    expect(await screen.findByText("模板管理")).toBeInTheDocument();
    expect(screen.getByText("每周 GitHub 精选")).toBeInTheDocument();
    expect(screen.getByText("推进对象：候选仓库")).toBeInTheDocument();
  });

  it("opens a dedicated feedback page from the current panel", async () => {
    const user = userEvent.setup();
    mockState({
      ...appState,
      activity: [
        ...appState.activity,
        {
          id: "activity-3",
          projectId: "project-2",
          kind: "small",
          type: "entropy_reduced",
          message: "不做了：临时分支",
          createdAt: "2026-06-15T10:00:00.000Z"
        },
        {
          id: "activity-4",
          projectId: "project-1",
          kind: "big",
          type: "slot_filled",
          message: "槽位 2 已填入 another/repo",
          createdAt: "2026-06-15T11:00:00.000Z"
        }
      ]
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "查看全部反馈" }));

    expect(screen.getByRole("heading", { name: "反馈" })).toBeInTheDocument();
    expect(screen.getByText("槽位 2 已填入 another/repo")).toBeInTheDocument();
    expect(screen.getByText("不做了：临时分支")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "小反馈" }));

    expect(screen.queryByText("槽位 2 已填入 another/repo")).not.toBeInTheDocument();
    expect(screen.getByText("不做了：临时分支")).toBeInTheDocument();
  });

  it("shows focus mode when active", async () => {
    mockState({
      ...appState,
      focusMode: {
        status: "active",
        selectedProjectId: "project-1",
        selectedActionId: "test-one-repo",
        session: {
          startedAt: "2026-06-15T10:00:00.000Z",
          durationMinutes: 5
        }
      }
    });

    render(<App />);

    expect(await screen.findByText("收束模式")).toBeInTheDocument();
    expect(screen.getByText("当前只推进：每周 GitHub 精选 2026-W25")).toBeInTheDocument();
    expect(screen.getByText("5 分钟启动块")).toBeInTheDocument();
  });

  it("navigates to a generic new task page and creates a project", async () => {
    const user = userEvent.setup();
    const nextProject = {
      ...appState.projects[1],
      id: "generic-project-1",
      title: "整理播客选题",
      status: "not_started" as const,
      templateId: "generic-task",
      templateSnapshot: {
        templateId: "generic-task",
        templateName: "通用任务",
        stages: genericTemplate.stages,
        slots: [],
        minimumActions: genericTemplate.minimumActions,
        warningRules: genericTemplate.warningRules
      },
      recurrence: { kind: "none" as const },
      stages: [],
      progressObjects: [],
      slots: [],
      taskTree: {
        id: "generic-project-1-root",
        title: "整理播客选题",
        status: "not_started" as const,
        children: [],
        createdAt: "2026-06-16T08:00:00.000Z",
        updatedAt: "2026-06-16T08:00:00.000Z"
      }
    };
    const initialState = {
      ...appState,
      templates: [genericTemplate, ...appState.templates]
    };
    const nextState = {
      ...initialState,
      projects: [...initialState.projects, nextProject]
    };

    globalThis.fetch = vi.fn(async (input) => {
      const path = String(input);
      return jsonResponse(path === "/api/state" ? initialState : { project: nextProject, state: nextState });
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "新建任务" }));

    expect(screen.getByRole("heading", { name: "新建任务" })).toBeInTheDocument();
    expect(screen.getAllByText("通用任务").length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("任务名称"), "整理播客选题");
    await user.selectOptions(screen.getByLabelText("任务模板"), "generic-task");
    await user.click(screen.getByRole("button", { name: "创建任务" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "整理播客选题",
          templateId: "generic-task",
          recurrence: { kind: "none" }
        })
      })
    );
    expect(await screen.findByRole("heading", { name: "整理播客选题" })).toBeInTheDocument();
  });

  it("adds and closes generic task children from the detail panel", async () => {
    const user = userEvent.setup();
    const genericProject = {
      ...appState.projects[1],
      id: "generic-project-1",
      title: "整理播客选题",
      templateId: "generic-task",
      templateSnapshot: {
        templateId: "generic-task",
        templateName: "通用任务",
        stages: [],
        slots: [],
        minimumActions: genericTemplate.minimumActions,
        warningRules: genericTemplate.warningRules
      },
      stages: [],
      progressObjects: [],
      slots: [],
      taskTree: {
        id: "generic-project-1-root",
        title: "整理播客选题",
        status: "not_started" as const,
        children: [],
        createdAt: "2026-06-16T08:00:00.000Z",
        updatedAt: "2026-06-16T08:00:00.000Z"
      }
    };
    const projectWithChild = {
      ...genericProject,
      taskTree: {
        ...genericProject.taskTree,
        children: [
          {
            id: "task-1",
            title: "收集候选选题",
            status: "not_started" as const,
            children: [],
            createdAt: "2026-06-16T08:05:00.000Z",
            updatedAt: "2026-06-16T08:05:00.000Z"
          }
        ]
      }
    };
    const droppedProject = {
      ...projectWithChild,
      taskTree: {
        ...projectWithChild.taskTree,
        children: projectWithChild.taskTree.children.map((task) =>
          task.id === "task-1" ? { ...task, status: "dropped" as const } : task
        )
      }
    };
    const initialState = {
      ...appState,
      projects: [...appState.projects, genericProject]
    };
    const childState = {
      ...initialState,
      projects: [...appState.projects, projectWithChild]
    };
    const droppedState = {
      ...initialState,
      projects: [...appState.projects, droppedProject],
      activity: [
        ...appState.activity,
        {
          id: "activity-drop",
          projectId: "generic-project-1",
          kind: "small" as const,
          type: "entropy_reduced" as const,
          message: "不做了：收集候选选题",
          taskId: "task-1",
          createdAt: "2026-06-16T08:10:00.000Z"
        }
      ]
    };

    globalThis.fetch = vi.fn(async (input) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path.includes("/children")) {
        return jsonResponse(childState);
      }
      if (path.includes("/tasks/task-1/status")) {
        return jsonResponse(droppedState);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /整理播客选题/ }));
    await user.type(screen.getByLabelText("添加到整理播客选题"), "收集候选选题");
    await user.click(screen.getByRole("button", { name: "添加小任务" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/generic-project-1/tasks/generic-project-1-root/children",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "收集候选选题" })
      })
    );
    expect(await screen.findByText("收集候选选题")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "不做了：收集候选选题" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/generic-project-1/tasks/task-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "dropped" })
      })
    );
    expect(await screen.findByText("不做了")).toBeInTheDocument();
  });

  it("shows templates on a dedicated template page", async () => {
    const user = userEvent.setup();
    mockState({
      ...appState,
      templates: [genericTemplate]
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "模板" }));

    expect(screen.getByRole("heading", { name: "模板" })).toBeInTheDocument();
    expect(screen.getByText("通用任务")).toBeInTheDocument();
  });

  it("switches the detail panel when a project is selected", async () => {
    const user = userEvent.setup();
    mockState();

    render(<App />);

    expect(await screen.findByRole("heading", { name: "每周 GitHub 精选 2026-W25" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /暂停的项目/ }));

    expect(screen.getByRole("heading", { name: "暂停的项目" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /暂停的项目/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("starts a not-started project from the detail panel", async () => {
    const user = userEvent.setup();
    const initialProject = {
      ...appState.projects[0],
      status: "not_started" as const
    };
    const nextProject = {
      ...initialProject,
      status: "active" as const
    };
    const initialState = replaceProject(initialProject);
    const nextState = replaceProject(nextProject);

    globalThis.fetch = vi.fn(async (input) => {
      const path = String(input);
      return jsonResponse(path === "/api/state" ? initialState : nextState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "开始项目" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "active" })
      })
    );
    expect(await screen.findByRole("button", { name: "暂停项目" })).toBeInTheDocument();
  });

  it("creates candidate repositories from the detail panel", async () => {
    const user = userEvent.setup();
    const nextProject = {
      ...appState.projects[0],
      progressObjects: [
        ...appState.projects[0].progressObjects,
        {
          id: "repo-3",
          title: "new/repo",
          stateId: "untested",
          fields: {
            repoName: "new/repo",
            url: "https://github.com/new/repo"
          },
          createdAt: "2026-06-15T02:00:00.000Z",
          updatedAt: "2026-06-15T02:00:00.000Z"
        }
      ]
    };
    const nextState = replaceProject(nextProject);

    globalThis.fetch = vi.fn(async (input) => {
      const path = String(input);
      return jsonResponse(path === "/api/state" ? appState : nextState);
    });

    render(<App />);

    await user.type(await screen.findByLabelText("候选仓库名称"), "new/repo");
    await user.type(screen.getByLabelText("GitHub URL"), "https://github.com/new/repo");
    await user.click(screen.getByRole("button", { name: "添加候选" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-1/progress-objects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "new/repo",
          fields: {
            repoName: "new/repo",
            url: "https://github.com/new/repo"
          }
        })
      })
    );
    expect(await screen.findByText("new/repo")).toBeInTheDocument();
  });

  it("updates candidate status and fills recommendation slots from the detail panel", async () => {
    const user = userEvent.setup();
    const selectedProject = {
      ...appState.projects[0],
      progressObjects: appState.projects[0].progressObjects.map((object) =>
        object.id === "repo-2" ? { ...object, stateId: "selected" } : object
      )
    };
    const filledProject = {
      ...selectedProject,
      slots: selectedProject.slots.map((slot) =>
        slot.id === "slot-2"
          ? { ...slot, progressObjectId: "repo-2", filledAt: "2026-06-15T03:00:00.000Z" }
          : slot
      )
    };
    const selectedState = replaceProject(selectedProject);
    const filledState = replaceProject(filledProject);

    globalThis.fetch = vi.fn(async (input) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(appState);
      }
      if (path.includes("/progress-objects/repo-2/state")) {
        return jsonResponse(selectedState);
      }
      if (path.includes("/slots/slot-2/fill")) {
        return jsonResponse(filledState);
      }
      return jsonResponse(appState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "将 another/repo 标记为入选" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-1/progress-objects/repo-2/state",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ nextStateId: "selected", note: "界面更新状态" })
      })
    );

    await user.selectOptions(screen.getByLabelText("选择填入槽位 2 的候选"), "repo-2");
    await user.click(screen.getByRole("button", { name: "填入槽位 2" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-1/slots/slot-2/fill",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ progressObjectId: "repo-2" })
      })
    );
    expect(await screen.findAllByText("another/repo")).toHaveLength(2);
  });

  it("does not render the current candidate state as an action button", async () => {
    render(<App />);

    expect(await screen.findAllByText("入选")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "将 owner/repo 标记为入选" })).not.toBeInTheDocument();
  });

  it("renders project progress stages, slots, and progress objects", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "每周 GitHub 精选 2026-W25" })).toBeInTheDocument();
    expect(screen.getByText("阶段进度")).toBeInTheDocument();
    expect(screen.getByText("槽位 1 / 2")).toBeInTheDocument();
    expect(screen.getByText("槽位 1")).toBeInTheDocument();
    expect(screen.getByText("槽位 2")).toBeInTheDocument();
    expect(screen.getAllByText("owner/repo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("入选").length).toBeGreaterThan(0);
    expect(screen.queryByText("selected")).not.toBeInTheDocument();
  });

  it("distinguishes missing slot objects from empty slots", async () => {
    mockState({
      ...appState,
      projects: [
        {
          ...appState.projects[0],
          slots: [
            { id: "slot-1", name: "槽位 1", progressObjectId: "missing-repo" },
            { id: "slot-2", name: "槽位 2" }
          ]
        }
      ]
    });

    render(<App />);

    expect(await screen.findByText("对象缺失：missing-repo")).toBeInTheDocument();
    expect(screen.getByText("未填")).toBeInTheDocument();
  });

  it("shows an empty state when a project has no slots", async () => {
    mockState({
      ...appState,
      projects: [
        {
          ...appState.projects[0],
          slots: []
        }
      ]
    });

    render(<App />);

    expect(await screen.findByText("暂无成果槽位")).toBeInTheDocument();
  });
});
