"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { createDayOSClient, DayOSApiError } from "@dayos/api-client";
import type { CreateHabitInput, CreateTaskInput, OnboardingInput, UpdateProfileInput, UpdateTaskInput } from "@dayos/contracts";
import type { Task, TimeBlock, UserProfile } from "@dayos/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface HabitRecord { id: string; name: string; lifeArea: string; estimatedDurationMinutes: number; frequencyType: string; targetPerWeek: number; streak: number; completedToday: boolean; active: boolean; }
export interface WeeklyInsights { focusedMinutes: number; tasksCompleted: number; planAdherence: number; habitConsistency: number; learningMinutes: number; exerciseSessions: number; plannedMinutes: number; completedMinutes: number; areas: Array<{ name: string; minutes: number }>; daily: Array<{ date: string; label: string; planned: number; actual: number }>; recommendations: string[]; }
export interface DailyReflection { id: string; date: string; dayRating: number; energyRating: number; focusRating: number; notes?: string; }
type NewTaskInput = Pick<CreateTaskInput, "title" | "estimatedMinutes" | "priority"> & Partial<Omit<CreateTaskInput, "title" | "estimatedMinutes" | "priority">>;

interface DayOSState {
  profile: UserProfile | null; tasks: Task[]; blocks: TimeBlock[]; calendarBlocks: TimeBlock[]; habits: HabitRecord[]; water: { totalMl: number; targetMl: number }; insights: WeeklyInsights | null; reflection: DailyReflection | null;
  loading: boolean; error: string | null;
  addTask(input: NewTaskInput): Promise<void>; updateTask(id: string, input: UpdateTaskInput): Promise<void>; deleteTask(id: string): Promise<void>;
  addHabit(name: string, input?: Partial<CreateHabitInput>): Promise<void>; updateHabit(id: string, input: Partial<CreateHabitInput> & { active?: boolean }): Promise<void>; deleteHabit(id: string): Promise<void>; completeTask(id: string): Promise<void>; completeBlock(id: string): Promise<void>; toggleHabit(id: string): Promise<void>;
  logWater(amount: number): Promise<void>; rebalance(): Promise<void>; moveBlock(id: string, startAt: string, endAt: string): Promise<void>;
  buildPlan(): Promise<void>; loadWeek(startDate: string): Promise<void>;
  startFocus(block: TimeBlock): Promise<string>; finishFocus(id: string, completionState: "COMPLETE" | "PARTIAL" | "NOT_COMPLETE", focusRating: number): Promise<void>;
  completeOnboarding(input: OnboardingInput): Promise<void>; updateProfile(input: UpdateProfileInput): Promise<void>; refresh(): Promise<void>;
  saveReflection(input: Pick<DailyReflection, "dayRating" | "energyRating" | "focusRating" | "notes">): Promise<void>;
}
const Context = createContext<DayOSState | null>(null);
const emptyWater = { totalMl: 0, targetMl: 3000 };

