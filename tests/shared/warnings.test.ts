import { describe, expect, it } from "vitest";
import { createProjectFromTemplate } from "../../src/shared/projectFactory";
import type { ActivityEntry, Project, Settings, Template } from "../../src/shared/types";
import { evaluateWarnings } from "../../src/shared/warnings";

const settings: Settings = {
  dataVersion: 1,
  activeProjectLimit: 2,
  defaultStagnationDays: 5
};

const warningTemplate: Template = {
  id: "warning-fixture",
  name: "告警夹具模板",
  description: "用于验证并行、截止和停滞告警规则。",
  stages: [
    { id: "collect", name: "候选收集" },
    { id: "hands_on", name: "亲测候选" },
    { id: "publish", name: "发布" }
  ],
  progressObject: {
    name: "候选仓库",
    fields: ["url"],
    states: [
      { id: "untested", name: "待测试", category: "open" },
      { id: "selected", name: "已选中", category: "concluded" }
    ],
    feedbackStateIds: ["selected"]
  },
  slots: [
    { id: "recommendation-1", name: "推荐 1" },
    { id: "recommendation-2", name: "推荐 2" }
  ],
  minimumActions: [{ id: "confirm-one-pick", label: "确认 1 个推荐位" }],
  recurrence: {
    supportedRules: ["none", "weekly"],
    defaultRule: { kind: "weekly" }
  },
  warningRules: {
    parallelLimit: { useGlobalLimit: true },
    deadlineRisk: {
      daysBeforeDeadline: 2,
      requiredFilledSlotRatio: 1,
      requiredStageId: "publish"
    },
    stagnation: { daysWithoutActivity: 2 }
  }
};

function makeProject(overrides: Partial<Project> = {}): Project {
  const project = createProjectFromTemplate({
    id: overrides.id ?? "project-1",
    template: warningTemplate,
    title: overrides.title ?? "每周 GitHub 精选 2026-W25",
    deadline: overrides.deadline,
    recurrence: { kind: "weekly" },
    now: overrides.createdAt ?? "2026-06-10T10:00:00.000Z"
  });

  return {
    ...project,
    ...overrides
  };
}

