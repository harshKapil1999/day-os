import type { CreateHabitInput, CreateTaskInput, OnboardingInput, UpdateTaskInput } from "@dayos/contracts";
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
    me: { get: () => request<UserProfile>("/me"), update: (input: Partial<UserProfile>) => request<UserProfile>("/me", { method: "PATCH", body: JSON.stringify(input) }), onboard: (input: OnboardingInput) => request<UserProfile>("/onboarding", { method: "POST", body: JSON.stringify(input) }) },
    tasks: {
      list: () => request<Task[]>("/tasks"), create: (input: CreateTaskInput) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(input) }),
      update: (id: string, input: UpdateTaskInput) => request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
      delete: (id: string) => request<{ id: string }>(`/tasks/${id}`, { method: "DELETE" }), complete: (id: string) => request<Task>(`/tasks/${id}/complete`, { method: "POST" }),
      backlog: (id: string) => request<Task>(`/tasks/${id}/backlog`, { method: "POST" })
    },
    habits: { list: () => request<unknown[]>("/habits"), create: (input: CreateHabitInput) => request<unknown>("/habits", { method: "POST", body: JSON.stringify(input) }), complete: (id: string) => request<unknown>(`/habits/${id}/complete`, { method: "POST" }) },
    plans: { today: () => request<{ id: string; blocks: TimeBlock[] }>("/plans/today"), generate: () => request<{ id: string; blocks: TimeBlock[] }>("/plans/generate", { method: "POST" }), rebalance: (id: string, reason: string) => request<{ id: string; blocks: TimeBlock[] }>(`/plans/${id}/rebalance`, { method: "POST", body: JSON.stringify({ reason }) }) },
    timeBlocks: { update: (id: string, input: { startAt: string; endAt: string }) => request<TimeBlock>(`/time-blocks/${id}`, { method: "PATCH", body: JSON.stringify(input) }), complete: (id: string) => request<TimeBlock>(`/time-blocks/${id}/complete`, { method: "POST" }), skip: (id: string) => request<TimeBlock>(`/time-blocks/${id}/skip`, { method: "POST" }) },
    focus: { start: (input: { timeBlockId?: string; taskId?: string; plannedMinutes: number }) => request<unknown>("/focus-sessions", { method: "POST", body: JSON.stringify(input) }), finish: (id: string, input: unknown) => request<unknown>(`/focus-sessions/${id}/finish`, { method: "POST", body: JSON.stringify(input) }) },
    hydration: { today: () => request<{ totalMl: number; targetMl: number }>("/hydration/today"), log: (amountMl: number) => request<{ totalMl: number; targetMl: number }>("/hydration", { method: "POST", body: JSON.stringify({ amountMl }) }) },
    insights: { weekly: () => request<unknown>("/insights/weekly") },
    reflections: { create: (input: unknown) => request<unknown>("/reflections", { method: "POST", body: JSON.stringify(input) }) }
  };
}

export type DayOSClient = ReturnType<typeof createDayOSClient>;
