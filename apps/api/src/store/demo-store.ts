import type { Task, TimeBlock, UserProfile } from "@dayos/domain";
import { generateDayPlan } from "@dayos/planner";
import { localTimeOnDate } from "@dayos/utils";
import type { UserData } from "./types.js";

const users = new Map<string, UserData>();
const dateInZone = (zone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function seedTask(id: string, title: string, minutes: number, priority: Task["priority"], lifeArea: Task["lifeArea"], energy: Task["energyRequired"], deadline?: string): Task {
  return { id, title, lifeArea, status: "BACKLOG", priority, estimatedMinutes: minutes, actualMinutes: 0, energyRequired: energy, schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 25, ...(deadline ? { deadline } : {}) };
}

export function makeUser(authUserId: string): UserData {
  const timezone = "Asia/Kolkata"; const date = dateInZone(timezone);
  const profile: UserProfile = { id: crypto.randomUUID(), authUserId, displayName: "Alex", timezone, wakeTime: "07:00", sleepTime: "23:00", workStartTime: "09:00", workEndTime: "18:00", defaultFocusDurationMinutes: 90, defaultBreakDurationMinutes: 15, dailyWaterTargetMl: 3000, onboardingCompleted: true };
  const tasks = [
    seedTask(crypto.randomUUID(), "Build authentication flow", 120, "CRITICAL", "WORK", "DEEP_FOCUS", new Date(Date.now() + 86_400_000).toISOString()),
    seedTask(crypto.randomUUID(), "Refine planner constraints", 90, "HIGH", "WORK", "DEEP_FOCUS"),
    seedTask(crypto.randomUUID(), "Systems design course", 60, "MEDIUM", "LEARNING", "HIGH"),
    seedTask(crypto.randomUUID(), "Clear personal admin", 45, "MEDIUM", "PERSONAL", "LOW"),
    seedTask(crypto.randomUUID(), "Read Designing Data-Intensive Applications", 40, "LOW", "LEARNING", "LOW"),
    seedTask(crypto.randomUUID(), "Weekly product review", 50, "HIGH", "WORK", "MEDIUM"),
    seedTask(crypto.randomUUID(), "Plan family weekend", 30, "MEDIUM", "PERSONAL", "LOW"),
    seedTask(crypto.randomUUID(), "Capture project notes", 25, "LOW", "WORK", "LOW")
  ];
  const time = (value: string) => localTimeOnDate(date, value, timezone).toISOString();
  const result = generateDayPlan({ date, timezone, wakeTime: profile.wakeTime, sleepTime: profile.sleepTime, tasks: tasks.slice(0, 5), fixedEvents: [{ id: crypto.randomUUID(), title: "Team stand-up", startAt: time("12:15"), endAt: time("12:45"), lifeArea: "WORK" }], protectedWindows: [
    { id: crypto.randomUUID(), title: "Breakfast", type: "MEAL", windowStart: "07:45", windowEnd: "08:45", durationMinutes: 30, lifeArea: "RECOVERY" },
    { id: crypto.randomUUID(), title: "Lunch", type: "MEAL", windowStart: "13:00", windowEnd: "14:30", durationMinutes: 45, lifeArea: "RECOVERY" },
    { id: crypto.randomUUID(), title: "Strength training", type: "EXERCISE", windowStart: "17:30", windowEnd: "19:30", durationMinutes: 60, lifeArea: "HEALTH", priority: "HIGH" },
    { id: crypto.randomUUID(), title: "Dinner", type: "MEAL", windowStart: "19:15", windowEnd: "20:30", durationMinutes: 45, lifeArea: "RECOVERY" }
  ] });
  const blocks = result.blocks.map((item, index) => index < 2 ? { ...item, status: "COMPLETED" as const } : item);
  return { profile, tasks, habits: [
    { id: crypto.randomUUID(), name: "Morning water", lifeArea: "HEALTH", estimatedDurationMinutes: 2, frequencyType: "DAILY", targetPerWeek: 7, streak: 12, completedToday: true, active: true },
    { id: crypto.randomUUID(), name: "Read", lifeArea: "LEARNING", estimatedDurationMinutes: 30, frequencyType: "DAILY", targetPerWeek: 7, streak: 5, completedToday: false, active: true },
    { id: crypto.randomUUID(), name: "Gym", lifeArea: "HEALTH", estimatedDurationMinutes: 60, frequencyType: "TIMES_PER_WEEK", targetPerWeek: 5, streak: 3, completedToday: false, active: true },
    { id: crypto.randomUUID(), name: "Wind down", lifeArea: "RECOVERY", estimatedDurationMinutes: 20, frequencyType: "DAILY", targetPerWeek: 7, streak: 8, completedToday: false, active: true }
  ], plans: [{ id: crypto.randomUUID(), date, status: "ACTIVE", blocks }], hydration: [{ id: crypto.randomUUID(), amountMl: 500, loggedAt: new Date().toISOString() }, { id: crypto.randomUUID(), amountMl: 750, loggedAt: new Date().toISOString() }], focus: [], reflections: [] };
}

export function getUserData(authUserId: string): UserData {
  let data = users.get(authUserId); if (!data) { data = makeUser(authUserId); users.set(authUserId, data); } return data;
}
export function setUserData(authUserId: string, data: UserData) { users.set(authUserId, data); }
export function resetDemoStore() { users.clear(); }
export function findBlock(data: UserData, id: string): TimeBlock | undefined { return data.plans.flatMap((plan) => plan.blocks).find((item) => item.id === id); }
