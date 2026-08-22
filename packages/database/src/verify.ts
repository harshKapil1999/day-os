import { config as loadEnv } from "dotenv";
import { and, eq } from "drizzle-orm";
import { resolve } from "node:path";
import { createDatabase } from "./index.js";
import { dailyPlans, dailyReflections, focusSessions, habitCompletions, habits, hydrationLogs, planEvents, tasks, timeBlocks, users } from "./schema.js";

loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true });
loadEnv({ quiet: true });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const { db, close } = createDatabase(process.env.DATABASE_URL);
const authUserId = `dayos_verify_${crypto.randomUUID()}`;
const today = new Date().toISOString().slice(0, 10);
let verificationUserId: string | undefined;

try {
  const [user] = await db.insert(users).values({ authUserId, displayName: "DayOS Verification", timezone: "Asia/Kolkata", onboardingCompleted: true }).returning({ id: users.id });
  if (!user) throw new Error("Verification user was not created");
  verificationUserId = user.id;

  const [task] = await db.insert(tasks).values({ userId: user.id, title: "Verify durable planning", estimatedMinutes: 45, priority: "HIGH", energyRequired: "DEEP_FOCUS", lifeArea: "WORK", schedulingType: "FLEXIBLE" }).returning({ id: tasks.id });
  const [habit] = await db.insert(habits).values({ userId: user.id, name: "Verify habit persistence", estimatedDurationMinutes: 10, lifeArea: "HEALTH", frequencyType: "DAILY", targetPerWeek: 7 }).returning({ id: habits.id });
  const [plan] = await db.insert(dailyPlans).values({ userId: user.id, date: today, status: "ACTIVE", plannedMinutes: 45 }).returning({ id: dailyPlans.id });
  if (!task || !habit || !plan) throw new Error("Core verification records were not created");

  const startAt = new Date(Date.now() + 60_000);
  const endAt = new Date(startAt.getTime() + 45 * 60_000);
  const [block] = await db.insert(timeBlocks).values({ dailyPlanId: plan.id, userId: user.id, taskId: task.id, type: "FOCUS", title: "Verify durable planning", startAt, endAt, flexibility: "FLEXIBLE", priority: "HIGH", lifeArea: "WORK" }).returning({ id: timeBlocks.id });
  if (!block) throw new Error("Time block was not created");

  await Promise.all([
    db.insert(habitCompletions).values({ habitId: habit.id, userId: user.id, date: today, completed: true }),
    db.insert(hydrationLogs).values({ userId: user.id, amountMl: 250 }),
    db.insert(focusSessions).values({ userId: user.id, timeBlockId: block.id, taskId: task.id, startedAt: startAt, endedAt: endAt, plannedMinutes: 45, actualMinutes: 45, focusRating: 5, completionState: "COMPLETE" }),
    db.insert(dailyReflections).values({ userId: user.id, dailyPlanId: plan.id, dayRating: 5, energyRating: 4, focusRating: 5, notes: "Automated persistence verification" }),
    db.insert(planEvents).values({ userId: user.id, dailyPlanId: plan.id, timeBlockId: block.id, type: "VERIFICATION", metadata: { source: "db:verify" } })
  ]);

  const [storedTask, storedPlan, storedBlock, storedHabit, storedHydration, storedFocus, storedReflection, storedEvent] = await Promise.all([
    db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.userId, user.id), eq(tasks.id, task.id))),
    db.select({ id: dailyPlans.id }).from(dailyPlans).where(and(eq(dailyPlans.userId, user.id), eq(dailyPlans.id, plan.id))),
    db.select({ id: timeBlocks.id }).from(timeBlocks).where(and(eq(timeBlocks.userId, user.id), eq(timeBlocks.id, block.id))),
    db.select({ id: habitCompletions.id }).from(habitCompletions).where(eq(habitCompletions.userId, user.id)),
    db.select({ id: hydrationLogs.id }).from(hydrationLogs).where(eq(hydrationLogs.userId, user.id)),
    db.select({ id: focusSessions.id }).from(focusSessions).where(eq(focusSessions.userId, user.id)),
    db.select({ id: dailyReflections.id }).from(dailyReflections).where(eq(dailyReflections.userId, user.id)),
    db.select({ id: planEvents.id }).from(planEvents).where(eq(planEvents.userId, user.id))
  ]);
  if ([storedTask, storedPlan, storedBlock, storedHabit, storedHydration, storedFocus, storedReflection, storedEvent].some((rows) => rows.length !== 1)) throw new Error("One or more persistence checks failed");

  const [completedTask] = await db.update(tasks).set({ status: "COMPLETED", actualMinutes: 45, completedAt: new Date() }).where(eq(tasks.id, task.id)).returning({ status: tasks.status });
  if (completedTask?.status !== "COMPLETED") throw new Error("Task update verification failed");

  await db.delete(users).where(eq(users.id, user.id));
  verificationUserId = undefined;
  const remainingTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.userId, user.id));
  if (remainingTasks.length !== 0) throw new Error("Cascade cleanup verification failed");

  process.stdout.write("Neon verification passed: schema, writes, reads, updates, relations, and cascade cleanup are healthy.\n");
} finally {
  if (verificationUserId) await db.delete(users).where(eq(users.id, verificationUserId));
  await close();
}
