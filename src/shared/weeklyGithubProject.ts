import type { Project, TaskNode, TaskNodeStatus } from "./types";
import { createTaskNode, createRootTask } from "./taskTree";

export const WEEKLY_GITHUB_TEMPLATE_ID = "weekly-github-picks";
export const WEEKLY_GITHUB_PUBLISH_CHANNELS = ["抖音", "知乎", "B站", "小红书", "编程导航", "稀土掘金"] as const;

const HANDS_ON_SECTION_ID = "hands-on";
const PICK_SECTION_ID = "pick";
const DRAFT_SECTION_ID = "draft";
const PUBLISH_SECTION_ID = "publish";

export function isWeeklyGithubProject(project: { templateId?: string }) {
  return project.templateId === WEEKLY_GITHUB_TEMPLATE_ID;
}

export function buildWeeklyGithubTaskTree(projectId: string, title: string, now: string) {
  return {
    ...createRootTask({
      id: `${projectId}-root`,
      title,
      now
    }),
    children: [
      createTaskNode({ id: `${projectId}-${HANDS_ON_SECTION_ID}`, title: "亲测候选仓库", now }),
      createTaskNode({ id: `${projectId}-${PICK_SECTION_ID}`, title: "确定本周 5 个推荐", now }),
      createTaskNode({ id: `${projectId}-${DRAFT_SECTION_ID}`, title: "成稿", now }),
      createTaskNode({
        id: `${projectId}-${PUBLISH_SECTION_ID}`,
        title: "发布",
        now,
        children: WEEKLY_GITHUB_PUBLISH_CHANNELS.map((channel, index) =>
          createTaskNode({
            id: `${projectId}-${PUBLISH_SECTION_ID}-${index + 1}`,
            title: channel,
            now
          })
        )
      })
    ]
  };
}

export function normalizeWeeklyGithubTaskTree(project: Project): TaskNode {
  const fallback = buildWeeklyGithubTaskTree(project.id, project.title, project.createdAt);
  const sourceRoot = project.taskTree ?? fallback;
  const handsOnSection = findSection(sourceRoot, ["亲测候选仓库"]);
  const collectSection = findSection(sourceRoot, ["收集候选仓库"]);
  const draftSection = findSection(sourceRoot, ["成稿"]);
  const publishSection = findSection(sourceRoot, ["发布"]);

  const handsOnCandidates = dedupeTasks([
    ...mapLegacyProgressObjects(project),
    ...sanitizeChildren(collectSection?.children ?? []),
    ...sanitizeChildren(handsOnSection?.children ?? [])
  ]);

  return {
    ...fallback,
    children: [
      {
        ...fallback.children[0],
        children: handsOnCandidates
      },
      {
        ...fallback.children[1],
        children: []
      },
      {
        ...fallback.children[2],
        status: draftSection?.status ?? fallback.children[2].status,
        children: sanitizeChildren(draftSection?.children ?? []),
        feedbackRecordedAt: draftSection?.feedbackRecordedAt,
        feedbackStatus: draftSection?.feedbackStatus,
        updatedAt: draftSection?.updatedAt ?? fallback.children[2].updatedAt
      },
      {
        ...fallback.children[3],
        status: publishSection?.status ?? fallback.children[3].status,
        children: mergePublishChildren(fallback.children[3].children, publishSection?.children ?? []),
        feedbackRecordedAt: publishSection?.feedbackRecordedAt,
        feedbackStatus: publishSection?.feedbackStatus,
        updatedAt: publishSection?.updatedAt ?? fallback.children[3].updatedAt
      }
    ]
  };
}

export function weeklyGithubSelectedCandidates(rootTask: TaskNode): TaskNode[] {
  const handsOnSection = findSection(rootTask, ["亲测候选仓库"]);
  if (!handsOnSection) {
    return [];
  }

  return handsOnSection.children.filter((task) => task.status === "completed");
}

export function isWeeklyGithubCandidateStatus(status: TaskNodeStatus) {
  return status === "completed" || status === "dropped" || status === "unhandled";
}

function findSection(rootTask: TaskNode, titles: string[]) {
  return rootTask.children.find((task) => titles.includes(task.title));
}

function sanitizeChildren(children: TaskNode[]): TaskNode[] {
  return children.map((child) => ({
    ...child,
    children: sanitizeChildren(child.children)
  }));
}

function dedupeTasks(tasks: TaskNode[]) {
  const seen = new Set<string>();
  const result: TaskNode[] = [];

  for (const task of tasks) {
    const key = task.id || task.title;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(task);
  }

  return result;
}

function mergePublishChildren(defaultChildren: TaskNode[], existingChildren: TaskNode[]) {
  return defaultChildren.map((defaultChild) => {
    const match = existingChildren.find((child) => child.title === defaultChild.title);
    if (!match) {
      return defaultChild;
    }

    return {
      ...defaultChild,
      status: match.status,
      children: sanitizeChildren(match.children),
      feedbackRecordedAt: match.feedbackRecordedAt,
      feedbackStatus: match.feedbackStatus,
      updatedAt: match.updatedAt
    };
  });
}

function mapLegacyProgressObjects(project: Project): TaskNode[] {
  return project.progressObjects.map((object) => ({
    id: object.id,
    title: object.title,
    status: mapLegacyProgressState(object.stateId),
    children: [],
    feedbackRecordedAt: object.feedbackRecordedAt,
    feedbackStatus:
      object.stateId === "selected" ? "completed" : object.stateId === "rejected" ? "dropped" : undefined,
    createdAt: object.createdAt,
    updatedAt: object.updatedAt
  }));
}

function mapLegacyProgressState(stateId: string): TaskNodeStatus {
  if (stateId === "selected") {
    return "completed";
  }

  if (stateId === "rejected") {
    return "dropped";
  }

  if (stateId === "maybe") {
    return "unhandled";
  }

  return "not_started";
}
