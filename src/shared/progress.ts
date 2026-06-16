import type { ActivityEntry, Project, ProgressObjectInstance } from "./types";

interface AddProgressObjectInput {
  id: string;
  title: string;
  fields: Record<string, string>;
  now: string;
}

interface TransitionInput {
  activityId: string;
  progressObjectId: string;
  nextStateId: string;
  note: string;
  now: string;
}

interface FillSlotInput {
  activityId: string;
  slotId: string;
  progressObjectId: string;
  now: string;
}

interface AdvanceStageInput {
  activityId: string;
  completedStageId: string;
  nextStageId?: string;
  now: string;
}

export function addProgressObject(project: Project, input: AddProgressObjectInput): Project {
  const definition = project.templateSnapshot.progressObject;

  if (!definition) {
    throw new Error("Project template does not define progress objects");
  }

  const initialState = definition.states[0];

  if (!initialState) {
    throw new Error("Progress object definition must include at least one state");
  }

  const progressObject: ProgressObjectInstance = {
    id: input.id,
    title: input.title,
    stateId: initialState.id,
    fields: { ...input.fields },
    createdAt: input.now,
    updatedAt: input.now
  };

  return {
    ...project,
    progressObjects: [...project.progressObjects, progressObject],
    updatedAt: input.now
  };
}

export function transitionProgressObject(project: Project, input: TransitionInput): { project: Project; activity?: ActivityEntry } {
  const definition = project.templateSnapshot.progressObject;

  if (!definition) {
    throw new Error("Project template does not define progress objects");
  }

  const nextState = definition.states.find((state) => state.id === input.nextStateId);

  if (!nextState) {
    throw new Error(`Unknown progress state: ${input.nextStateId}`);
  }

  let found = false;
  let targetTitle = "";
  let shouldCreateFeedback = false;
  let isNoOp = false;
  const progressObjects = project.progressObjects.map((item) => {
    if (item.id !== input.progressObjectId) {
      return item;
    }

    found = true;
    targetTitle = item.title;

    if (item.stateId === input.nextStateId) {
      isNoOp = true;
      return item;
    }

    const isFeedbackState = definition.feedbackStateIds.includes(input.nextStateId);
    shouldCreateFeedback = isFeedbackState && !item.feedbackRecordedAt;

    return {
      ...item,
      stateId: input.nextStateId,
      feedbackRecordedAt: shouldCreateFeedback ? input.now : item.feedbackRecordedAt,
      feedbackStateId: shouldCreateFeedback ? input.nextStateId : item.feedbackStateId,
      updatedAt: input.now
    };
  });

  if (!found) {
    throw new Error(`Unknown progress object: ${input.progressObjectId}`);
  }

  if (isNoOp) {
    return { project };
  }

  const updatedProject = {
    ...project,
    progressObjects,
    updatedAt: input.now
  };

  if (!shouldCreateFeedback) {
    return { project: updatedProject };
  }

  return {
    project: updatedProject,
    activity: {
      id: input.activityId,
      projectId: project.id,
      kind: "small",
      message: `${definition.name} ${targetTitle} 进入 ${nextState.name}：${input.note}`,
      progressObjectId: input.progressObjectId,
      createdAt: input.now
    }
  };
}

export function fillSlot(project: Project, input: FillSlotInput): { project: Project; activity: ActivityEntry } {
  const progressObject = project.progressObjects.find((item) => item.id === input.progressObjectId);

  if (!progressObject) {
    throw new Error(`Unknown progress object: ${input.progressObjectId}`);
  }

  let found = false;
  let slotName = "";
  const slots = project.slots.map((slot) => {
    if (slot.id !== input.slotId) {
      return slot;
    }

    found = true;

    if (slot.progressObjectId) {
      throw new Error(`Slot already filled: ${input.slotId}`);
    }

    slotName = slot.name;
    return {
      ...slot,
      progressObjectId: input.progressObjectId,
      filledAt: input.now
    };
  });

  if (!found) {
    throw new Error(`Unknown slot: ${input.slotId}`);
  }

  const filledCount = slots.filter((slot) => slot.progressObjectId).length;

  return {
    project: {
      ...project,
      slots,
      updatedAt: input.now
    },
    activity: {
      id: input.activityId,
      projectId: project.id,
      kind: "big",
      message: `${slotName} 已填入 ${progressObject.title}，槽位进度 ${filledCount} / ${slots.length}`,
      slotId: input.slotId,
      progressObjectId: input.progressObjectId,
      createdAt: input.now
    }
  };
}

export function advanceStage(project: Project, input: AdvanceStageInput): { project: Project; activity: ActivityEntry } {
  const completedStageIndex = project.stages.findIndex((stage) => stage.id === input.completedStageId);

  if (completedStageIndex < 0) {
    throw new Error(`Unknown stage: ${input.completedStageId}`);
  }

  const completedStage = project.stages[completedStageIndex];

  if (completedStage.status !== "active") {
    throw new Error(`Stage is not active: ${input.completedStageId}`);
  }

  const expectedNextStageIndex = completedStageIndex + 1;
  const hasNextStage = expectedNextStageIndex < project.stages.length;

  if (!input.nextStageId && hasNextStage) {
    throw new Error("Next stage is required");
  }

  const nextStageIndex = input.nextStageId
    ? project.stages.findIndex((stage) => stage.id === input.nextStageId)
    : -1;

  if (input.nextStageId && nextStageIndex < 0) {
    throw new Error(`Unknown next stage: ${input.nextStageId}`);
  }

  if (input.nextStageId && nextStageIndex !== expectedNextStageIndex) {
    throw new Error(`Next stage must follow completed stage: ${input.completedStageId} -> ${input.nextStageId}`);
  }

  if (input.nextStageId && project.stages[nextStageIndex].status !== "not_started") {
    throw new Error(`Next stage is not ready: ${input.nextStageId}`);
  }

  const stages = project.stages.map((stage, index) => {
    if (index === completedStageIndex) {
      return { ...stage, status: "completed" as const };
    }

    if (index === nextStageIndex) {
      return { ...stage, status: "active" as const };
    }

    return stage;
  });

  return {
    project: {
      ...project,
      stages,
      updatedAt: input.now
    },
    activity: {
      id: input.activityId,
      projectId: project.id,
      kind: "big",
      message: `阶段完成：${completedStage.name}`,
      stageId: completedStage.id,
      createdAt: input.now
    }
  };
}
