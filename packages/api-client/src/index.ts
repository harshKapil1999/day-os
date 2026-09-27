import type { CreateHabitInput, CreateTaskInput, OnboardingInput, UpdateProfileInput, UpdateTaskInput } from "@dayos/contracts";
import type { Task, TimeBlock, UserProfile } from "@dayos/domain";

export class DayOSApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

export interface ClientOptions { baseUrl: string; getToken?: () => Promise<string | null>; fetch?: typeof globalThis.fetch; }

export function createDayOSClient(options: ClientOptions) {
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await options.getToken?.();
    const response = await (options.fetch ?? globalThis.fetch)(`${options.baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers }
    });
    const body = await response.json() as { data?: T; error?: { code: string; message: string } };
    if (!response.ok || body.error) throw new DayOSApiError(body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? "The request failed.", response.status);
    return body.data as T;
  };

  return {
    me: { get: () => request<UserProfile>("/me"), update: (input: UpdateProfileInput) => request<UserProfile>("/me", { method: "PATCH", body: JSON.stringify(input) }), onboard: (input: OnboardingInput) => request<UserProfile>("/onboarding", { method: "POST", body: JSON.stringify(input) }) },
    tasks: {
      list: () => request<Task[]>("/tasks"), create: (input: CreateTaskInput) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(input) }),
      update: (id: string, input: UpdateTaskInput) => request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
      delete: (id: string) => request<{ id: string }>(`/tasks/${id}`, { method: "DELETE" }), complete: (id: string) => request<Task>(`/tasks/${id}/complete`, { method: "POST" }),
      backlog: (id: string) => request<Task>(`/tasks/${id}/backlog`, { method: "POST" })
    },
    habits: { list: () => request<unknown[]>("/habits"), create: (input: CreateHabitInput) => request<unknown>("/habits", { method: "POST", body: JSON.stringify(input) }), update: (id: string, input: Partial<CreateHabitInput> & { active?: boolean }) => request<unknown>(`/habits/${id}`, { method: "PATCH", body: JSON.stringify(input) }), delete: (id: string) => request<{ id: string }>(`/habits/${id}`, { method: "DELETE" }), complete: (id: string) => request<unknown>(`/habits/${id}/complete`, { method: "POST" }) },
    plans: { today: () => request<{ id: string; blocks: TimeBlock[] }>("/plans/today"), generate: () => request<{ id: string; blocks: TimeBlock[] }>("/plans/generate", { method: "POST" }), week: (startDate: string) => request<{ plans: Array<{ id: string; date: string; blocks: TimeBlock[] }>; blocks: TimeBlock[] }>(`/plans/week?start=${encodeURIComponent(startDate)}`), generateWeek: (startDate: string) => request<{ plans: Array<{ id: string; date: string; blocks: TimeBlock[] }>; blocks: TimeBlock[] }>("/plans/week", { method: "POST", body: JSON.stringify({ startDate }) }), rebalance: (id: string, reason: string) => request<{ id: string; blocks: TimeBlock[] }>(`/plans/${id}/rebalance`, { method: "POST", body: JSON.stringify({ reason }) }) },
    timeBlocks: { update: (id: string, input: { startAt: string; endAt: string }) => request<TimeBlock>(`/time-blocks/${id}`, { method: "PATCH", body: JSON.stringify(input) }), complete: (id: string) => request<TimeBlock>(`/time-blocks/${id}/complete`, { method: "POST" }), skip: (id: string) => request<TimeBlock>(`/time-blocks/${id}/skip`, { method: "POST" }) },
    focus: { start: (input: { timeBlockId?: string; taskId?: string; plannedMinutes: number }) => request<{ id: string }>("/focus-sessions", { method: "POST", body: JSON.stringify(input) }), finish: (id: string, input: { completionState: "COMPLETE" | "PARTIAL" | "NOT_COMPLETE"; focusRating: number; energyRating?: number }) => request<unknown>(`/focus-sessions/${id}/finish`, { method: "POST", body: JSON.stringify(input) }) },
    hydration: { today: () => request<{ totalMl: number; targetMl: number }>("/hydration/today"), log: (amountMl: number) => request<{ totalMl: number; targetMl: number }>("/hydration", { method: "POST", body: JSON.stringify({ amountMl }) }) },
    insights: { weekly: () => request<unknown>("/insights/weekly") },
    reflections: { get: (date: string) => request<{ id: string; date: string; dayRating: number; energyRating: number; focusRating: number; notes?: string }>(`/reflections/${encodeURIComponent(date)}`), create: (input: { dayRating: number; energyRating: number; focusRating: number; notes?: string }) => request<{ id: string; date: string; dayRating: number; energyRating: number; focusRating: number; notes?: string }>("/reflections", { method: "POST", body: JSON.stringify(input) }) }
  };
}

export type DayOSClient = ReturnType<typeof createDayOSClient>;