function DataProvider({ children, token, enabled = true, identityName }: { children: ReactNode; token?: () => Promise<string | null>; enabled?: boolean; identityName?: string }) {
  const api = useMemo(() => createDayOSClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1", ...(token ? { getToken: token } : {}) }), [token]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]); const [blocks, setBlocks] = useState<TimeBlock[]>([]); const [calendarBlocks, setCalendarBlocks] = useState<TimeBlock[]>([]); const [habits, setHabits] = useState<HabitRecord[]>([]);
  const [water, setWater] = useState(emptyWater); const [planId, setPlanId] = useState(""); const [insights, setInsights] = useState<WeeklyInsights | null>(null);
  const [reflection, setReflection] = useState<DailyReflection | null>(null);
  const [loading, setLoading] = useState(enabled); const [error, setError] = useState<string | null>(null);
  const currentDate = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const nextProfile = await api.me.get(); setProfile(nextProfile);
      if (!nextProfile.onboardingCompleted) { setTasks([]); setBlocks([]); setHabits([]); setWater({ totalMl: 0, targetMl: nextProfile.dailyWaterTargetMl }); setInsights(null); setReflection(null); return; }
      let plan: { id: string; blocks: TimeBlock[] };
      try { plan = await api.plans.today(); } catch (reason) { if (reason instanceof DayOSApiError && reason.status === 404) plan = await api.plans.generate(); else throw reason; }
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: nextProfile.timezone }).format(new Date()); currentDate.current = today;
      const [nextTasks, nextHabits, nextWater, nextInsights, savedWeek, nextReflection] = await Promise.all([api.tasks.list(), api.habits.list() as Promise<HabitRecord[]>, api.hydration.today(), api.insights.weekly() as Promise<WeeklyInsights>, api.plans.week(today), api.reflections.get(today).catch((reason: unknown) => { if (reason instanceof DayOSApiError && reason.status === 404) return null; throw reason; })]);
      const week = savedWeek.plans.length === 7 ? savedWeek : await api.plans.generateWeek(today);
      setTasks(nextTasks); setBlocks(plan.blocks); setCalendarBlocks(week.blocks); setPlanId(plan.id); setHabits(nextHabits); setWater(nextWater); setInsights(nextInsights); setReflection(nextReflection);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "DayOS could not load your account.");
      setProfile(null); setTasks([]); setBlocks([]); setHabits([]); setInsights(null); setReflection(null);
    } finally { setLoading(false); }
  }, [api, enabled]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!enabled || !profile?.onboardingCompleted) return;
    const checkDay = () => { const today = new Intl.DateTimeFormat("en-CA", { timeZone: profile.timezone }).format(new Date()); if (currentDate.current && currentDate.current !== today) { currentDate.current = today; void refresh(); } };
    const onFocus = () => { checkDay(); if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(checkDay, 60_000);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onFocus); };
  }, [enabled, profile?.onboardingCompleted, profile?.timezone, refresh]);
  const loadWeek = useCallback(async (startDate: string) => { let week = await api.plans.week(startDate); const today = new Intl.DateTimeFormat("en-CA", { timeZone: profile?.timezone ?? "UTC" }).format(new Date()); if (week.plans.length < 7 && startDate >= today) week = await api.plans.generateWeek(startDate); setCalendarBlocks(week.blocks); }, [api, profile?.timezone]);

  const value: DayOSState = { profile, tasks, blocks, calendarBlocks, habits, water, insights, reflection, loading, error, refresh,
    async completeOnboarding(input) { const next = await api.me.onboard({ ...input, ...(input.displayName || !identityName ? {} : { displayName: identityName }) }); setProfile(next); await refresh(); },
    async updateProfile(input) { const next = await api.me.update(input); setProfile(next); setWater((value) => ({ ...value, targetMl: next.dailyWaterTargetMl })); await refresh(); },
    async saveReflection(input) { setReflection(await api.reflections.create(input)); await refresh(); },
    async addTask(input) { await api.tasks.create({ lifeArea: "WORK", energyRequired: "MEDIUM", schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 25, ...input }); await refresh(); },
    async updateTask(id, input) { await api.tasks.update(id, input); await refresh(); },
    async deleteTask(id) { await api.tasks.delete(id); await refresh(); },
    async addHabit(name, input) { await api.habits.create({ lifeArea: "HEALTH", estimatedDurationMinutes: 15, frequencyType: "DAILY", targetPerWeek: 7, ...input, name }); await refresh(); },
    async updateHabit(id, input) { await api.habits.update(id, input); await refresh(); },
    async deleteHabit(id) { await api.habits.delete(id); await refresh(); },
    async completeTask(id) { const existing = tasks.find((item) => item.id === id); if (existing?.status === "COMPLETED") await api.tasks.backlog(id); else await api.tasks.complete(id); await refresh(); },
    async completeBlock(id) { await api.timeBlocks.complete(id); await refresh(); },
    async toggleHabit(id) { await api.habits.complete(id); await refresh(); },
    async logWater(amount) { const before = water; setWater((value) => ({ ...value, totalMl: value.totalMl + amount })); try { setWater(await api.hydration.log(amount)); } catch { setWater(before); } },
    async buildPlan() { await api.plans.generate(); await refresh(); },
    loadWeek,
    async startFocus(block) { const session = await api.focus.start({ timeBlockId: block.id, ...(block.taskId ? { taskId: block.taskId } : {}), plannedMinutes: Math.max(1, Math.round((new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) / 60_000)) }); setBlocks((items) => items.map((item) => item.id === block.id ? { ...item, status: "ACTIVE" } : item)); return session.id; },
    async finishFocus(id, completionState, focusRating) { await api.focus.finish(id, { completionState, focusRating }); await refresh(); },
    async rebalance() { if (!planId) return; await api.plans.rebalance(planId, "TASK_OVERRAN"); await refresh(); },
    async moveBlock(id, startAt, endAt) { const before = blocks; const beforeCalendar = calendarBlocks; setBlocks((items) => items.map((item) => item.id === id ? { ...item, startAt, endAt } : item)); setCalendarBlocks((items) => items.map((item) => item.id === id ? { ...item, startAt, endAt } : item)); try { await api.timeBlocks.update(id, { startAt, endAt }); } catch (reason) { setBlocks(before); setCalendarBlocks(beforeCalendar); throw reason; } }
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function ClerkData({ children }: { children: ReactNode }) { const { getToken, isLoaded, isSignedIn } = useAuth(); const { user } = useUser(); const token = useCallback(() => getToken(), [getToken]); const identityName = user?.fullName ?? user?.firstName; return <DataProvider token={token} enabled={Boolean(isLoaded && isSignedIn)} {...(identityName ? { identityName } : {})}>{children}</DataProvider>; }
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
export function Providers({ children, clerk }: { children: ReactNode; clerk: boolean }) { return <ThemeProvider attribute="class" defaultTheme="system" enableSystem><QueryClientProvider client={queryClient}>{clerk ? <ClerkData>{children}</ClerkData> : <DataProvider>{children}</DataProvider>}</QueryClientProvider></ThemeProvider>; }
export function useDayOS() { const value = useContext(Context); if (!value) throw new Error("useDayOS must be used inside Providers"); return value; }
