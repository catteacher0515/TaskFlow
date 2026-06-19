import type { ActivityEntry, Project, TaskNode, TaskNodeStatus } from "./types";

const MAX_TASK_TREE_DEPTH = 3;
const terminalStatuses = new Set<TaskNodeStatus>(["completed", "dropped"]);
const closedStatuses = new Set<TaskNodeStatus>(["completed", "dropped", "unhandled"]);

export interface AddTaskChildInput {
  id: string;
  parentTaskId: string;
  title: string;
  now: string;
}

export interface TransitionTaskInput {
  activityId: string;
  taskId: string;
  nextStatus: TaskNodeStatus;
  now: string;
}

export interface RenameTaskInput {
  taskId: string;
  title: string;
  now: string;
}

export interface DeleteTaskInput {
  taskId: string;
  now: string;
}

export function createRootTask(input: { id: string; title: string; now: string }): TaskNode {
  return {
    id: input.id,
    title: input.title,
    status: "not_started",
    children: [],
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function createTaskNode(input: { id: string; title: string; now: string; children?: TaskNode[] }): TaskNode {
  return {
    id: input.id,
    title: input.title,
    status: "not_started",
    children: input.children ?? [],
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function addTaskChild(project: Project, input: AddTaskChildInput): Project {
  const taskTree = requireTaskTree(project);
  const child = createRootTask({
    id: input.id,
    title: input.title,
    now: input.now
  });
  const result = addChild(taskTree, input.parentTaskId, child, 1);

  if (!result.found) {
    throw new Error(`Unknown task: ${input.parentTaskId}`);
  }

  return {
    ...project,
    taskTree: result.node,
    updatedAt: input.now
  };
}

export function transitionTask(project: Project, input: TransitionTaskInput): { project: Project; activity?: ActivityEntry } {
  const taskTree = requireTaskTree(project);
  let targetBefore: TaskNode | undefined;
  let nextFeedbackStatus: "completed" | "dropped" | undefined;
  let shouldCreateFeedback = false;
  const shouldClearFeedback = input.nextStatus === "not_started";

  const result = updateTask(taskTree, input.taskId, (task, isRoot) => {
    targetBefore = task;

    if (task.status === input.nextStatus) {
      return task;
    }

    const isTerminal = terminalStatuses.has(input.nextStatus);
    nextFeedbackStatus = input.nextStatus === "completed" || input.nextStatus === "dropped" ? input.nextStatus : undefined;
    shouldCreateFeedback = isTerminal && !task.feedbackRecordedAt;

    return {
      ...task,
      status: input.nextStatus,
      children: isTerminal ? archiveUnhandled(task.children, input.now) : task.children,
      feedbackRecordedAt: shouldClearFeedback ? undefined : shouldCreateFeedback ? input.now : task.feedbackRecordedAt,
      feedbackStatus: shouldClearFeedback ? undefined : shouldCreateFeedback ? nextFeedbackStatus : task.feedbackStatus,
      updatedAt: input.now
    };
  });

  if (!result.found || !targetBefore) {
    throw new Error(`Unknown task: ${input.taskId}`);
  }

  if (targetBefore.status === input.nextStatus) {
    return { project };
  }

  const updatedProject = {
    ...project,
    taskTree: result.node,
    updatedAt: input.now
  };

  if (!shouldCreateFeedback || !nextFeedbackStatus) {
    return { project: updatedProject };
  }

  const isBigFeedback = targetBefore.children.length > 0 || targetBefore.id === taskTree.id;
  return {
    project: updatedProject,
    activity: {
      id: input.activityId,
      projectId: project.id,
      kind: isBigFeedback ? "big" : "small",
      type: nextFeedbackStatus === "dropped" ? "entropy_reduced" : "task_completed",
      message: nextFeedbackStatus === "dropped" ? `不做了：${targetBefore.title}` : `任务完成：${targetBefore.title}`,
      taskId: input.taskId,
      createdAt: input.now
    }
  };
}

export function renameTask(project: Project, input: RenameTaskInput): Project {
  const taskTree = requireTaskTree(project);
  const result = updateTask(taskTree, input.taskId, (task) => ({
    ...task,
    title: input.title,
    updatedAt: input.now
  }));

  if (!result.found) {
    throw new Error(`Unknown task: ${input.taskId}`);
  }

  return {
    ...project,
    taskTree: result.node,
    updatedAt: input.now
  };
}

export function deleteTask(project: Project, input: DeleteTaskInput): Project {
  const taskTree = requireTaskTree(project);

  if (taskTree.id === input.taskId) {
    throw new Error("Cannot delete root task");
  }

  const result = removeTask(taskTree, input.taskId, input.now);

  if (!result.found) {
    throw new Error(`Unknown task: ${input.taskId}`);
  }

  return {
    ...project,
    taskTree: result.node,
    updatedAt: input.now
  };
}

function requireTaskTree(project: Project): TaskNode {
  if (!project.taskTree) {
    throw new Error("Project does not define a task tree");
  }

  return project.taskTree;
}

function addChild(node: TaskNode, parentTaskId: string, child: TaskNode, depth: number): { node: TaskNode; found: boolean } {
  if (node.id === parentTaskId) {
    if (depth >= MAX_TASK_TREE_DEPTH) {
      throw new Error(`Task tree depth limit reached: ${parentTaskId}`);
    }

    return {
      found: true,
      node: {
        ...node,
        children: [...node.children, child],
        updatedAt: child.createdAt
      }
    };
  }

  let found = false;
  const children = node.children.map((item) => {
    const result = addChild(item, parentTaskId, child, depth + 1);
    if (result.found) {
      found = true;
    }

    return result.node;
  });

  return {
    found,
    node: found ? { ...node, children, updatedAt: child.createdAt } : node
  };
}

function updateTask(
  node: TaskNode,
  taskId: string,
  update: (task: TaskNode, isRoot: boolean) => TaskNode
): { node: TaskNode; found: boolean } {
  if (node.id === taskId) {
    return { node: update(node, true), found: true };
  }

  let found = false;
  const children = node.children.map((item) => {
    const result = updateTask(item, taskId, (task) => update(task, false));
    if (result.found) {
      found = true;
    }

    return result.node;
  });

  return {
    found,
    node: found ? { ...node, children } : node
  };
}

function removeTask(node: TaskNode, taskId: string, now: string): { node: TaskNode; found: boolean } {
  let found = false;
  const children = node.children.flatMap((child) => {
    if (child.id === taskId) {
      found = true;
      return [];
    }

    const result = removeTask(child, taskId, now);
    if (result.found) {
      found = true;
    }

    return [result.node];
  });

  return {
    found,
    node: found ? { ...node, children, updatedAt: now } : node
  };
}

function archiveUnhandled(children: TaskNode[], now: string): TaskNode[] {
  return children.map((child) => {
    if (closedStatuses.has(child.status)) {
      return {
        ...child,
        children: archiveUnhandled(child.children, now)
      };
    }

    return {
      ...child,
      status: "unhandled",
      children: archiveUnhandled(child.children, now),
      updatedAt: now
    };
  });
}
