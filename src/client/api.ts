import type {
  AppState,
  FocusSessionResult,
  HabitPeriod,
  Project,
  ProjectStatus,
  RecurrenceRule,
  TaskNodeStatus,
  Template
} from "../shared/types";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers }
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;

    try {
      const body = await response.json() as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep the status-based message when the response is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function fetchState(): Promise<AppState> {
  const state = await request<Partial<AppState>>("/api/state");

  return {
    ...state,
    habits: Array.isArray(state.habits) ? state.habits : [],
    habitRecords: Array.isArray(state.habitRecords) ? state.habitRecords : [],
    emotionEntries: Array.isArray(state.emotionEntries) ? state.emotionEntries : [],
    activity: Array.isArray(state.activity) ? state.activity : [],
    warnings: Array.isArray(state.warnings) ? state.warnings : [],
    focusMode: state.focusMode ?? { status: "inactive" }
  } as AppState;
}

export function createHabitApi(payload: {
  title: string;
  schedule: { weekdays: number[] };
  period: HabitPeriod;
}): Promise<AppState> {
  return request<AppState>("/api/habits", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function completeHabitApi(habitId: string, date: string): Promise<AppState> {
  return request<AppState>(`/api/habits/${habitId}/records/${date}`, {
    method: "PUT",
    body: JSON.stringify({ status: "completed" })
  });
}

export function archiveHabitApi(habitId: string): Promise<AppState> {
  return request<AppState>(`/api/habits/${habitId}/archive`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function updateHabitApi(habitId: string, payload: {
  title: string;
  schedule: { weekdays: number[] };
  period: HabitPeriod;
}): Promise<AppState> {
  return request<AppState>(`/api/habits/${habitId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export interface CreateProjectPayload {
  title: string;
  templateId: string;
  recurrence: RecurrenceRule;
  deadline?: string;
}

export interface CreateProjectResult {
  project: Project;
  state: AppState;
}

export function createProjectApi(payload: CreateProjectPayload): Promise<CreateProjectResult> {
  return request<CreateProjectResult>("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateProjectStatusApi(projectId: string, status: ProjectStatus): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function updateProjectTitleApi(projectId: string, title: string): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/title`, {
    method: "PATCH",
    body: JSON.stringify({ title })
  });
}

export function reopenProjectApi(projectId: string): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/reopen`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export interface CreateProgressObjectPayload {
  title: string;
  fields: Record<string, string>;
}

export interface TransitionProgressObjectPayload {
  nextStateId: string;
  note: string;
}

export interface FillSlotPayload {
  progressObjectId: string;
}

export function createProgressObject(projectId: string, payload: CreateProgressObjectPayload): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/progress-objects`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function transitionProgressObjectApi(
  projectId: string,
  progressObjectId: string,
  payload: TransitionProgressObjectPayload
): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/progress-objects/${progressObjectId}/state`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fillSlotApi(projectId: string, slotId: string, payload: FillSlotPayload): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/slots/${slotId}/fill`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function addTaskChildApi(projectId: string, taskId: string, payload: { title: string }): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/tasks/${taskId}/children`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateTaskStatusApi(projectId: string, taskId: string, status: TaskNodeStatus): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function updateTaskTitleApi(projectId: string, taskId: string, title: string): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/tasks/${taskId}/title`, {
    method: "PATCH",
    body: JSON.stringify({ title })
  });
}

export function deleteTaskApi(projectId: string, taskId: string): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: "DELETE"
  });
}

export function saveTemplate(template: Template): Promise<AppState> {
  return request<AppState>(`/api/templates/${template.id}`, {
    method: "PUT",
    body: JSON.stringify(template)
  });
}

export interface SelectFocusProjectPayload {
  projectId: string;
  selectedActionId?: string;
  customActionLabel?: string;
}

export function selectFocusProjectApi(payload: SelectFocusProjectPayload): Promise<AppState> {
  return request<AppState>("/api/focus/select", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function completeFocusSessionApi(payload: { result: FocusSessionResult }): Promise<AppState> {
  return request<AppState>("/api/focus/complete-session", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function exitFocusModeApi(): Promise<AppState> {
  return request<AppState>("/api/focus/exit", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function hideProjectApi(projectId: string): Promise<AppState> {
  return request<AppState>(`/api/projects/${projectId}/hide`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function revokeActivityApi(activityId: string): Promise<AppState> {
  return request<AppState>(`/api/activity/${activityId}/revoke`, {
    method: "POST",
    body: JSON.stringify({})
  });
}
