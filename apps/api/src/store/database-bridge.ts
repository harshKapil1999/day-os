import { and, eq, inArray } from "drizzle-orm";
import { createDatabase, dailyPlans, dailyReflections, focusSessions, habitCompletions, habits, hydrationLogs, planEvents, tasks, timeBlocks, users } from "@dayos/database";
import type { Task, TimeBlock, UserProfile } from "@dayos/domain";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { logger } from "../middleware/request-context.js";
import { getUserData, makeUser, setUserData } from "./demo-store.js";
import type { HabitRecord, UserData } from "./types.js";

const connection = env.DATABASE_URL ? createDatabase(env.DATABASE_URL) : null;
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
    await tx.insert(users).values({ id: data.profile.id, authUserId, displayName: data.profile.displayName, timezone: data.profile.timezone, wakeTime: data.profile.wakeTime, sleepTime: data.profile.sleepTime, workStartTime: data.profile.workStartTime, workEndTime: data.profile.workEndTime, defaultFocusDurationMinutes: data.profile.defaultFocusDurationMinutes, defaultBreakDurationMinutes: data.profile.defaultBreakDurationMinutes, dailyWaterTargetMl: data.profile.dailyWaterTargetMl, onboardingCompleted: data.profile.onboardingCompleted }).onConflictDoUpdate({ target: users.authUserId, set: { displayName: data.profile.displayName, timezone: data.profile.timezone, wakeTime: data.profile.wakeTime, sleepTime: data.profile.sleepTime, workStartTime: data.profile.workStartTime, workEndTime: data.profile.workEndTime, dailyWaterTargetMl: data.profile.dailyWaterTargetMl, onboardingCompleted: data.profile.onboardingCompleted, updatedAt: new Date() } });
    const existing = await tx.select({ id: users.id }).from(users).where(eq(users.authUserId, authUserId)).limit(1);
    const userId = existing[0]!.id; data.profile.id = userId;
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
    const completedHabits = data.habits.filter((item) => item.completedToday);
    if (completedHabits.length) await tx.insert(habitCompletions).values(completedHabits.map((item) => ({ id: crypto.randomUUID(), habitId: item.id, userId, date: new Date().toISOString().slice(0, 10), completed: true })));
    for (const plan of data.plans) {
      await tx.insert(dailyPlans).values({ id: plan.id, userId, date: plan.date, status: plan.status as "DRAFT" | "ACTIVE" | "COMPLETED", plannedMinutes: plan.blocks.reduce((sum, item) => sum + Math.round((new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60_000), 0), completedMinutes: plan.blocks.filter((item) => item.status === "COMPLETED").reduce((sum, item) => sum + Math.round((new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60_000), 0) });
      if (plan.blocks.length) await tx.insert(timeBlocks).values(plan.blocks.map((item) => ({ id: item.id, dailyPlanId: plan.id, userId, type: item.type, title: item.title, ...(item.description ? { description: item.description } : {}), startAt: new Date(item.startAt), endAt: new Date(item.endAt), status: item.status, flexibility: item.flexibility, priority: item.priority, lifeArea: item.lifeArea, ...(validUuid(item.taskId) ? { taskId: item.taskId } : {}), locked: item.locked ?? false, metadata: item.metadata ?? {} })));
    }
    if (data.hydration.length) await tx.insert(hydrationLogs).values(data.hydration.map((item) => ({ id: item.id, userId, amountMl: item.amountMl, loggedAt: new Date(item.loggedAt) })));
    if (data.focus.length) await tx.insert(focusSessions).values(data.focus.map((item) => ({ id: item.id, userId, ...(validUuid(item.timeBlockId) ? { timeBlockId: item.timeBlockId } : {}), ...(validUuid(item.taskId) ? { taskId: item.taskId } : {}), startedAt: new Date(item.startedAt), ...(item.endedAt ? { endedAt: new Date(item.endedAt) } : {}), plannedMinutes: item.plannedMinutes, ...(item.actualMinutes !== undefined ? { actualMinutes: item.actualMinutes } : {}), ...(item.focusRating !== undefined ? { focusRating: item.focusRating } : {}), ...(item.energyRating !== undefined ? { energyRating: item.energyRating } : {}), ...(item.completionState ? { completionState: item.completionState as "COMPLETE" | "PARTIAL" | "NOT_COMPLETE" } : {}) })));
    const reflectionPlan = data.plans[0];
    if (reflectionPlan && data.reflections.length) await tx.insert(dailyReflections).values(data.reflections.map((item) => ({ id: item.id, userId, dailyPlanId: reflectionPlan.id, dayRating: item.dayRating, energyRating: item.energyRating, focusRating: item.focusRating, ...(item.notes ? { notes: item.notes } : {}) })));
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
  if (!rows[0]) { const fresh = makeUser(authUserId); await persist(authUserId, fresh); setUserData(authUserId, fresh); return fresh; }
  const row = rows[0]; const userId = row.id;
  const [taskRows, habitRows, planRows, blockRows, hydrationRows, focusRows, reflectionRows] = await Promise.all([
    connection.db.select().from(tasks).where(eq(tasks.userId, userId)), connection.db.select().from(habits).where(eq(habits.userId, userId)), connection.db.select().from(dailyPlans).where(eq(dailyPlans.userId, userId)), connection.db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId)), connection.db.select().from(hydrationLogs).where(eq(hydrationLogs.userId, userId)), connection.db.select().from(focusSessions).where(eq(focusSessions.userId, userId)), connection.db.select().from(dailyReflections).where(eq(dailyReflections.userId, userId))
  ]);
  const habitIds = habitRows.length ? habitRows.map((item) => item.id) : ["00000000-0000-4000-8000-000000000000"];
  const completionRows = await connection.db.select().from(habitCompletions).where(and(eq(habitCompletions.userId, userId), inArray(habitCompletions.habitId, habitIds)));
  function mapTask(item: typeof taskRows[number]): Task { return { id: item.id, title: item.title, ...(item.description ? { description: item.description } : {}), lifeArea: item.lifeArea, status: item.status, priority: item.priority, estimatedMinutes: item.estimatedMinutes, actualMinutes: item.actualMinutes, ...(item.deadline ? { deadline: item.deadline.toISOString() } : {}), energyRequired: item.energyRequired, ...(item.preferredTimeOfDay === "MORNING" || item.preferredTimeOfDay === "AFTERNOON" || item.preferredTimeOfDay === "EVENING" ? { preferredTimeOfDay: item.preferredTimeOfDay } : {}), schedulingType: item.schedulingType, canSplit: item.canSplit, minimumSessionMinutes: item.minimumSessionMinutes }; }
  function mapBlock(item: typeof blockRows[number]): TimeBlock { return { id: item.id, title: item.title, ...(item.description ? { description: item.description } : {}), type: item.type, startAt: item.startAt.toISOString(), endAt: item.endAt.toISOString(), status: item.status, flexibility: item.flexibility, priority: item.priority, lifeArea: item.lifeArea, ...(item.taskId ? { taskId: item.taskId } : {}), locked: item.locked, metadata: item.metadata }; }
  const profile: UserProfile = { id: row.id, authUserId: row.authUserId, displayName: row.displayName, timezone: row.timezone, wakeTime: row.wakeTime, sleepTime: row.sleepTime, workStartTime: row.workStartTime, workEndTime: row.workEndTime, defaultFocusDurationMinutes: row.defaultFocusDurationMinutes, defaultBreakDurationMinutes: row.defaultBreakDurationMinutes, dailyWaterTargetMl: row.dailyWaterTargetMl, onboardingCompleted: row.onboardingCompleted };
  const habitData: HabitRecord[] = habitRows.map((item) => ({ id: item.id, name: item.name, lifeArea: item.lifeArea, estimatedDurationMinutes: item.estimatedDurationMinutes, frequencyType: item.frequencyType, targetPerWeek: item.targetPerWeek, streak: completionRows.filter((entry) => entry.habitId === item.id && entry.completed).length, completedToday: completionRows.some((entry) => entry.habitId === item.id && entry.date === new Date().toISOString().slice(0, 10) && entry.completed), active: item.active }));
  const data: UserData = { profile, tasks: taskRows.map(mapTask), habits: habitData, plans: planRows.map((plan) => ({ id: plan.id, date: plan.date, status: plan.status, blocks: blockRows.filter((item) => item.dailyPlanId === plan.id).map(mapBlock) })), hydration: hydrationRows.map((item) => ({ id: item.id, amountMl: item.amountMl, loggedAt: item.loggedAt.toISOString() })), focus: focusRows.map((item) => ({ id: item.id, ...(item.timeBlockId ? { timeBlockId: item.timeBlockId } : {}), ...(item.taskId ? { taskId: item.taskId } : {}), startedAt: item.startedAt.toISOString(), ...(item.endedAt ? { endedAt: item.endedAt.toISOString() } : {}), plannedMinutes: item.plannedMinutes, ...(item.actualMinutes !== null ? { actualMinutes: item.actualMinutes } : {}), ...(item.completionState ? { completionState: item.completionState } : {}), ...(item.focusRating !== null ? { focusRating: item.focusRating } : {}), ...(item.energyRating !== null ? { energyRating: item.energyRating } : {}) })), reflections: reflectionRows.map((item) => ({ id: item.id, date: planRows.find((plan) => plan.id === item.dailyPlanId)?.date ?? new Date().toISOString().slice(0, 10), dayRating: item.dayRating, energyRating: item.energyRating, focusRating: item.focusRating, ...(item.notes ? { notes: item.notes } : {}) })) };
  setUserData(authUserId, data); return data;
}

export async function databaseBridge(req: Request, res: Response, next: NextFunction) {
  if (!connection || !req.authUserId) return next();
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
  } catch (error) { next(error); }
}
