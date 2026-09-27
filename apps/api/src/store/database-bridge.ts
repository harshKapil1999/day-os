import { and, eq, inArray } from "drizzle-orm";
import { createDatabase, dailyPlans, dailyReflections, focusSessions, habitCompletions, habits, hydrationLogs, planEvents, tasks, timeBlocks, users } from "@dayos/database";
import type { Task, TimeBlock, UserProfile } from "@dayos/domain";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { logger } from "../middleware/request-context.js";
import { defaultPreferences, getUserData, makeEmptyUser, makeUser, setUserData } from "./demo-store.js";
import type { HabitRecord, UserData } from "./types.js";

const connection = env.DATABASE_URL ? createDatabase(env.DATABASE_URL) : null;
const requestQueue = new Map<string, Promise<void>>();
async function acquireUser(authUserId: string) {
  const previous = requestQueue.get(authUserId) ?? Promise.resolve();
  let unlock!: () => void;
  const current = new Promise<void>((resolve) => { unlock = resolve; });
  const tail = previous.then(() => current);
  requestQueue.set(authUserId, tail);
  await previous;
  let released = false;
  return () => { if (released) return; released = true; unlock(); if (requestQueue.get(authUserId) === tail) requestQueue.delete(authUserId); };
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validUuid = (value: string | undefined): value is string => Boolean(value && uuidPattern.test(value));

function normalizeIds(data: UserData) {
  for (const task of data.tasks) if (!validUuid(task.id)) task.id = crypto.randomUUID();
  for (const habit of data.habits) if (!validUuid(habit.id)) habit.id = crypto.randomUUID();
  for (const plan of data.plans) {
    if (!validUuid(plan.id)) plan.id = crypto.randomUUID();
    for (const block of plan.blocks) {
      if (!validUuid(block.id)) block.id = crypto.randomUUID();
      if (block.taskId && !validUuid(block.taskId)) delete block.taskId;
    }
  }
  for (const item of data.hydration) if (!validUuid(item.id)) item.id = crypto.randomUUID();
  for (const item of data.focus) if (!validUuid(item.id)) item.id = crypto.randomUUID();
  for (const item of data.reflections) if (!validUuid(item.id)) item.id = crypto.randomUUID();
}

async function persist(authUserId: string, data: UserData) {
  if (!connection) return;
  normalizeIds(data);
  await connection.db.transaction(async (tx) => {
    const preferences = data.profile.preferences as unknown as Record<string, unknown>;
    await tx.insert(users).values({ id: data.profile.id, authUserId, displayName: data.profile.displayName, timezone: data.profile.timezone, wakeTime: data.profile.wakeTime, sleepTime: data.profile.sleepTime, workStartTime: data.profile.workStartTime, workEndTime: data.profile.workEndTime, defaultFocusDurationMinutes: data.profile.defaultFocusDurationMinutes, defaultBreakDurationMinutes: data.profile.defaultBreakDurationMinutes, dailyWaterTargetMl: data.profile.dailyWaterTargetMl, onboardingCompleted: data.profile.onboardingCompleted, preferences }).onConflictDoUpdate({ target: users.authUserId, set: { displayName: data.profile.displayName, timezone: data.profile.timezone, wakeTime: data.profile.wakeTime, sleepTime: data.profile.sleepTime, workStartTime: data.profile.workStartTime, workEndTime: data.profile.workEndTime, defaultFocusDurationMinutes: data.profile.defaultFocusDurationMinutes, defaultBreakDurationMinutes: data.profile.defaultBreakDurationMinutes, dailyWaterTargetMl: data.profile.dailyWaterTargetMl, onboardingCompleted: data.profile.onboardingCompleted, preferences, updatedAt: new Date() } });
    const existing = await tx.select({ id: users.id }).from(users).where(eq(users.authUserId, authUserId)).limit(1);
    const userId = existing[0]!.id; data.profile.id = userId;
    const [habitHistory, eventHistory] = await Promise.all([tx.select().from(habitCompletions).where(eq(habitCompletions.userId, userId)), tx.select().from(planEvents).where(eq(planEvents.userId, userId))]);
    await tx.delete(dailyReflections).where(eq(dailyReflections.userId, userId));
    await tx.delete(planEvents).where(eq(planEvents.userId, userId));
    await tx.delete(focusSessions).where(eq(focusSessions.userId, userId));
    await tx.delete(hydrationLogs).where(eq(hydrationLogs.userId, userId));
    await tx.delete(timeBlocks).where(eq(timeBlocks.userId, userId));
    await tx.delete(dailyPlans).where(eq(dailyPlans.userId, userId));
    await tx.delete(habitCompletions).where(eq(habitCompletions.userId, userId));
    await tx.delete(habits).where(eq(habits.userId, userId));
    await tx.delete(tasks).where(eq(tasks.userId, userId));
    if (data.tasks.length) await tx.insert(tasks).values(data.tasks.map((item) => ({ id: item.id, userId, title: item.title, ...(item.description ? { description: item.description } : {}), lifeArea: item.lifeArea, status: item.status, priority: item.priority, estimatedMinutes: item.estimatedMinutes, actualMinutes: item.actualMinutes, ...(item.deadline ? { deadline: new Date(item.deadline) } : {}), energyRequired: item.energyRequired, ...(item.preferredTimeOfDay ? { preferredTimeOfDay: item.preferredTimeOfDay } : {}), schedulingType: item.schedulingType, canSplit: item.canSplit, minimumSessionMinutes: item.minimumSessionMinutes, ...(item.status === "COMPLETED" ? { completedAt: new Date() } : {}) })));
    if (data.habits.length) await tx.insert(habits).values(data.habits.map((item) => ({ id: item.id, userId, name: item.name, lifeArea: item.lifeArea as "WORK" | "LEARNING" | "HEALTH" | "PERSONAL" | "RECOVERY", estimatedDurationMinutes: item.estimatedDurationMinutes, frequencyType: item.frequencyType, targetPerWeek: item.targetPerWeek, active: item.active })));
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date());
    const activeHabitIds = new Set(data.habits.map((item) => item.id));
    const preservedHabitHistory = habitHistory.filter((item) => activeHabitIds.has(item.habitId) && item.date !== today);
    if (preservedHabitHistory.length) await tx.insert(habitCompletions).values(preservedHabitHistory.map((item) => ({ id: item.id, habitId: item.habitId, userId, date: item.date, value: item.value, completed: item.completed, completedAt: item.completedAt })));
    const completedHabits = data.habits.filter((item) => item.completedToday);
    if (completedHabits.length) await tx.insert(habitCompletions).values(completedHabits.map((item) => ({ id: crypto.randomUUID(), habitId: item.id, userId, date: today, completed: true })));
    for (const plan of data.plans) {
      const intentionalBlocks = plan.blocks.filter((item) => item.type !== "FREE" && item.type !== "SLEEP");
      await tx.insert(dailyPlans).values({ id: plan.id, userId, date: plan.date, status: plan.status as "DRAFT" | "ACTIVE" | "COMPLETED", plannedMinutes: intentionalBlocks.reduce((sum, item) => sum + Math.round((new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60_000), 0), completedMinutes: intentionalBlocks.filter((item) => item.status === "COMPLETED").reduce((sum, item) => sum + Math.round((new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60_000), 0) });
      if (plan.blocks.length) await tx.insert(timeBlocks).values(plan.blocks.map((item) => ({ id: item.id, dailyPlanId: plan.id, userId, type: item.type, title: item.title, ...(item.description ? { description: item.description } : {}), startAt: new Date(item.startAt), endAt: new Date(item.endAt), status: item.status, flexibility: item.flexibility, priority: item.priority, lifeArea: item.lifeArea, ...(validUuid(item.taskId) ? { taskId: item.taskId } : {}), locked: item.locked ?? false, metadata: item.metadata ?? {} })));
    }
    const planIds = new Set(data.plans.map((item) => item.id)); const blockIds = new Set(data.plans.flatMap((item) => item.blocks.map((block) => block.id)));
    const preservedEvents = eventHistory.filter((item) => planIds.has(item.dailyPlanId) && (!item.timeBlockId || blockIds.has(item.timeBlockId)));
    if (preservedEvents.length) await tx.insert(planEvents).values(preservedEvents.map((item) => ({ id: item.id, userId, dailyPlanId: item.dailyPlanId, type: item.type, ...(item.timeBlockId ? { timeBlockId: item.timeBlockId } : {}), metadata: item.metadata, createdAt: item.createdAt })));
    if (data.hydration.length) await tx.insert(hydrationLogs).values(data.hydration.map((item) => ({ id: item.id, userId, amountMl: item.amountMl, loggedAt: new Date(item.loggedAt) })));
    if (data.focus.length) await tx.insert(focusSessions).values(data.focus.map((item) => ({ id: item.id, userId, ...(validUuid(item.timeBlockId) ? { timeBlockId: item.timeBlockId } : {}), ...(validUuid(item.taskId) ? { taskId: item.taskId } : {}), startedAt: new Date(item.startedAt), ...(item.endedAt ? { endedAt: new Date(item.endedAt) } : {}), plannedMinutes: item.plannedMinutes, ...(item.actualMinutes !== undefined ? { actualMinutes: item.actualMinutes } : {}), ...(item.focusRating !== undefined ? { focusRating: item.focusRating } : {}), ...(item.energyRating !== undefined ? { energyRating: item.energyRating } : {}), ...(item.completionState ? { completionState: item.completionState as "COMPLETE" | "PARTIAL" | "NOT_COMPLETE" } : {}) })));
    const savedReflections = data.reflections.flatMap((item) => { const plan = data.plans.find((candidate) => candidate.date === item.date); return plan ? [{ id: item.id, userId, dailyPlanId: plan.id, dayRating: item.dayRating, energyRating: item.energyRating, focusRating: item.focusRating, ...(item.notes ? { notes: item.notes } : {}) }] : []; });
    if (savedReflections.length) await tx.insert(dailyReflections).values(savedReflections);
  });
}

export async function seedDatabaseUser(authUserId = "dev_seed_user") {
  if (!connection) throw new Error("DATABASE_URL is required to seed DayOS");
  const data = makeUser(authUserId);
  await persist(authUserId, data);
  return data;
}

async function hydrate(authUserId: string): Promise<UserData> {
  if (!connection) return getUserData(authUserId);
  const rows = await connection.db.select().from(users).where(eq(users.authUserId, authUserId)).limit(1);
  if (!rows[0]) { const fresh = makeEmptyUser(authUserId); await persist(authUserId, fresh); setUserData(authUserId, fresh); return fresh; }
  const row = rows[0]; const userId = row.id;
  const [taskRows, habitRows, planRows, blockRows, hydrationRows, focusRows, reflectionRows] = await Promise.all([
    connection.db.select().from(tasks).where(eq(tasks.userId, userId)), connection.db.select().from(habits).where(eq(habits.userId, userId)), connection.db.select().from(dailyPlans).where(eq(dailyPlans.userId, userId)), connection.db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId)), connection.db.select().from(hydrationLogs).where(eq(hydrationLogs.userId, userId)), connection.db.select().from(focusSessions).where(eq(focusSessions.userId, userId)), connection.db.select().from(dailyReflections).where(eq(dailyReflections.userId, userId))
  ]);
  const habitIds = habitRows.length ? habitRows.map((item) => item.id) : ["00000000-0000-4000-8000-000000000000"];
  const completionRows = await connection.db.select().from(habitCompletions).where(and(eq(habitCompletions.userId, userId), inArray(habitCompletions.habitId, habitIds)));
  function mapTask(item: typeof taskRows[number]): Task { return { id: item.id, title: item.title, ...(item.description ? { description: item.description } : {}), lifeArea: item.lifeArea, status: item.status, priority: item.priority, estimatedMinutes: item.estimatedMinutes, actualMinutes: item.actualMinutes, ...(item.deadline ? { deadline: item.deadline.toISOString() } : {}), energyRequired: item.energyRequired, ...(item.preferredTimeOfDay === "MORNING" || item.preferredTimeOfDay === "AFTERNOON" || item.preferredTimeOfDay === "EVENING" ? { preferredTimeOfDay: item.preferredTimeOfDay } : {}), schedulingType: item.schedulingType, canSplit: item.canSplit, minimumSessionMinutes: item.minimumSessionMinutes }; }
  function mapBlock(item: typeof blockRows[number]): TimeBlock { return { id: item.id, title: item.title, ...(item.description ? { description: item.description } : {}), type: item.type, startAt: item.startAt.toISOString(), endAt: item.endAt.toISOString(), status: item.status, flexibility: item.flexibility, priority: item.priority, lifeArea: item.lifeArea, ...(item.taskId ? { taskId: item.taskId } : {}), locked: item.locked, metadata: item.metadata }; }
  const legacyDemoProfile = row.onboardingCompleted && Object.keys(row.preferences ?? {}).length === 0 && taskRows.some((item) => item.title === "Build authentication flow");
  if (legacyDemoProfile) { const fresh = makeEmptyUser(authUserId, row.id); await persist(authUserId, fresh); setUserData(authUserId, fresh); return fresh; }
  const storedPreferences = row.preferences as unknown as Partial<UserProfile["preferences"]>;
  const defaults = defaultPreferences();
  const profile: UserProfile = { id: row.id, authUserId: row.authUserId, displayName: row.displayName, timezone: row.timezone, wakeTime: row.wakeTime, sleepTime: row.sleepTime, workStartTime: row.workStartTime, workEndTime: row.workEndTime, defaultFocusDurationMinutes: row.defaultFocusDurationMinutes, defaultBreakDurationMinutes: row.defaultBreakDurationMinutes, dailyWaterTargetMl: row.dailyWaterTargetMl, onboardingCompleted: row.onboardingCompleted, preferences: { ...defaults, ...storedPreferences, mealWindows: { ...defaults.mealWindows, ...storedPreferences.mealWindows }, freeTime: { ...defaults.freeTime, ...storedPreferences.freeTime }, routineWindows: storedPreferences.routineWindows?.length ? storedPreferences.routineWindows : defaults.routineWindows } };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone }).format(new Date());
  const habitData: HabitRecord[] = habitRows.map((item) => { const completedDates = new Set(completionRows.filter((entry) => entry.habitId === item.id && entry.completed).map((entry) => entry.date)); let cursor = completedDates.has(today) ? today : new Date(new Date(`${today}T12:00:00.000Z`).getTime() - 86_400_000).toISOString().slice(0, 10); let streak = 0; while (completedDates.has(cursor)) { streak += 1; cursor = new Date(new Date(`${cursor}T12:00:00.000Z`).getTime() - 86_400_000).toISOString().slice(0, 10); } return { id: item.id, name: item.name, lifeArea: item.lifeArea, estimatedDurationMinutes: item.estimatedDurationMinutes, frequencyType: item.frequencyType, targetPerWeek: item.targetPerWeek, streak, completedToday: completedDates.has(today), active: item.active }; });
  const data: UserData = { profile, tasks: taskRows.map(mapTask), habits: habitData, plans: planRows.map((plan) => ({ id: plan.id, date: plan.date, status: plan.status, blocks: blockRows.filter((item) => item.dailyPlanId === plan.id).map(mapBlock) })), hydration: hydrationRows.map((item) => ({ id: item.id, amountMl: item.amountMl, loggedAt: item.loggedAt.toISOString() })), focus: focusRows.map((item) => ({ id: item.id, ...(item.timeBlockId ? { timeBlockId: item.timeBlockId } : {}), ...(item.taskId ? { taskId: item.taskId } : {}), startedAt: item.startedAt.toISOString(), ...(item.endedAt ? { endedAt: item.endedAt.toISOString() } : {}), plannedMinutes: item.plannedMinutes, ...(item.actualMinutes !== null ? { actualMinutes: item.actualMinutes } : {}), ...(item.completionState ? { completionState: item.completionState } : {}), ...(item.focusRating !== null ? { focusRating: item.focusRating } : {}), ...(item.energyRating !== null ? { energyRating: item.energyRating } : {}) })), reflections: reflectionRows.map((item) => ({ id: item.id, date: planRows.find((plan) => plan.id === item.dailyPlanId)?.date ?? new Date().toISOString().slice(0, 10), dayRating: item.dayRating, energyRating: item.energyRating, focusRating: item.focusRating, ...(item.notes ? { notes: item.notes } : {}) })) };
  setUserData(authUserId, data); return data;
}

export async function databaseBridge(req: Request, res: Response, next: NextFunction) {
  if (!connection || !req.authUserId) return next();
  const release = await acquireUser(req.authUserId);
  res.once("finish", release); res.once("close", release);
  try {
    await hydrate(req.authUserId);
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 400) return originalJson(body);
      void persist(req.authUserId!, getUserData(req.authUserId!)).then(() => originalJson(body)).catch((error: unknown) => { logger.error({ error, requestId: req.requestId }, "database persistence failed"); if (!res.headersSent) res.status(500).send({ error: { code: "PERSISTENCE_ERROR", message: "Your change could not be saved." } }); });
      return res;
    }) as typeof res.json;
    next();
  } catch (error) { release(); next(error); }
}
