import type { Template } from "./types";

export const weeklyGithubTemplate = {
  id: "weekly-github-picks",
  name: "每周 GitHub 精选",
  description: "亲测候选仓库，选出 5 个值得推荐的项目，并完成文章发布。",
  stages: [
    { id: "collect", name: "候选收集" },
    { id: "hands_on", name: "亲测" },
    { id: "select", name: "推荐选择" },
    { id: "write_reasons", name: "推荐理由写作" },
    { id: "draft", name: "成稿" },
    { id: "publish", name: "发布" }
  ],
  progressObject: {
    name: "候选仓库",
    fields: ["repoName", "url", "source", "notes", "testLog", "decisionReason"],
    states: [
      { id: "untested", name: "未测", category: "open" },
      { id: "testing", name: "测试中", category: "in_progress" },
      { id: "selected", name: "入选", category: "concluded" },
      { id: "maybe", name: "备选", category: "concluded" },
      { id: "rejected", name: "淘汰", category: "concluded" }
    ],
    feedbackStateIds: ["selected", "maybe", "rejected"]
  },
  slots: [
    { id: "recommendation-1", name: "推荐 1" },
    { id: "recommendation-2", name: "推荐 2" },
    { id: "recommendation-3", name: "推荐 3" },
    { id: "recommendation-4", name: "推荐 4" },
    { id: "recommendation-5", name: "推荐 5" }
  ],
  minimumActions: [
    { id: "test-one-repo", label: "亲测 1 个候选仓库" },
    { id: "write-one-decision", label: "给 1 个候选仓库写结论理由" },
    { id: "fill-one-slot", label: "填入 1 个推荐槽位" },
    { id: "draft-one-reason", label: "写完 1 个推荐理由草稿" }
  ],
  recurrence: {
    supportedRules: ["none", "daily", "weekly", "monthly", "workdays", "custom_interval"],
    defaultRule: { kind: "weekly" }
  },
  warningRules: {
    parallelLimit: { useGlobalLimit: true },
    deadlineRisk: {
      daysBeforeDeadline: 2,
      requiredFilledSlotRatio: 1,
      requiredStageId: "write_reasons"
    },
    stagnation: {
      daysWithoutActivity: 2
    }
  }
} satisfies Template;
