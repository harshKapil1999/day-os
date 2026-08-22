"use client";

import { useAuth } from "@clerk/nextjs";
import { createDayOSClient } from "@dayos/api-client";
import type { Task, TimeBlock } from "@dayos/domain";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { demoBlocks, demoHabits, demoTasks } from "@/lib/demo-data";

type Habit = (typeof demoHabits)[number];
interface DayOSState { tasks: Task[]; blocks: TimeBlock[]; habits: Habit[]; water: { totalMl: number; targetMl: number }; loading: boolean; addTask(input: { title: string; estimatedMinutes: number; priority: Task["priority"] }): Promise<void>; completeTask(id: string): Promise<void>; completeBlock(id: string): Promise<void>; toggleHabit(id: string): Promise<void>; logWater(amount: number): Promise<void>; rebalance(): Promise<void>; refresh(): Promise<void>; }
const Context = createContext<DayOSState | null>(null);

function DataProvider({ children, token }: { children: ReactNode; token?: () => Promise<string | null> }) {
  const api = useMemo(() => createDayOSClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1", ...(token ? { getToken: token } : {}) }), [token]);
  const [tasks, setTasks] = useState(demoTasks); const [blocks, setBlocks] = useState(demoBlocks); const [habits, setHabits] = useState(demoHabits); const [water, setWater] = useState({ totalMl: 1250, targetMl: 3000 }); const [planId, setPlanId] = useState("plan-today"); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { try { const [nextTasks, plan, nextHabits, nextWater] = await Promise.all([api.tasks.list(), api.plans.today(), api.habits.list() as Promise<Habit[]>, api.hydration.today()]); setTasks(nextTasks); setBlocks(plan.blocks); setPlanId(plan.id); setHabits(nextHabits); setWater(nextWater); } catch { /* keep useful local seed when API is not running */ } finally { setLoading(false); } }, [api]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);
  const value: DayOSState = { tasks, blocks, habits, water, loading, refresh,
    async addTask(input) { const optimistic: Task = { id: `temp-${Date.now()}`, title: input.title, lifeArea: "WORK", status: "BACKLOG", priority: input.priority, estimatedMinutes: input.estimatedMinutes, actualMinutes: 0, energyRequired: "MEDIUM", schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 25 }; setTasks((items) => [optimistic, ...items]); try { const created = await api.tasks.create({ ...input, lifeArea: "WORK", energyRequired: "MEDIUM", schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 25 }); setTasks((items) => items.map((item) => item.id === optimistic.id ? created : item)); } catch { setTasks((items) => items.filter((item) => item.id !== optimistic.id)); throw new Error("Task could not be saved"); } },
    async completeTask(id) { const before = tasks; setTasks((items) => items.map((item) => item.id === id ? { ...item, status: "COMPLETED" } : item)); try { await api.tasks.complete(id); } catch { setTasks(before); } },
    async completeBlock(id) { const before = blocks; setBlocks((items) => items.map((item) => item.id === id ? { ...item, status: "COMPLETED" } : item)); try { await api.timeBlocks.complete(id); } catch { setBlocks(before); } },
    async toggleHabit(id) { const before = habits; setHabits((items) => items.map((item) => item.id === id ? { ...item, completedToday: !item.completedToday } : item)); try { await api.habits.complete(id); } catch { setHabits(before); } },
    async logWater(amount) { const before = water; setWater((value) => ({ ...value, totalMl: value.totalMl + amount })); try { setWater(await api.hydration.log(amount)); } catch { setWater(before); } },
    async rebalance() { try { const result = await api.plans.rebalance(planId, "TASK_OVERRAN") as { blocks: TimeBlock[] }; setBlocks(result.blocks); } catch { setBlocks((items) => items.map((item, index) => index > 2 && item.flexibility !== "FIXED" ? { ...item, startAt: new Date(new Date(item.startAt).getTime() + 15 * 60_000).toISOString(), endAt: new Date(new Date(item.endAt).getTime() + 15 * 60_000).toISOString(), status: "RESCHEDULED" } : item)); } }
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function ClerkData({ children }: { children: ReactNode }) { const { getToken } = useAuth(); return <DataProvider token={getToken}>{children}</DataProvider>; }
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
export function Providers({ children, clerk }: { children: ReactNode; clerk: boolean }) { return <ThemeProvider attribute="class" defaultTheme="system" enableSystem><QueryClientProvider client={queryClient}>{clerk ? <ClerkData>{children}</ClerkData> : <DataProvider>{children}</DataProvider>}</QueryClientProvider></ThemeProvider>; }
export function useDayOS() { const value = useContext(Context); if (!value) throw new Error("useDayOS must be used inside Providers"); return value; }