describe("evaluateWarnings", () => {
  it("returns a blocking parallel limit warning when active projects exceed the configured limit", () => {
    const warnings = evaluateWarnings({
      settings,
      projects: [
        makeProject({ id: "project-1", status: "active" }),
        makeProject({ id: "project-2", status: "active" }),
        makeProject({ id: "project-3", status: "active" }),
        makeProject({ id: "project-4", status: "paused" })
      ],
      activity: [],
      now: "2026-06-16T10:00:00.000Z"
    });

    expect(warnings).toContainEqual(
      expect.objectContaining({
        id: "parallel-limit-2026-06-16T10:00:00.000Z",
        type: "parallel_limit",
        severity: "blocking",
        createdAt: "2026-06-16T10:00:00.000Z"
      })
    );
    expect(warnings.find((warning) => warning.type === "parallel_limit")?.message).toContain("进行中项目 3 / 2");
  });

  it("ignores hidden projects when counting parallel limit and project warnings", () => {
    const warnings = evaluateWarnings({
      settings,
      projects: [
        makeProject({ id: "project-1", status: "active" }),
        makeProject({ id: "project-2", status: "active", hiddenAt: "2026-06-16T09:30:00.000Z" } as never),
        makeProject({ id: "project-3", status: "active" })
      ],
      activity: [],
      now: "2026-06-16T10:00:00.000Z"
    });

    expect(warnings).not.toContainEqual(
      expect.objectContaining({
        type: "parallel_limit"
      })
    );
    expect(warnings.every((warning) => warning.projectId !== "project-2")).toBe(true);
  });

  it("returns a blocking deadline risk warning for a near deadline with insufficient slots and stage progress", () => {
    const warnings = evaluateWarnings({
      settings,
      projects: [
        makeProject({
          id: "deadline-project",
          deadline: "2026-06-17T10:00:00.000Z",
          status: "active"
        })
      ],
      activity: [],
      now: "2026-06-16T10:00:00.000Z"
    });

    expect(warnings).toContainEqual(
      expect.objectContaining({
        id: "deadline-risk-deadline-project-2026-06-16T10:00:00.000Z",
        type: "deadline_risk",
        projectId: "deadline-project",
        severity: "blocking",
        createdAt: "2026-06-16T10:00:00.000Z"
      })
    );
  });

  it("returns a blocking stagnation warning when an active project has no recent activity", () => {
    const activity: ActivityEntry[] = [
      {
        id: "activity-old",
        projectId: "stale-project",
        kind: "small",
        message: "旧反馈",
        createdAt: "2026-06-12T09:00:00.000Z"
      },
      {
        id: "activity-other",
        projectId: "other-project",
        kind: "small",
        message: "其他项目反馈",
        createdAt: "2026-06-16T09:00:00.000Z"
      }
    ];

    const warnings = evaluateWarnings({
      settings,
      projects: [
        makeProject({
          id: "stale-project",
          status: "active",
          updatedAt: "2026-06-15T10:00:00.000Z"
        })
      ],
      activity,
      now: "2026-06-16T10:00:00.000Z"
    });

    expect(warnings).toContainEqual(
      expect.objectContaining({
        id: "stagnation-stale-project-2026-06-16T10:00:00.000Z",
        type: "stagnation",
        projectId: "stale-project",
        severity: "blocking",
        createdAt: "2026-06-16T10:00:00.000Z"
      })
    );
  });

  it("uses calendar days for stagnation thresholds", () => {
    const warnings = evaluateWarnings({
      settings,
      projects: [
        makeProject({
          id: "calendar-stale-project",
          status: "active",
          updatedAt: "2026-06-14T00:10:00.000Z"
        })
      ],
      activity: [],
      now: "2026-06-16T00:05:00.000Z"
    });

    expect(warnings).toContainEqual(
      expect.objectContaining({
        type: "stagnation",
        projectId: "calendar-stale-project",
        severity: "blocking"
      })
    );
  });

  it("treats empty slots as incomplete when a deadline rule requires filled slots", () => {
    const project = makeProject({
      id: "empty-slot-project",
      deadline: "2026-06-17T10:00:00.000Z",
      status: "active",
      slots: [],
      templateSnapshot: {
        ...makeProject().templateSnapshot,
        slots: [],
        warningRules: {
          deadlineRisk: {
            daysBeforeDeadline: 2,
            requiredFilledSlotRatio: 1
          }
        }
      }
    });

    const warnings = evaluateWarnings({
      settings,
      projects: [project],
      activity: [],
      now: "2026-06-16T10:00:00.000Z"
    });

    expect(warnings).toContainEqual(
      expect.objectContaining({
        type: "deadline_risk",
        projectId: "empty-slot-project",
        severity: "blocking"
      })
    );
  });

  it("ignores invalid activity timestamps when checking stagnation", () => {
    const activity: ActivityEntry[] = [
      {
        id: "activity-invalid",
        projectId: "invalid-activity-project",
        kind: "small",
        message: "坏数据",
        createdAt: "not-a-date"
      },
      {
        id: "activity-recent",
        projectId: "invalid-activity-project",
        kind: "small",
        message: "近期反馈",
        createdAt: "2026-06-16T09:00:00.000Z"
      }
    ];

    const warnings = evaluateWarnings({
      settings,
      projects: [
        makeProject({
          id: "invalid-activity-project",
          status: "active",
          updatedAt: "2026-06-12T08:00:00.000Z"
        })
      ],
      activity,
      now: "2026-06-16T10:00:00.000Z"
    });

    expect(warnings).not.toContainEqual(
      expect.objectContaining({
        type: "stagnation",
        projectId: "invalid-activity-project",
        severity: "blocking"
      })
    );
  });

  it("ignores invalid deadline window configuration", () => {
    const project = makeProject({
      id: "invalid-deadline-window-project",
      deadline: "2026-06-20T10:00:00.000Z",
      status: "active",
      templateSnapshot: {
        ...makeProject().templateSnapshot,
        warningRules: {
          deadlineRisk: {
            daysBeforeDeadline: Number.NaN,
            requiredFilledSlotRatio: 1
          }
        }
      }
    });

    const warnings = evaluateWarnings({
      settings,
      projects: [project],
      activity: [],
      now: "2026-06-16T10:00:00.000Z"
    });

    expect(warnings).not.toContainEqual(
      expect.objectContaining({
        type: "deadline_risk",
        projectId: "invalid-deadline-window-project",
        severity: "blocking"
      })
    );
  });
});
