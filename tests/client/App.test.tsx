import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/client/App";
import { fetchState, upsertEmotionEntryApi } from "../../src/client/api";
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
        stages: [],
        slots: [],
        minimumActions: [],
        warningRules: {}
      },
      recurrence: {
        kind: "weekly"
      },
      stages: [],
      progressObjects: [],
      slots: [],
      taskTree: {
        id: "project-1-root",
        title: "每周 GitHub 精选 2026-W25",
        status: "not_started",
        children: [
          {
            id: "project-1-hands-on",
            title: "亲测候选仓库",
            status: "active",
            children: [
              {
                id: "project-1-candidate-1",
                title: "whisper",
                status: "completed",
                children: [],
                createdAt: "2026-06-15T00:00:00.000Z",
                updatedAt: "2026-06-15T00:00:00.000Z",
                feedbackRecordedAt: "2026-06-15T00:00:00.000Z",
                feedbackStatus: "completed"
              },
              {
                id: "project-1-candidate-2",
                title: "llms.txt",
                status: "unhandled",
                children: [],
                createdAt: "2026-06-15T00:00:00.000Z",
                updatedAt: "2026-06-15T00:00:00.000Z"
              }
            ],
            createdAt: "2026-06-15T00:00:00.000Z",
            updatedAt: "2026-06-15T00:00:00.000Z"
          },
          {
            id: "project-1-pick",
            title: "确定本周 5 个推荐",
            status: "not_started",
            children: [],
            createdAt: "2026-06-15T00:00:00.000Z",
            updatedAt: "2026-06-15T00:00:00.000Z"
          },
          {
            id: "project-1-draft",
            title: "成稿",
            status: "not_started",
            children: [],
            createdAt: "2026-06-15T00:00:00.000Z",
            updatedAt: "2026-06-15T00:00:00.000Z"
          },
          {
            id: "project-1-publish",
            title: "发布",
            status: "not_started",
            children: [
              {
                id: "project-1-publish-1",
                title: "抖音",
                status: "not_started",
                children: [],
                createdAt: "2026-06-15T00:00:00.000Z",
                updatedAt: "2026-06-15T00:00:00.000Z"
              },
              {
                id: "project-1-publish-2",
                title: "知乎",
                status: "not_started",
                children: [],
                createdAt: "2026-06-15T00:00:00.000Z",
                updatedAt: "2026-06-15T00:00:00.000Z"
              },
              {
                id: "project-1-publish-3",
                title: "B站",
                status: "not_started",
                children: [],
                createdAt: "2026-06-15T00:00:00.000Z",
                updatedAt: "2026-06-15T00:00:00.000Z"
              },
              {
                id: "project-1-publish-4",
                title: "小红书",
                status: "not_started",
                children: [],
                createdAt: "2026-06-15T00:00:00.000Z",
                updatedAt: "2026-06-15T00:00:00.000Z"
              },
              {
                id: "project-1-publish-5",
                title: "编程导航",
                status: "not_started",
                children: [],
                createdAt: "2026-06-15T00:00:00.000Z",
                updatedAt: "2026-06-15T00:00:00.000Z"
              },
              {
                id: "project-1-publish-6",
                title: "稀土掘金",
                status: "not_started",
                children: [],
                createdAt: "2026-06-15T00:00:00.000Z",
                updatedAt: "2026-06-15T00:00:00.000Z"
              }
            ],
            createdAt: "2026-06-15T00:00:00.000Z",
            updatedAt: "2026-06-15T00:00:00.000Z"
          }
        ],
        createdAt: "2026-06-15T00:00:00.000Z",
        updatedAt: "2026-06-15T00:00:00.000Z"
      },
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
  habits: [],
  habitRecords: [],
  emotionEntries: [],
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
    status: "inactive"
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

  function buildRelativeCreatedAt(daysOffset: number) {
    const now = new Date();
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysOffset, 12, 0, 0, 0);
    return localDate.toISOString();
  }

  function buildRelativeDateInput(daysOffset: number) {
    const now = new Date();
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysOffset, 12, 0, 0, 0);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function buildRelativeWeekday(daysOffset: number) {
    return new Date(`${buildRelativeDateInput(daysOffset)}T12:00:00`).getDay();
  }

  function buildDayGroupLabel(daysOffset: number, count: number) {
    const dateLabel = buildRelativeDateInput(daysOffset);
    if (daysOffset === 0) {
      return `${dateLabel} · 今天 · ${count} 条`;
    }

    if (daysOffset === -1) {
      return `${dateLabel} · 昨天 · ${count} 条`;
    }

    return `${dateLabel} · ${count} 条`;
  }

  function buildWeekGroupLabel(daysOffset: number, count: number) {
    const date = new Date(buildRelativeCreatedAt(daysOffset));
    const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = (local.getDay() + 6) % 7;
    local.setDate(local.getDate() - day + 3);
    const firstThursday = new Date(local.getFullYear(), 0, 4);
    const firstDay = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
    const week = 1 + Math.round((local.getTime() - firstThursday.getTime()) / 604800000);
    return `${local.getFullYear()} 第 ${week} 周 · ${count} 条`;
  }

  function buildMonthGroupLabel(daysOffset: number, count: number) {
    const dateLabel = buildRelativeDateInput(daysOffset).slice(0, 7);
    return `${dateLabel} · ${count} 条`;
  }

  beforeEach(() => {
    mockState();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the main dashboard from API state", async () => {
    render(<App />);

    expect(await screen.findByText("当前面板")).toBeInTheDocument();
    expect(screen.getByText("进行中 1 / 3")).toBeInTheDocument();
    expect(screen.getAllByText("每周 GitHub 精选 2026-W25").length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(
      "/api/state",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" }
      })
    );
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

  it("returns empty emotionEntries when api state omits them", async () => {
    globalThis.fetch = vi.fn(async () => {
      const { emotionEntries: _emotionEntries, ...stateWithoutEmotionEntries } = appState;
      return jsonResponse(stateWithoutEmotionEntries);
    });

    await expect(fetchState()).resolves.toMatchObject({
      ...appState,
      emotionEntries: []
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/state",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" }
      })
    );
  });

  it("sends the emotion entry payload through upsertEmotionEntryApi", async () => {
    const payload = {
      emoji: "🙂",
      shortNote: "还行",
      detail: "今天推进得比较稳"
    };

    globalThis.fetch = vi.fn(async () => jsonResponse(appState));

    await upsertEmotionEntryApi("2026-06-20", payload);

    expect(fetch).toHaveBeenCalledWith(
      "/api/emotions/2026-06-20",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      })
    );
  });

  it("shows templates on the dedicated templates page instead of the workbench", async () => {
    const user = userEvent.setup();
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

    expect(await screen.findByText("当前面板")).toBeInTheDocument();
    expect(screen.queryByText("模板管理")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "模板" }));

    expect(screen.getByRole("heading", { name: "模板" })).toBeInTheDocument();
    expect(screen.getByText("模板管理")).toBeInTheDocument();
    expect(screen.getByText("每周 GitHub 精选")).toBeInTheDocument();
    expect(screen.getByText("推进对象：候选仓库")).toBeInTheDocument();
  });

  it("shows a habits page from the main navigation", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "习惯" }));

    expect(screen.getByRole("heading", { name: "习惯" })).toBeInTheDocument();
    expect(screen.getByText("今天该做")).toBeInTheDocument();
    expect(screen.getByText("历史漏项")).toBeInTheDocument();
  });

  it("shows an emotions page from the main navigation", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "情绪" }));

    expect(screen.getByRole("heading", { name: "情绪" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "月历" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "列表" })).toBeInTheDocument();
  });

  it("shows month view by default and displays only emoji in the calendar grid", async () => {
    const user = userEvent.setup();
    mockState({
      ...appState,
      emotionEntries: [
        {
          date: buildRelativeDateInput(0),
          emoji: "😄",
          shortNote: "今天顺了",
          detail: "下午推进感很好",
          createdAt: buildRelativeCreatedAt(0),
          updatedAt: buildRelativeCreatedAt(0)
        }
      ]
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "情绪" }));

    const calendarButton = screen.getByRole("button", { name: "月历" });
    expect(calendarButton).toHaveAttribute("aria-pressed", "true");

    const calendarGroup = screen.getByRole("group", { name: "情绪月历" });
    expect(within(calendarGroup).getByText("😄")).toBeInTheDocument();
    expect(within(calendarGroup).queryByText("今天顺了")).not.toBeInTheDocument();
  });

  it("shows emoji plus short note in list view and falls back to emoji only", async () => {
    const user = userEvent.setup();
    mockState({
      ...appState,
      emotionEntries: [
        {
          date: buildRelativeDateInput(0),
          emoji: "😄",
          shortNote: "今天顺了",
          detail: "下午推进感很好",
          createdAt: buildRelativeCreatedAt(0),
          updatedAt: buildRelativeCreatedAt(0)
        },
        {
          date: buildRelativeDateInput(-1),
          emoji: "😐",
          createdAt: buildRelativeCreatedAt(-1),
          updatedAt: buildRelativeCreatedAt(-1)
        }
      ]
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "情绪" }));
    await user.click(screen.getByRole("button", { name: "列表" }));

    const list = screen.getByRole("list", { name: "情绪列表" });
    expect(within(list).getByText("😄 今天顺了")).toBeInTheDocument();
    expect(within(list).getByText("😐")).toBeInTheDocument();
  });

  it("keeps the short note draft when changing the viewed month", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "情绪" }));

    const shortNoteInput = screen.getByRole("textbox", { name: "一句话总结" });
    await user.type(shortNoteInput, "还没写完的草稿");

    const monthInput = screen.getByLabelText("查看月份");
    fireEvent.change(monthInput, { target: { value: buildRelativeDateInput(-31).slice(0, 7) } });

    expect(monthInput).toHaveValue(buildRelativeDateInput(-31).slice(0, 7));
    expect(shortNoteInput).toHaveValue("还没写完的草稿");
  });

  it("keeps the detail draft when changing the viewed month", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "情绪" }));
    await user.click(screen.getByRole("button", { name: "展开详细内容" }));

    const detailInput = screen.getByRole("textbox", { name: "详细内容" });
    await user.type(detailInput, "还没写完的详细草稿");

    const monthInput = screen.getByLabelText("查看月份");
    fireEvent.change(monthInput, { target: { value: buildRelativeDateInput(-31).slice(0, 7) } });

    expect(monthInput).toHaveValue(buildRelativeDateInput(-31).slice(0, 7));
    expect(detailInput).toHaveValue("还没写完的详细草稿");
  });

  it("collapses detail by default when selecting a new day without an entry", async () => {
    const user = userEvent.setup();
    const today = buildRelativeDateInput(0);
    const yesterday = buildRelativeDateInput(-1);
    mockState({
      ...appState,
      emotionEntries: [
        {
          date: today,
          emoji: "😄",
          shortNote: "今天顺了",
          detail: "下午推进感很好",
          createdAt: buildRelativeCreatedAt(0),
          updatedAt: buildRelativeCreatedAt(0)
        }
      ]
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "情绪" }));

    expect(screen.getByRole("button", { name: "收起详细内容" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "详细内容" })).toHaveValue("下午推进感很好");

    fireEvent.change(screen.getByLabelText("情绪日期"), { target: { value: yesterday } });

    expect(screen.getByRole("button", { name: "展开详细内容" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: "详细内容" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "一句话总结" })).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "展开详细内容" }));

    expect(screen.getByRole("textbox", { name: "详细内容" })).toHaveValue("");
  });

  it("hydrates the editor when selecting a day with an existing entry", async () => {
    const user = userEvent.setup();
    const today = buildRelativeDateInput(0);
    const yesterday = buildRelativeDateInput(-1);
    mockState({
      ...appState,
      emotionEntries: [
        {
          date: today,
          emoji: "😄",
          shortNote: "今天顺了",
          detail: "下午推进感很好",
          createdAt: buildRelativeCreatedAt(0),
          updatedAt: buildRelativeCreatedAt(0)
        },
        {
          date: yesterday,
          emoji: "😐",
          shortNote: "昨天一般",
          detail: "开会太多，节奏被打断",
          createdAt: buildRelativeCreatedAt(-1),
          updatedAt: buildRelativeCreatedAt(-1)
        }
      ]
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "情绪" }));
    const happyRadio = screen.getByRole("radio", { name: "😄 开心" });
    const neutralRadio = screen.getByRole("radio", { name: "😐 平平" });

    await user.clear(screen.getByRole("textbox", { name: "一句话总结" }));
    await user.type(screen.getByRole("textbox", { name: "一句话总结" }), "临时草稿");
    await user.clear(screen.getByRole("textbox", { name: "详细内容" }));
    await user.type(screen.getByRole("textbox", { name: "详细内容" }), "临时详情");
    expect(happyRadio).toBeChecked();
    expect(neutralRadio).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "列表" }));
    await user.click(screen.getByRole("button", { name: `${yesterday} 😐 昨天一般` }));

    expect(screen.getByRole("textbox", { name: "一句话总结" })).toHaveValue("昨天一般");
    expect(screen.getByRole("button", { name: "收起详细内容" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "详细内容" })).toHaveValue("开会太多，节奏被打断");
    expect(neutralRadio).toBeChecked();
    expect(happyRadio).not.toBeChecked();
  });

  it("exposes simple pressed and expanded semantics on the emotions page", async () => {
    const user = userEvent.setup();
    const today = buildRelativeDateInput(0);
    const yesterday = buildRelativeDateInput(-1);
    mockState({
      ...appState,
      emotionEntries: [
        {
          date: today,
          emoji: "😄",
          createdAt: buildRelativeCreatedAt(0),
          updatedAt: buildRelativeCreatedAt(0)
        },
        {
          date: yesterday,
          emoji: "😐",
          shortNote: "昨天一般",
          createdAt: buildRelativeCreatedAt(-1),
          updatedAt: buildRelativeCreatedAt(-1)
        }
      ]
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "情绪" }));

    const calendarGroup = screen.getByRole("group", { name: "情绪月历" });
    expect(within(calendarGroup).getByRole("button", { name: `${today} 😄` })).toHaveAttribute("aria-pressed", "true");
    expect(within(calendarGroup).queryByRole("row")).not.toBeInTheDocument();
    expect(within(calendarGroup).queryByRole("gridcell")).not.toBeInTheDocument();

    const detailToggle = screen.getByRole("button", { name: "展开详细内容" });
    expect(detailToggle).toHaveAttribute("aria-expanded", "false");

    await user.click(detailToggle);

    expect(screen.getByRole("button", { name: "收起详细内容" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "列表" }));

    const yesterdayRow = screen.getByRole("button", { name: `${yesterday} 😐 昨天一般` });
    await user.click(yesterdayRow);

    expect(yesterdayRow).toHaveAttribute("aria-pressed", "true");
  });

  it("shows today due habits and missed habit items", async () => {
    const user = userEvent.setup();
    mockState({
      ...appState,
      habits: [
        {
          id: "habit-1",
          title: "看 AI HOT 日报",
          schedule: { weekdays: [buildRelativeWeekday(-1), buildRelativeWeekday(0)] },
          period: {
            kind: "bounded",
            startDate: buildRelativeDateInput(-1),
            endDate: buildRelativeDateInput(0)
          },
          createdAt: buildRelativeCreatedAt(-1),
          updatedAt: buildRelativeCreatedAt(-1)
        }
      ],
      habitRecords: []
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "习惯" }));

    expect(screen.getAllByText("看 AI HOT 日报")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "标记完成" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "补记完成" })).toBeInTheDocument();
  });

  it("completes a habit from today view and archives it from all habits", async () => {
    const user = userEvent.setup();
    const todayDate = buildRelativeDateInput(0);
    const initialState: AppState = {
      ...appState,
      habits: [
        {
          id: "habit-1",
          title: "看 AI HOT 日报",
          schedule: { weekdays: [buildRelativeWeekday(0)] },
          period: {
            kind: "bounded",
            startDate: todayDate,
            endDate: buildRelativeDateInput(7)
          },
          createdAt: buildRelativeCreatedAt(0),
          updatedAt: buildRelativeCreatedAt(0)
        }
      ],
      habitRecords: []
    };
    const completedState: AppState = {
      ...initialState,
      habitRecords: [
        {
          habitId: "habit-1",
          date: todayDate,
          status: "completed",
          updatedAt: buildRelativeCreatedAt(0)
        }
      ]
    };
    const archivedState: AppState = {
      ...completedState,
      habits: completedState.habits.map((habit) => ({
        ...habit,
        archivedAt: buildRelativeCreatedAt(0),
        updatedAt: buildRelativeCreatedAt(0)
      }))
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path === `/api/habits/habit-1/records/${todayDate}`) {
        expect(init).toMatchObject({
          method: "PUT",
          body: JSON.stringify({ status: "completed" })
        });
        return jsonResponse(completedState);
      }
      if (path === "/api/habits/habit-1/archive") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({})
        });
        return jsonResponse(archivedState);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "习惯" }));
    await user.click(screen.getByRole("button", { name: "标记完成" }));
    expect(await screen.findByRole("button", { name: "已完成" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "全部习惯" }));
    await user.click(screen.getByRole("button", { name: "归档：看 AI HOT 日报" }));

    expect(await screen.findByText("暂无习惯")).toBeInTheDocument();
    expect(screen.getByText("看 AI HOT 日报")).toBeInTheDocument();
  });

  it("creates a habit from the all habits view", async () => {
    const user = userEvent.setup();
    const initialState: AppState = {
      ...appState,
      habits: [],
      habitRecords: []
    };
    const createdState: AppState = {
      ...initialState,
      habits: [
        {
          id: "habit-1",
          title: "爬坡",
          schedule: { weekdays: [1, 2, 3, 4, 5] },
          period: {
            kind: "bounded",
            startDate: buildRelativeDateInput(0),
            endDate: buildRelativeDateInput(0)
          },
          createdAt: buildRelativeCreatedAt(0),
          updatedAt: buildRelativeCreatedAt(0)
        }
      ]
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path === "/api/habits") {
        expect(init).toMatchObject({
          method: "POST"
        });
        return jsonResponse(createdState);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "习惯" }));
    await user.click(screen.getByRole("button", { name: "全部习惯" }));
    await user.type(screen.getByLabelText("习惯名称"), "爬坡");
    await user.click(screen.getByRole("button", { name: "新建习惯" }));

    expect(await screen.findByText("爬坡")).toBeInTheDocument();
  });

  it("edits a habit from the all habits view", async () => {
    const user = userEvent.setup();
    const initialState: AppState = {
      ...appState,
      habits: [
        {
          id: "habit-1",
          title: "看 AI HOT 日报",
          schedule: { weekdays: [1, 2, 3, 4, 5] },
          period: {
            kind: "bounded",
            startDate: buildRelativeDateInput(0),
            endDate: buildRelativeDateInput(5)
          },
          createdAt: buildRelativeCreatedAt(0),
          updatedAt: buildRelativeCreatedAt(0)
        }
      ],
      habitRecords: []
    };
    const updatedState: AppState = {
      ...initialState,
      habits: [
        {
          ...initialState.habits[0],
          title: "看 AI HOT + Hacker News",
          schedule: { weekdays: [1, 3, 5] },
          period: {
            kind: "ongoing",
            startDate: buildRelativeDateInput(1)
          },
          updatedAt: buildRelativeCreatedAt(1)
        }
      ]
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path === "/api/habits/habit-1") {
        expect(init).toMatchObject({
          method: "PATCH"
        });
        return jsonResponse(updatedState);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "习惯" }));
    await user.click(screen.getByRole("button", { name: "全部习惯" }));
    await user.click(screen.getByRole("button", { name: "编辑：看 AI HOT 日报" }));

    const titleInput = screen.getByRole("textbox", { name: "习惯名称" });
    await user.clear(titleInput);
    await user.type(titleInput, "看 AI HOT + Hacker News");
    await user.click(screen.getByRole("radio", { name: "长期进行" }));
    await user.clear(screen.getByLabelText("习惯开始日期"));
    await user.type(screen.getByLabelText("习惯开始日期"), buildRelativeDateInput(1));
    await user.click(screen.getByRole("button", { name: "保存习惯" }));

    expect(await screen.findByText("看 AI HOT + Hacker News")).toBeInTheDocument();
  });

  it("groups projects by status and collapses completed projects by default", async () => {
    const user = userEvent.setup();
    mockState({
      ...appState,
      projects: [
        appState.projects[0],
        appState.projects[1],
        {
          ...appState.projects[1],
          id: "project-3",
          title: "待开始项目",
          status: "not_started"
        },
        {
          ...appState.projects[1],
          id: "project-4",
          title: "已完成项目",
          status: "completed",
          completedFromStatus: "active"
        }
      ]
    });

    render(<App />);

    expect(await screen.findByRole("button", { name: "进行中 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "待开始 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂停 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已完成 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择项目：已完成项目" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "已完成 1" }));

    expect(screen.getByRole("button", { name: "选择项目：已完成项目" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "进行中 1" }));

    expect(screen.queryByRole("button", { name: "选择项目：每周 GitHub 精选 2026-W25" })).not.toBeInTheDocument();
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

  it("keeps the feedback page in browse mode by default", async () => {
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
        }
      ]
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "查看全部反馈" }));

    expect(screen.getByRole("button", { name: "批量管理" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "选择反馈：不做了：临时分支" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /批量删除/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /一键删除当前筛选结果/ })).not.toBeInTheDocument();
  });

  it("filters feedback by quick time ranges and custom date range", async () => {
    const user = userEvent.setup();

    mockState({
      ...appState,
      activity: [
        {
          id: "activity-today",
          projectId: "project-1",
          kind: "small",
          message: "今天的反馈",
          createdAt: buildRelativeCreatedAt(0)
        },
        {
          id: "activity-yesterday",
          projectId: "project-1",
          kind: "small",
          message: "昨天的反馈",
          createdAt: buildRelativeCreatedAt(-1)
        },
        {
          id: "activity-last7",
          projectId: "project-2",
          kind: "big",
          message: "七天内反馈",
          createdAt: buildRelativeCreatedAt(-6)
        },
        {
          id: "activity-may-1",
          projectId: "project-2",
          kind: "small",
          message: "五月反馈一",
          createdAt: buildRelativeCreatedAt(-20)
        },
        {
          id: "activity-may-2",
          projectId: "project-2",
          kind: "big",
          message: "五月反馈二",
          createdAt: buildRelativeCreatedAt(-21)
        }
      ]
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "查看全部反馈" }));

    const timeFilterRow = screen.getByLabelText("时间筛选");
    await user.click(within(timeFilterRow).getByRole("button", { name: "今天" }));

    expect(screen.getByText("今天的反馈")).toBeInTheDocument();
    expect(screen.queryByText("昨天的反馈")).not.toBeInTheDocument();
    expect(screen.queryByText("七天内反馈")).not.toBeInTheDocument();

    await user.click(within(timeFilterRow).getByRole("button", { name: "近 7 天" }));

    expect(screen.getByText("今天的反馈")).toBeInTheDocument();
    expect(screen.getByText("昨天的反馈")).toBeInTheDocument();
    expect(screen.getByText("七天内反馈")).toBeInTheDocument();
    expect(screen.queryByText("五月反馈一")).not.toBeInTheDocument();

    await user.click(within(timeFilterRow).getByRole("button", { name: "自定义" }));
    fireEvent.change(screen.getByLabelText("开始日期"), { target: { value: buildRelativeDateInput(-21) } });
    fireEvent.change(screen.getByLabelText("结束日期"), { target: { value: buildRelativeDateInput(-20) } });

    expect(screen.getByText("五月反馈一")).toBeInTheDocument();
    expect(screen.getByText("五月反馈二")).toBeInTheDocument();
    expect(screen.queryByText("今天的反馈")).not.toBeInTheDocument();
    expect(screen.queryByText("七天内反馈")).not.toBeInTheDocument();
  });

  it("groups feedback by day, week, and month", async () => {
    const user = userEvent.setup();

    mockState({
      ...appState,
      activity: [
        {
          id: "activity-today",
          projectId: "project-1",
          kind: "small",
          message: "今天的反馈",
          createdAt: buildRelativeCreatedAt(0)
        },
        {
          id: "activity-yesterday",
          projectId: "project-1",
          kind: "small",
          message: "昨天的反馈",
          createdAt: buildRelativeCreatedAt(-1)
        },
        {
          id: "activity-last-week",
          projectId: "project-2",
          kind: "big",
          message: "上周反馈",
          createdAt: buildRelativeCreatedAt(-7)
        },
        {
          id: "activity-may-1",
          projectId: "project-2",
          kind: "small",
          message: "五月反馈一",
          createdAt: buildRelativeCreatedAt(-20)
        },
        {
          id: "activity-may-2",
          projectId: "project-2",
          kind: "big",
          message: "五月反馈二",
          createdAt: buildRelativeCreatedAt(-21)
        }
      ]
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "查看全部反馈" }));

    expect(screen.getByText(buildDayGroupLabel(0, 1))).toBeInTheDocument();
    expect(screen.getByText(buildDayGroupLabel(-1, 1))).toBeInTheDocument();

    const groupingRow = screen.getByLabelText("反馈分组");
    await user.click(within(groupingRow).getByRole("button", { name: "按周" }));

    expect(screen.getByText(buildWeekGroupLabel(0, 2))).toBeInTheDocument();
    expect(screen.getByText(buildWeekGroupLabel(-7, 1))).toBeInTheDocument();
    expect(screen.getByText(buildWeekGroupLabel(-20, 2))).toBeInTheDocument();
    expect(screen.queryByText(buildDayGroupLabel(0, 1))).not.toBeInTheDocument();

    await user.click(within(groupingRow).getByRole("button", { name: "按月" }));

    expect(screen.getByText(buildMonthGroupLabel(0, 3))).toBeInTheDocument();
    expect(screen.getByText(buildMonthGroupLabel(-20, 2))).toBeInTheDocument();
    expect(screen.queryByText(buildWeekGroupLabel(0, 2))).not.toBeInTheDocument();
  });

  it("deletes a feedback item from the feedback page after confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const initialState = {
      ...appState,
      activity: [
        ...appState.activity,
        {
          id: "activity-3",
          projectId: "project-2",
          kind: "small" as const,
          type: "entropy_reduced" as const,
          message: "不做了：临时分支",
          createdAt: "2026-06-15T10:00:00.000Z"
        }
      ]
    };
    const nextState = {
      ...initialState,
      activity: initialState.activity.filter((item) => item.id !== "activity-3")
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path === "/api/activity/activity-3/revoke") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({})
        });
        return jsonResponse(nextState);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "查看全部反馈" }));
    await user.click(screen.getByRole("button", { name: "删除反馈：不做了：临时分支" }));

    expect(confirmSpy).toHaveBeenCalledWith("确定要删除这条反馈吗？删除后它会从界面隐藏，但底层历史记录会保留。");
    expect(fetch).toHaveBeenCalledWith(
      "/api/activity/activity-3/revoke",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    );
    expect(screen.queryByText("不做了：临时分支")).not.toBeInTheDocument();
    expect(screen.getByText("共 2")).toBeInTheDocument();
  });

  it("batch deletes selected feedback items from the feedback page after confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const initialState = {
      ...appState,
      activity: [
        ...appState.activity,
        {
          id: "activity-3",
          projectId: "project-2",
          kind: "small" as const,
          type: "entropy_reduced" as const,
          message: "不做了：临时分支",
          createdAt: "2026-06-15T10:00:00.000Z"
        },
        {
          id: "activity-4",
          projectId: "project-2",
          kind: "small" as const,
          type: "task_completed" as const,
          message: "任务完成：补充截图",
          createdAt: "2026-06-15T10:30:00.000Z"
        }
      ]
    };
    const afterFirstDelete = {
      ...initialState,
      activity: initialState.activity.filter((item) => item.id !== "activity-3")
    };
    const afterSecondDelete = {
      ...initialState,
      activity: initialState.activity.filter((item) => item.id !== "activity-3" && item.id !== "activity-4")
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path === "/api/activity/activity-3/revoke") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({})
        });
        return jsonResponse(afterFirstDelete);
      }
      if (path === "/api/activity/activity-4/revoke") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({})
        });
        return jsonResponse(afterSecondDelete);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "查看全部反馈" }));
    await user.click(screen.getByRole("button", { name: "批量管理" }));
    await user.click(screen.getByRole("checkbox", { name: "选择反馈：不做了：临时分支" }));
    await user.click(screen.getByRole("checkbox", { name: "选择反馈：任务完成：补充截图" }));
    await user.click(screen.getByRole("button", { name: "批量删除 2 条" }));

    expect(confirmSpy).toHaveBeenCalledWith("确定要批量删除这 2 条反馈吗？删除后它们会从界面隐藏，但底层历史记录会保留。");
    expect(fetch).toHaveBeenCalledWith(
      "/api/activity/activity-3/revoke",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/activity/activity-4/revoke",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    );
    await waitFor(() => {
      expect(screen.queryByText("不做了：临时分支")).not.toBeInTheDocument();
      expect(screen.queryByText("任务完成：补充截图")).not.toBeInTheDocument();
    });
  });

  it("deletes all current filtered feedback results after confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const initialState = {
      ...appState,
      activity: [
        {
          id: "activity-today",
          projectId: "project-1",
          kind: "small" as const,
          type: "entropy_reduced" as const,
          message: "今天的反馈",
          createdAt: buildRelativeCreatedAt(0)
        },
        {
          id: "activity-yesterday",
          projectId: "project-1",
          kind: "small" as const,
          type: "task_completed" as const,
          message: "昨天的反馈",
          createdAt: buildRelativeCreatedAt(-1)
        },
        {
          id: "activity-last7",
          projectId: "project-2",
          kind: "big" as const,
          type: "project_completed" as const,
          message: "七天内反馈",
          createdAt: buildRelativeCreatedAt(-6)
        },
        {
          id: "activity-may-1",
          projectId: "project-2",
          kind: "small" as const,
          type: "entropy_reduced" as const,
          message: "五月反馈一",
          createdAt: buildRelativeCreatedAt(-20)
        },
        {
          id: "activity-may-2",
          projectId: "project-2",
          kind: "big" as const,
          type: "progress_concluded" as const,
          message: "五月反馈二",
          createdAt: buildRelativeCreatedAt(-21)
        }
      ]
    };
    const afterTodayDelete = {
      ...initialState,
      activity: initialState.activity.filter((item) => item.id !== "activity-today")
    };
    const afterYesterdayDelete = {
      ...initialState,
      activity: initialState.activity.filter((item) => !["activity-today", "activity-yesterday"].includes(item.id))
    };
    const afterLast7Delete = {
      ...initialState,
      activity: initialState.activity.filter((item) =>
        !["activity-today", "activity-yesterday", "activity-last7"].includes(item.id)
      )
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path === "/api/activity/activity-today/revoke") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({})
        });
        return jsonResponse(afterTodayDelete);
      }
      if (path === "/api/activity/activity-yesterday/revoke") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({})
        });
        return jsonResponse(afterYesterdayDelete);
      }
      if (path === "/api/activity/activity-last7/revoke") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({})
        });
        return jsonResponse(afterLast7Delete);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "查看全部反馈" }));
    await user.click(screen.getByRole("button", { name: "批量管理" }));
    const timeFilterRow = screen.getByLabelText("时间筛选");
    await user.click(within(timeFilterRow).getByRole("button", { name: "近 7 天" }));
    await user.click(screen.getByRole("button", { name: "一键删除当前筛选结果（3 条）" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "确定要删除当前筛选结果中的 3 条反馈吗？这只会移除当前筛选出的反馈，底层历史记录会保留。"
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/activity/activity-today/revoke",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/activity/activity-yesterday/revoke",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/activity/activity-last7/revoke",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    );

    await waitFor(() => {
      expect(screen.queryByText("今天的反馈")).not.toBeInTheDocument();
      expect(screen.queryByText("昨天的反馈")).not.toBeInTheDocument();
      expect(screen.queryByText("七天内反馈")).not.toBeInTheDocument();
    });

    expect(screen.getByText("暂无反馈")).toBeInTheDocument();
    expect(screen.getByText("共 2")).toBeInTheDocument();

    await user.click(within(timeFilterRow).getByRole("button", { name: "全部" }));
    expect(screen.getByText("五月反馈一")).toBeInTheDocument();
    expect(screen.getByText("五月反馈二")).toBeInTheDocument();
  });

  it("renames a project from the project list more menu and updates the detail title", async () => {
    const user = userEvent.setup();
    const renamedState: AppState = {
      ...appState,
      projects: appState.projects.map((project) =>
        project.id === "project-1" ? { ...project, title: "发布平台视频字段统计" } : project
      )
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(appState);
      }
      if (path === "/api/projects/project-1/title") {
        expect(init).toMatchObject({
          method: "PATCH",
          body: JSON.stringify({ title: "发布平台视频字段统计" })
        });
        return jsonResponse(renamedState);
      }
      return jsonResponse(appState);
    });

    render(<App />);

    await screen.findByRole("heading", { name: "任务进度" });
    await user.click(screen.getByRole("button", { name: "项目更多操作：每周 GitHub 精选 2026-W25" }));
    await user.click(screen.getByRole("button", { name: "重命名" }));

    const renameInput = screen.getByRole("textbox", { name: "重命名项目：每周 GitHub 精选 2026-W25" });
    await user.clear(renameInput);
    await user.type(renameInput, "发布平台视频字段统计{enter}");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /项目更多操作：发布平台视频字段统计/ })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "发布平台视频字段统计" })).toBeInTheDocument();
  });

  it("renames a non-root task from the task menu", async () => {
    const user = userEvent.setup();
    const genericProject = {
      id: "generic-project-1",
      title: "整理播客选题",
      status: "active" as const,
      templateId: "generic-task",
      templateSnapshot: {
        templateId: "generic-task",
        templateName: "通用任务",
        stages: [],
        slots: [],
        minimumActions: [],
        warningRules: {}
      },
      recurrence: { kind: "none" as const },
      stages: [],
      progressObjects: [],
      slots: [],
      taskTree: {
        id: "generic-project-1-root",
        title: "整理播客选题",
        status: "not_started" as const,
        children: [
          {
            id: "task-1",
            title: "收集候选选题",
            status: "not_started" as const,
            children: [],
            createdAt: "2026-06-16T08:05:00.000Z",
            updatedAt: "2026-06-16T08:05:00.000Z"
          }
        ],
        createdAt: "2026-06-16T08:00:00.000Z",
        updatedAt: "2026-06-16T08:05:00.000Z"
      },
      createdAt: "2026-06-16T08:00:00.000Z",
      updatedAt: "2026-06-16T08:05:00.000Z"
    };
    const renamedProject = {
      ...genericProject,
      taskTree: {
        ...genericProject.taskTree,
        children: [
          {
            ...genericProject.taskTree.children[0],
            title: "确认推荐仓库名单"
          }
        ]
      }
    };
    const initialState = {
      ...appState,
      projects: [...appState.projects, genericProject]
    };
    const renamedState = {
      ...appState,
      projects: [...appState.projects, renamedProject]
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path === "/api/projects/generic-project-1/tasks/task-1/title") {
        expect(init).toMatchObject({
          method: "PATCH",
          body: JSON.stringify({ title: "确认推荐仓库名单" })
        });
        return jsonResponse(renamedState);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "选择项目：整理播客选题" }));
    await user.click(screen.getByRole("button", { name: "任务更多操作：收集候选选题" }));
    await user.click(screen.getByRole("button", { name: "重命名" }));

    const renameInput = screen.getByRole("textbox", { name: "重命名任务：收集候选选题" });
    expect(renameInput).toHaveValue("收集候选选题");
    await user.clear(renameInput);
    await user.type(renameInput, "确认推荐仓库名单{enter}");

    expect(await screen.findByText("确认推荐仓库名单")).toBeInTheDocument();
  });

  it("deletes a non-root task from the context menu after confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const genericProject = {
      id: "generic-project-1",
      title: "整理播客选题",
      status: "active" as const,
      templateId: "generic-task",
      templateSnapshot: {
        templateId: "generic-task",
        templateName: "通用任务",
        stages: [],
        slots: [],
        minimumActions: [],
        warningRules: {}
      },
      recurrence: { kind: "none" as const },
      stages: [],
      progressObjects: [],
      slots: [],
      taskTree: {
        id: "generic-project-1-root",
        title: "整理播客选题",
        status: "not_started" as const,
        children: [
          {
            id: "task-1",
            title: "收集候选选题",
            status: "not_started" as const,
            children: [
              {
                id: "task-1-1",
                title: "翻收藏",
                status: "not_started" as const,
                children: [],
                createdAt: "2026-06-16T08:06:00.000Z",
                updatedAt: "2026-06-16T08:06:00.000Z"
              }
            ],
            createdAt: "2026-06-16T08:05:00.000Z",
            updatedAt: "2026-06-16T08:05:00.000Z"
          }
        ],
        createdAt: "2026-06-16T08:00:00.000Z",
        updatedAt: "2026-06-16T08:05:00.000Z"
      },
      createdAt: "2026-06-16T08:00:00.000Z",
      updatedAt: "2026-06-16T08:05:00.000Z"
    };
    const initialState = {
      ...appState,
      projects: [...appState.projects, genericProject]
    };
    const deletedState = {
      ...appState,
      projects: [
        ...appState.projects,
        {
          ...genericProject,
          taskTree: {
            ...genericProject.taskTree,
            children: []
          }
        }
      ]
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path === "/api/projects/generic-project-1/tasks/task-1") {
        expect(init).toMatchObject({
          method: "DELETE"
        });
        return jsonResponse(deletedState);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "选择项目：整理播客选题" }));
    await user.click(screen.getByRole("button", { name: "任务更多操作：收集候选选题" }));
    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(confirmSpy).toHaveBeenCalledWith("确定要删除这个任务吗？它会被物理删除，且下级任务也会一并删除。");
    await waitFor(() => {
      expect(screen.queryByText("收集候选选题")).not.toBeInTheDocument();
    });
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

  it("shows a blocking gate for unresolved parallel limit and lets the user select one active project", async () => {
    const user = userEvent.setup();
    const warningState = {
      ...appState,
      projects: [
        {
          ...appState.projects[0],
          status: "active" as const
        },
        {
          ...appState.projects[1],
          id: "project-2",
          title: "整理播客选题",
          status: "active" as const,
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
            id: "project-2-root",
            title: "整理播客选题",
            status: "not_started" as const,
            children: [],
            createdAt: "2026-06-16T08:00:00.000Z",
            updatedAt: "2026-06-16T08:00:00.000Z"
          }
        }
      ],
      settings: {
        ...appState.settings,
        activeProjectLimit: 1
      },
      warnings: [
        {
          id: "warning-1",
          type: "parallel_limit" as const,
          message: "进行中项目 2 / 1，超过并行上限。",
          severity: "blocking" as const,
          createdAt: "2026-06-16T08:10:00.000Z"
        }
      ],
      focusMode: {
        status: "inactive" as const
      }
    };
    const focusedState = {
      ...warningState,
      focusMode: {
        status: "active" as const,
        selectedProjectId: "project-2",
        selectedActionId: "start-five-minutes",
        session: {
          startedAt: "2026-06-16T08:11:00.000Z",
          durationMinutes: 5 as const
        }
      }
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(warningState);
      }
      if (path === "/api/focus/select") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({
            projectId: "project-2",
            selectedActionId: "start-five-minutes"
          })
        });
        return jsonResponse(focusedState);
      }
      return jsonResponse(warningState);
    });

    render(<App />);

    const gateTitle = await screen.findByRole("heading", { name: "进行中项目超出上限，先只选一个继续" });
    const gate = gateTitle.closest(".parallel-limit-gate-panel");
    expect(gate).not.toBeNull();
    expect(within(gate as HTMLElement).getByText("每周 GitHub 精选 2026-W25")).toBeInTheDocument();
    expect(within(gate as HTMLElement).getByText("整理播客选题")).toBeInTheDocument();
    expect(screen.queryByText("暂停的项目")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "选这个项目：先推进 5 分钟" }));

    expect(await screen.findByText("收束模式")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "进行中项目超出上限，先只选一个继续" })).not.toBeInTheDocument();
  });

  it("switches the detail panel to the selected focus project and disables new task navigation during focus mode", async () => {
    const user = userEvent.setup();
    const focusableProject = {
      ...appState.projects[1],
      id: "project-2",
      title: "整理播客选题",
      status: "active" as const,
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
        id: "project-2-root",
        title: "整理播客选题",
        status: "not_started" as const,
        children: [],
        createdAt: "2026-06-16T08:00:00.000Z",
        updatedAt: "2026-06-16T08:00:00.000Z"
      }
    };
    const warningState = {
      ...appState,
      projects: [{ ...appState.projects[0], status: "active" as const }, focusableProject],
      settings: {
        ...appState.settings,
        activeProjectLimit: 1
      },
      warnings: [
        {
          id: "warning-1",
          type: "parallel_limit" as const,
          message: "进行中项目 2 / 1，超过并行上限。",
          severity: "blocking" as const,
          createdAt: "2026-06-16T08:10:00.000Z"
        }
      ],
      focusMode: {
        status: "inactive" as const
      }
    };
    const focusedState = {
      ...warningState,
      focusMode: {
        status: "active" as const,
        selectedProjectId: "project-2",
        selectedActionId: "start-five-minutes",
        session: {
          startedAt: "2026-06-16T08:11:00.000Z",
          durationMinutes: 5 as const
        }
      }
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(warningState);
      }
      if (path === "/api/focus/select") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({
            projectId: "project-2",
            selectedActionId: "start-five-minutes"
          })
        });
        return jsonResponse(focusedState);
      }
      return jsonResponse(focusedState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "选这个项目：先推进 5 分钟" }));

    expect(await screen.findByRole("heading", { name: "整理播客选题" })).toBeInTheDocument();
    expect(screen.getByText("当前只推进：整理播客选题")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建任务" })).toBeDisabled();
  });

  it("keeps other projects visible but read-only during focus mode and allows ending focus mode", async () => {
    const user = userEvent.setup();
    const focusedProject = {
      ...appState.projects[0],
      status: "active" as const
    };
    const readOnlyProject = {
      ...appState.projects[1],
      id: "project-2",
      title: "整理播客选题",
      status: "active" as const,
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
        id: "project-2-root",
        title: "整理播客选题",
        status: "not_started" as const,
        children: [],
        createdAt: "2026-06-16T08:00:00.000Z",
        updatedAt: "2026-06-16T08:00:00.000Z"
      }
    };
    const focusedState = {
      ...appState,
      projects: [focusedProject, readOnlyProject],
      focusMode: {
        status: "active" as const,
        selectedProjectId: "project-1",
        selectedActionId: "test-one-repo",
        session: {
          startedAt: "2026-06-16T08:11:00.000Z",
          durationMinutes: 5 as const
        }
      }
    };
    const exitedState = {
      ...focusedState,
      focusMode: {
        status: "inactive" as const
      }
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(focusedState);
      }
      if (path === "/api/focus/exit") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({})
        });
        return jsonResponse(exitedState);
      }
      return jsonResponse(focusedState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "选择项目：整理播客选题" }));

    expect(screen.getByRole("heading", { name: "整理播客选题" })).toBeInTheDocument();
    expect(screen.getByText("收束模式下该项目只读")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂停项目" })).toBeDisabled();
    expect(screen.getByLabelText("添加到整理播客选题")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "结束收束" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/focus/exit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    );
    expect(await screen.findByRole("button", { name: "新建任务" })).not.toBeDisabled();
    expect(screen.queryByText("收束模式")).not.toBeInTheDocument();
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

  it("reopens a completed project from the detail panel", async () => {
    const user = userEvent.setup();
    const completedProject = {
      ...appState.projects[0],
      status: "completed" as const,
      completedFromStatus: "active" as const
    };
    const reopenedProject = {
      ...completedProject,
      status: "active" as const,
      completedFromStatus: undefined
    };
    const initialState = replaceProject(completedProject);
    const nextState = replaceProject(reopenedProject);

    globalThis.fetch = vi.fn(async (input) => {
      const path = String(input);
      return jsonResponse(path === "/api/state" ? initialState : nextState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "恢复为进行中" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-1/reopen",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    );
    expect(await screen.findByRole("button", { name: "暂停项目" })).toBeInTheDocument();
  });

  it("marks a project as abandoned and restores it from the abandoned group", async () => {
    const user = userEvent.setup();
    const abandonedProject = {
      ...appState.projects[0],
      status: "abandoned" as never,
      completedFromStatus: "active" as const
    };
    const abandonedState = replaceProject(abandonedProject as Project);
    const restoredState = replaceProject({
      ...appState.projects[0],
      status: "active" as const,
      completedFromStatus: undefined
    });

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(appState);
      }
      if (path === "/api/projects/project-1/status") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        return jsonResponse(body.status === "abandoned" ? abandonedState : restoredState);
      }
      if (path === "/api/projects/project-1/reopen") {
        return jsonResponse(restoredState);
      }
      return jsonResponse(appState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "放弃项目" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "abandoned" })
      })
    );
    expect(await screen.findByRole("button", { name: "恢复为进行中" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已放弃 1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "恢复为进行中" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-1/reopen",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    );
    expect(await screen.findByRole("button", { name: "暂停项目" })).toBeInTheDocument();
  });

  it("records project completion in feedback and removes it after reopening", async () => {
    const user = userEvent.setup();
    const completedProject = {
      ...appState.projects[0],
      status: "completed" as const,
      completedFromStatus: "active" as const
    };
    const completedState: AppState = {
      ...replaceProject(completedProject),
      activity: [
        ...appState.activity,
        {
          id: "activity-project-complete",
          projectId: "project-1",
          kind: "big",
          type: "project_completed",
          message: "项目完成：每周 GitHub 精选 2026-W25",
          createdAt: "2026-06-15T10:00:00.000Z"
        }
      ]
    };
    const reopenedState: AppState = replaceProject({
      ...appState.projects[0],
      status: "active" as const,
      completedFromStatus: undefined
    });

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(appState);
      }
      if (path === "/api/projects/project-1/status") {
        expect(init).toMatchObject({
          method: "PATCH",
          body: JSON.stringify({ status: "completed" })
        });
        return jsonResponse(completedState);
      }
      if (path === "/api/projects/project-1/reopen") {
        expect(init).toMatchObject({
          method: "POST",
          body: JSON.stringify({})
        });
        return jsonResponse(reopenedState);
      }
      return jsonResponse(appState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "标记完成" }));
    expect(await screen.findByText("项目完成：每周 GitHub 精选 2026-W25")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "恢复为进行中" }));
    expect(await screen.findByText("完成本周精选初稿")).toBeInTheDocument();
    expect(screen.queryByText("项目完成：每周 GitHub 精选 2026-W25")).not.toBeInTheDocument();
  });

  it("does not hide a project when the user cancels the confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    globalThis.fetch = vi.fn(async (input) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(appState);
      }
      return jsonResponse(appState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "隐藏项目" }));

    expect(confirmSpy).toHaveBeenCalledWith("确定要隐藏这个项目吗？隐藏后它会从界面中移除，但底层历史数据会保留。");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("每周 GitHub 精选 2026-W25").length).toBeGreaterThan(0);
  });

  it("hides a project from the visible list after confirmation without deleting its underlying data", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const hiddenProject = {
      ...appState.projects[0],
      hiddenAt: "2026-06-16T08:30:00.000Z"
    };
    const nextState = {
      ...appState,
      projects: [hiddenProject, appState.projects[1]]
    };

    globalThis.fetch = vi.fn(async (input) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(appState);
      }
      if (path === "/api/projects/project-1/hide") {
        return jsonResponse(nextState);
      }
      return jsonResponse(appState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "隐藏项目" }));

    expect(confirmSpy).toHaveBeenCalledWith("确定要隐藏这个项目吗？隐藏后它会从界面中移除，但底层历史数据会保留。");
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-1/hide",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({})
      })
    );
    expect(await screen.findByRole("heading", { name: "暂停的项目" })).toBeInTheDocument();
    expect(screen.queryAllByText("每周 GitHub 精选 2026-W25")).toHaveLength(0);
  });

  it("adds and completes generic task children from the detail panel with a checkbox", async () => {
    const user = userEvent.setup();
    const audioNodes = {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
    const audioContext = {
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(() => audioNodes),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn()
        }
      }))
    };
    vi.stubGlobal("AudioContext", vi.fn(() => audioContext));
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
    const completedProject = {
      ...projectWithChild,
      taskTree: {
        ...projectWithChild.taskTree,
        children: projectWithChild.taskTree.children.map((task) =>
          task.id === "task-1"
            ? {
                ...task,
                status: "completed" as const,
                feedbackRecordedAt: "2026-06-16T08:10:00.000Z",
                feedbackStatus: "completed" as const
              }
            : task
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
    const completedState = {
      ...initialState,
      projects: [...appState.projects, completedProject],
      activity: [
        ...appState.activity,
        {
          id: "activity-complete",
          projectId: "generic-project-1",
          kind: "small" as const,
          type: "task_completed" as const,
          message: "任务完成：收集候选选题",
          taskId: "task-1",
          createdAt: "2026-06-16T08:10:00.000Z"
        }
      ]
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path.includes("/children")) {
        return jsonResponse(childState);
      }
      if (path.includes("/tasks/task-1/status")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        return jsonResponse(body.status === "completed" ? completedState : initialState);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "选择项目：整理播客选题" }));
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

    await user.click(screen.getByRole("checkbox", { name: "收集候选选题" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/generic-project-1/tasks/task-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "completed" })
      })
    );
    expect(await screen.findByRole("checkbox", { name: "收集候选选题" })).toBeChecked();
    expect(AudioContext).toHaveBeenCalledTimes(1);
  });

  it("drops and restores generic tasks from the context menu", async () => {
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
        children: [
          {
            id: "task-1",
            title: "收集候选选题",
            status: "not_started" as const,
            children: [],
            createdAt: "2026-06-16T08:05:00.000Z",
            updatedAt: "2026-06-16T08:05:00.000Z"
          }
        ],
        createdAt: "2026-06-16T08:00:00.000Z",
        updatedAt: "2026-06-16T08:00:00.000Z"
      }
    };
    const droppedProject = {
      ...genericProject,
      taskTree: {
        ...genericProject.taskTree,
        children: genericProject.taskTree.children.map((task) =>
          task.id === "task-1"
            ? {
                ...task,
                status: "dropped" as const,
                feedbackRecordedAt: "2026-06-16T08:10:00.000Z",
                feedbackStatus: "dropped" as const
              }
            : task
        )
      }
    };
    const restoredProject = {
      ...genericProject,
      taskTree: {
        ...genericProject.taskTree,
        children: genericProject.taskTree.children.map((task) =>
          task.id === "task-1"
            ? {
                ...task,
                status: "not_started" as const,
                feedbackRecordedAt: undefined,
                feedbackStatus: undefined
              }
            : task
        )
      }
    };
    const initialState = {
      ...appState,
      projects: [...appState.projects, genericProject]
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
    const restoredState = {
      ...initialState,
      projects: [...appState.projects, restoredProject],
      activity: [...appState.activity]
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(initialState);
      }
      if (path.includes("/tasks/task-1/status")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        return jsonResponse(body.status === "dropped" ? droppedState : restoredState);
      }
      return jsonResponse(initialState);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "选择项目：整理播客选题" }));
    fireEvent.contextMenu(screen.getByText("收集候选选题"));
    await user.click(screen.getByRole("menuitem", { name: "不做了" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/generic-project-1/tasks/task-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "dropped" })
      })
    );
    expect(await screen.findByText("不做了")).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText("收集候选选题"));
    await user.click(screen.getByRole("menuitem", { name: "恢复为待办" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/generic-project-1/tasks/task-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "not_started" })
      })
    );
    expect(await screen.findByRole("checkbox", { name: "收集候选选题" })).not.toBeChecked();
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

    await user.click(screen.getByRole("button", { name: "选择项目：暂停的项目" }));

    expect(screen.getByRole("heading", { name: "暂停的项目" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择项目：暂停的项目" })).toHaveAttribute("aria-pressed", "true");
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

  it("renders the weekly GitHub project as a prebuilt todo tree", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "每周 GitHub 精选 2026-W25" })).toBeInTheDocument();
    expect(screen.getByText("任务拆解")).toBeInTheDocument();
    expect(screen.getByText("亲测候选仓库")).toBeInTheDocument();
    expect(screen.getByText("确定本周 5 个推荐")).toBeInTheDocument();
    expect(screen.getByText("抖音")).toBeInTheDocument();
    expect(screen.getByText("知乎")).toBeInTheDocument();
    expect(screen.queryByText("收集候选仓库")).not.toBeInTheDocument();
    expect(screen.queryByText("推荐 1")).not.toBeInTheDocument();
    expect(screen.queryByText("写推荐理由")).not.toBeInTheDocument();
    expect(screen.queryByText("阶段进度")).not.toBeInTheDocument();
    expect(screen.queryByText("成果槽位")).not.toBeInTheDocument();
  });

  it("renders weekly candidate actions and a derived selected list", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "将 whisper 标记为入选" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "将 whisper 标记为淘汰" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "将 whisper 标记为暂缓" })).toBeInTheDocument();
    expect(screen.getByText("已入选 1")).toBeInTheDocument();
    expect(screen.getAllByText("whisper").length).toBeGreaterThan(1);
    expect(screen.getByRole("checkbox", { name: "llms.txt" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "whisper" })).toBeChecked();
  });

  it("allows completing the derived weekly pick task itself", async () => {
    const user = userEvent.setup();
    const rootTask = appState.projects[0].taskTree;

    if (!rootTask) {
      throw new Error("weekly test fixture is missing task tree");
    }

    const completedProject = {
      ...appState.projects[0],
      taskTree: {
        ...rootTask,
        children: rootTask.children.map((task) =>
          task.id === "project-1-pick"
            ? {
                ...task,
                status: "completed" as const,
                feedbackRecordedAt: "2026-06-15T11:00:00.000Z",
                feedbackStatus: "completed" as const
              }
            : task
        )
      }
    };
    const nextState = {
      ...appState,
      projects: [completedProject, appState.projects[1]],
      activity: [
        ...appState.activity,
        {
          id: "activity-pick-complete",
          projectId: "project-1",
          kind: "big" as const,
          type: "task_completed" as const,
          message: "任务完成：确定本周 5 个推荐",
          taskId: "project-1-pick",
          createdAt: "2026-06-15T11:00:00.000Z"
        }
      ]
    };

    globalThis.fetch = vi.fn(async (input, init) => {
      const path = String(input);
      if (path === "/api/state") {
        return jsonResponse(appState);
      }
      if (path === "/api/projects/project-1/tasks/project-1-pick/status") {
        expect(init).toMatchObject({
          method: "PATCH",
          body: JSON.stringify({ status: "completed" })
        });
        return jsonResponse(nextState);
      }
      return jsonResponse(appState);
    });

    render(<App />);

    await user.click(await screen.findByRole("checkbox", { name: "确定本周 5 个推荐" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-1/tasks/project-1-pick/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "completed" })
      })
    );
    expect(await screen.findByRole("checkbox", { name: "确定本周 5 个推荐" })).toBeChecked();
  });
});
