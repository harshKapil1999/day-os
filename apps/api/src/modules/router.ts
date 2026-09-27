import { Router } from "express";
import { createHabitSchema, createTaskSchema, finishFocusSchema, hydrationSchema, onboardingSchema, patchTimeBlockSchema, rebalanceSchema, reflectionSchema, startFocusSchema, updateHabitSchema, updateProfileSchema, updateTaskSchema } from "@dayos/contracts";
import type { RoutineWindowPreference, Task, UserPreferences, UserProfile } from "@dayos/domain";
import { generateDayPlan, rebalanceRemainingDay, type TaskWindowPreference, type WindowPreference } from "@dayos/planner";
import { notFound } from "../lib/errors.js";
import { findBlock, getUserData } from "../store/demo-store.js";

export const apiRouter = Router();
const user = (authUserId?: string) => getUserData(authUserId!);
const ok = <T>(res: import("express").Response, data: T, status = 200) => res.status(status).json({ data });

const starterTask = (title: string, lifeArea: Task["lifeArea"], estimatedMinutes: number, priority: Task["priority"], energyRequired: Task["energyRequired"]): Task => ({ id: crypto.randomUUID(), title, lifeArea, estimatedMinutes, priority, energyRequired, status: "BACKLOG", actualMinutes: 0, schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 25 });

function personalizeNewUser(data: ReturnType<typeof user>, priorities: string[]) {
  if (!data.tasks.length) {
    const templates: Record<string, Task> = {
      Work: starterTask("Define today’s most important work outcome", "WORK", 60, "HIGH", "DEEP_FOCUS"),
      Learning: starterTask("Make progress on a learning goal", "LEARNING", 45, "MEDIUM", "HIGH"),
      Reading: starterTask("Read and capture one useful idea", "LEARNING", 30, "MEDIUM", "LOW"),
      "Personal projects": starterTask("Move a personal project forward", "PERSONAL", 45, "MEDIUM", "MEDIUM"),
      Family: starterTask("Protect meaningful family time", "PERSONAL", 45, "HIGH", "LOW")
    };
    data.tasks = priorities.flatMap((name) => templates[name] ? [{ ...templates[name]!, id: crypto.randomUUID() }] : []);
    if (!data.tasks.length) data.tasks = [starterTask("Choose one meaningful outcome for today", "PERSONAL", 30, "MEDIUM", "MEDIUM")];
  }
  if (!data.habits.length) {
    data.habits = [{ id: crypto.randomUUID(), name: "Reach my water target", lifeArea: "HEALTH", estimatedDurationMinutes: 2, frequencyType: "DAILY", targetPerWeek: 7, streak: 0, completedToday: false, active: true }];
    if (priorities.includes("Exercise")) data.habits.push({ id: crypto.randomUUID(), name: "Move my body", lifeArea: "HEALTH", estimatedDurationMinutes: 45, frequencyType: "TIMES_PER_WEEK", targetPerWeek: 4, streak: 0, completedToday: false, active: true });
    if (priorities.includes("Reading")) data.habits.push({ id: crypto.randomUUID(), name: "Read", lifeArea: "LEARNING", estimatedDurationMinutes: 25, frequencyType: "DAILY", targetPerWeek: 7, streak: 0, completedToday: false, active: true });
    if (priorities.includes("Recovery")) data.habits.push({ id: crypto.randomUUID(), name: "Evening wind-down", lifeArea: "RECOVERY", estimatedDurationMinutes: 20, frequencyType: "DAILY", targetPerWeek: 7, streak: 0, completedToday: false, active: true });
  }
}

const dayOfWeek = (date: string) => new Date(`${date}T12:00:00.000Z`).getUTCDay();
const addDays = (date: string, amount: number) => { const value = new Date(`${date}T12:00:00.000Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10); };
const minutesBetweenTimes = (start: string, end: string) => { const [sh, sm] = start.split(":").map(Number); const [eh, em] = end.split(":").map(Number); let value = eh! * 60 + em! - sh! * 60 - sm!; if (value <= 0) value += 1440; return value; };

function activeRoutines(profile: UserProfile, date: string): RoutineWindowPreference[] {
  return profile.preferences.routineWindows.filter((item) => item.active && item.days.includes(dayOfWeek(date))).map((item) => { const start = item.kind === "WORK" ? profile.workStartTime : item.start; const end = item.kind === "WORK" ? profile.workEndTime : item.end; return { ...item, start, end, durationMinutes: minutesBetweenTimes(start, end) }; });
}

function personalizedWindows(profile: UserProfile, date: string): WindowPreference[] {
  const preferences = profile.preferences;
  const meal = preferences.mealWindows;
  const windows: WindowPreference[] = [
    { id: "breakfast", title: "Breakfast", type: "MEAL", windowStart: meal.breakfast.start, windowEnd: meal.breakfast.end, durationMinutes: 30, lifeArea: "RECOVERY", flexibility: "SEMI_FLEXIBLE", description: "Eat, hydrate, and begin without rushing." },
    { id: "lunch", title: "Lunch", type: "MEAL", windowStart: meal.lunch.start, windowEnd: meal.lunch.end, durationMinutes: 45, lifeArea: "RECOVERY", flexibility: "SEMI_FLEXIBLE", description: "A protected refuel window away from focused work." },
    { id: "dinner", title: "Dinner", type: "MEAL", windowStart: meal.dinner.start, windowEnd: meal.dinner.end, durationMinutes: 45, lifeArea: "RECOVERY", flexibility: "SEMI_FLEXIBLE", description: "Close the day with food and connection." }
  ];
  for (const routine of activeRoutines(profile, date)) {
    if (["WORK", "LEARNING", "HOBBY"].includes(routine.kind)) continue;
    const map = {
      EXERCISE: { type: "EXERCISE" as const, area: "HEALTH" as const, description: "A protected movement window that supports energy and consistency." },
      FAMILY: { type: "FAMILY" as const, area: "PERSONAL" as const, description: "Be present with the people who matter." },
      MEDITATION: { type: "MEDITATION" as const, area: "RECOVERY" as const, description: "Quiet attention before the day accelerates." },
      WIND_DOWN: { type: "BREAK" as const, area: "RECOVERY" as const, description: "Lower stimulation and prepare for protected sleep." }
    }[routine.kind as "EXERCISE" | "FAMILY" | "MEDITATION" | "WIND_DOWN"];
    if (map) windows.push({ id: routine.id, title: routine.title, type: map.type, windowStart: routine.start, windowEnd: routine.end, durationMinutes: routine.durationMinutes, lifeArea: map.area, priority: routine.kind === "WIND_DOWN" ? "CRITICAL" : "HIGH", flexibility: routine.flexibility === "FIXED" ? "FIXED" : "SEMI_FLEXIBLE", description: map.description });
  }
  return windows;
}

function taskWindows(profile: UserProfile, date: string): TaskWindowPreference[] {
  return activeRoutines(profile, date).flatMap((routine) => {
    const lifeAreas = routine.kind === "WORK" ? ["WORK" as const] : routine.kind === "LEARNING" ? ["LEARNING" as const] : routine.kind === "HOBBY" ? ["PERSONAL" as const] : [];
    return lifeAreas.length ? [{ id: routine.id, title: routine.title, windowStart: routine.start, windowEnd: routine.end, lifeAreas }] : [];
  });
}

function buildPlanForDate(data: ReturnType<typeof user>, date: string, tasksForDate: Task[] = data.tasks) {
  const preferences = data.profile.preferences; const styleBuffer = preferences.planningStyle === "STRUCTURED" ? 30 : preferences.planningStyle === "SPACIOUS" ? 90 : 60;
  const previous = data.plans.find((item) => item.date === date);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date());
  const now = Date.now();
  const preserved = previous?.blocks.filter((item) => item.type !== "FREE" && item.type !== "SLEEP" && (item.status === "COMPLETED" || item.status === "ACTIVE" || item.metadata?.manuallyMoved === true || (date === today && new Date(item.endAt).getTime() <= now))) ?? [];
  const reserved = new Map<string, number>();
  for (const item of preserved) if (item.taskId && item.status !== "SKIPPED") reserved.set(item.taskId, (reserved.get(item.taskId) ?? 0) + Math.round((new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60_000));
  const pendingTasks = tasksForDate.map((task) => ({ ...task, estimatedMinutes: Math.max(0, task.estimatedMinutes - (reserved.get(task.id) ?? 0)) })).filter((task) => task.estimatedMinutes > 0);
  const result = generateDayPlan({ date, timezone: data.profile.timezone, wakeTime: data.profile.wakeTime, sleepTime: data.profile.sleepTime, tasks: pendingTasks, fixedEvents: preserved.map((item) => ({ id: item.id, title: item.title, type: item.type, startAt: item.startAt, endAt: item.endAt, lifeArea: item.lifeArea })), protectedWindows: personalizedWindows(data.profile, date), taskWindows: taskWindows(data.profile, date), strictTaskWindows: true, freeTimeSuggestions: preferences.freeTime.preferredUses, minimumAbundantWindowMinutes: preferences.freeTime.minimumOpenWindowMinutes, config: { bufferMinutes: Math.max(styleBuffer, preferences.freeTime.dailyUnscheduledMinutes), breakAfterMinutes: data.profile.defaultFocusDurationMinutes, breakDurationMinutes: data.profile.defaultBreakDurationMinutes } });
  const preservedById = new Map(preserved.map((item) => [item.id, item]));
  const plan = { id: previous?.id ?? crypto.randomUUID(), date, status: previous?.status ?? "ACTIVE", blocks: result.blocks.map((item) => { const original = preservedById.get(item.id); return original && original.startAt === item.startAt && original.endAt === item.endAt ? original : original ? { ...item, id: crypto.randomUUID() } : item; }) };
  data.plans = data.plans.filter((item) => item.date !== date); data.plans.push(plan);
  return plan;
}

function buildTodayPlan(data: ReturnType<typeof user>) { return buildPlanForDate(data, new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date())); }

function buildWeekPlans(data: ReturnType<typeof user>, startDate: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date());
  const remaining = new Map(data.tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "SKIPPED").map((task) => [task.id, task.estimatedMinutes]));
  const plans = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startDate, index); const dailyTasks = data.tasks.flatMap((task) => { const minutes = remaining.get(task.id) ?? 0; return minutes > 0 ? [{ ...task, estimatedMinutes: minutes }] : []; });
    const plan = date < today ? data.plans.find((item) => item.date === date) : buildPlanForDate(data, date, dailyTasks);
    if (!plan) return null;
    for (const block of plan.blocks) if (block.taskId) remaining.set(block.taskId, Math.max(0, (remaining.get(block.taskId) ?? 0) - Math.round((new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) / 60_000)));
    return plan;
  }).filter((plan) => plan !== null);
  return { plans, blocks: plans.flatMap((plan) => plan.blocks) };
}

function rebuildFutureWeek(data: ReturnType<typeof user>) {
  if (!data.profile.onboardingCompleted) return;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date());
  buildWeekPlans(data, today);
}

function syncTaskCompletion(data: ReturnType<typeof user>, taskId?: string) {
  if (!taskId) return;
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task || task.status === "COMPLETED") return;
  const taskBlocks = data.plans.flatMap((plan) => plan.blocks).filter((block) => block.taskId === taskId);
  if (taskBlocks.length && taskBlocks.every((block) => block.status === "COMPLETED")) { task.status = "COMPLETED"; rebuildFutureWeek(data); }
}

function rebuildOpenTime(data: ReturnType<typeof user>, plan: ReturnType<typeof user>["plans"][number]) {
  const scheduled = plan.blocks.filter((block) => block.type !== "FREE" && block.type !== "SLEEP");
  const generated = generateDayPlan({ date: plan.date, timezone: data.profile.timezone, wakeTime: data.profile.wakeTime, sleepTime: data.profile.sleepTime, tasks: [], fixedEvents: scheduled.map((block) => ({ id: block.id, title: block.title, type: block.type, startAt: block.startAt, endAt: block.endAt, lifeArea: block.lifeArea })), taskWindows: taskWindows(data.profile, plan.date), freeTimeSuggestions: data.profile.preferences.freeTime.preferredUses, minimumAbundantWindowMinutes: data.profile.preferences.freeTime.minimumOpenWindowMinutes });
  plan.blocks = [...scheduled, ...plan.blocks.filter((block) => block.type === "SLEEP"), ...generated.blocks.filter((block) => block.type === "FREE")].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

apiRouter.get("/me", (req, res) => ok(res, user(req.authUserId).profile));
apiRouter.patch("/me", (req, res) => { const data = user(req.authUserId); const parsed = updateProfileSchema.parse(req.body); const { routineWindows, mealWindows, freeTime, planningStyle, ...profileInput } = parsed; const input = Object.fromEntries(Object.entries(profileInput).filter(([, value]) => value !== undefined)); data.profile = { ...data.profile, ...input, id: data.profile.id, authUserId: data.profile.authUserId, preferences: { ...data.profile.preferences, ...(routineWindows ? { routineWindows } : {}), ...(mealWindows ? { mealWindows } : {}), ...(freeTime ? { freeTime } : {}), ...(planningStyle ? { planningStyle } : {}) } }; rebuildFutureWeek(data); return ok(res, data.profile); });
apiRouter.post("/onboarding", (req, res) => { const input = onboardingSchema.parse(req.body); const data = user(req.authUserId); const preferences: UserPreferences = { priorities: input.priorities, improvementGoals: input.improvementGoals, exercisePreference: input.exercisePreference, variableWorkHours: input.variableWorkHours, mealWindows: input.mealWindows, routineWindows: input.routineWindows, freeTime: input.freeTime, planningStyle: input.planningStyle }; data.profile = { ...data.profile, ...(input.displayName ? { displayName: input.displayName } : {}), timezone: input.timezone, wakeTime: input.wakeTime, sleepTime: input.sleepTime, workStartTime: input.workStartTime, workEndTime: input.workEndTime, dailyWaterTargetMl: input.dailyWaterTargetMl, preferences, onboardingCompleted: true }; personalizeNewUser(data, input.priorities); const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date()); buildWeekPlans(data, today); return ok(res, data.profile); });

apiRouter.get("/tasks", (req, res) => ok(res, user(req.authUserId).tasks));
apiRouter.post("/tasks", (req, res) => { const input = createTaskSchema.parse(req.body); const item: Task = { id: crypto.randomUUID(), title: input.title, lifeArea: input.lifeArea, status: "BACKLOG", priority: input.priority, estimatedMinutes: input.estimatedMinutes, actualMinutes: 0, energyRequired: input.energyRequired, schedulingType: input.schedulingType, canSplit: input.canSplit, minimumSessionMinutes: input.minimumSessionMinutes, ...(input.description ? { description: input.description } : {}), ...(input.deadline ? { deadline: input.deadline } : {}) }; const data = user(req.authUserId); data.tasks.unshift(item); rebuildFutureWeek(data); return ok(res, item, 201); });
apiRouter.get("/tasks/:id", (req, res, next) => { const item = user(req.authUserId).tasks.find((task) => task.id === req.params.id); return item ? ok(res, item) : next(notFound("Task was not found.")); });
apiRouter.patch("/tasks/:id", (req, res, next) => { const data = user(req.authUserId); const index = data.tasks.findIndex((task) => task.id === req.params.id); if (index < 0) return next(notFound("Task was not found.")); const patch = Object.fromEntries(Object.entries(updateTaskSchema.parse(req.body)).filter(([, value]) => value !== undefined)); Object.assign(data.tasks[index]!, patch); rebuildFutureWeek(data); return ok(res, data.tasks[index]); });
apiRouter.delete("/tasks/:id", (req, res, next) => { const data = user(req.authUserId); const index = data.tasks.findIndex((task) => task.id === req.params.id); if (index < 0) return next(notFound("Task was not found.")); data.tasks.splice(index, 1); for (const plan of data.plans) for (const block of plan.blocks) if (block.taskId === req.params.id) delete block.taskId; rebuildFutureWeek(data); return ok(res, { id: req.params.id }); });
for (const [path, status] of [["complete", "COMPLETED"], ["backlog", "BACKLOG"]] as const) apiRouter.post(`/tasks/:id/${path}`, (req, res, next) => { const data = user(req.authUserId); const item = data.tasks.find((task) => task.id === req.params.id); if (!item) return next(notFound("Task was not found.")); item.status = status; rebuildFutureWeek(data); return ok(res, item); });

apiRouter.get("/habits", (req, res) => ok(res, user(req.authUserId).habits));
apiRouter.post("/habits", (req, res) => { const input = createHabitSchema.parse(req.body); const item = { id: crypto.randomUUID(), ...input, streak: 0, completedToday: false, active: true }; user(req.authUserId).habits.unshift(item); return ok(res, item, 201); });
apiRouter.patch("/habits/:id", (req, res, next) => { const item = user(req.authUserId).habits.find((habit) => habit.id === req.params.id); if (!item) return next(notFound("Habit was not found.")); Object.assign(item, updateHabitSchema.parse(req.body)); return ok(res, item); });
apiRouter.delete("/habits/:id", (req, res, next) => { const data = user(req.authUserId); const index = data.habits.findIndex((habit) => habit.id === req.params.id); if (index < 0) return next(notFound("Habit was not found.")); data.habits.splice(index, 1); return ok(res, { id: req.params.id }); });
apiRouter.post("/habits/:id/complete", (req, res, next) => { const item = user(req.authUserId).habits.find((habit) => habit.id === req.params.id); if (!item) return next(notFound("Habit was not found.")); item.completedToday = !item.completedToday; item.streak = Math.max(0, item.streak + (item.completedToday ? 1 : -1)); return ok(res, item); });

apiRouter.get("/plans/today", (req, res, next) => { const data = user(req.authUserId); const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date()); const plan = data.plans.find((item) => item.date === today); return plan ? ok(res, plan) : next(notFound("Your day has not been planned yet.")); });
apiRouter.get("/plans/week", (req, res) => { const data = user(req.authUserId); const fallback = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date()); const startDate = typeof req.query.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.start) ? req.query.start : fallback; const dates = new Set(Array.from({ length: 7 }, (_, index) => addDays(startDate, index))); const plans = data.plans.filter((plan) => dates.has(plan.date)).sort((a, b) => a.date.localeCompare(b.date)); return ok(res, { plans, blocks: plans.flatMap((plan) => plan.blocks) }); });
apiRouter.post("/plans/week", (req, res) => { const data = user(req.authUserId); const fallback = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date()); const startDate = typeof req.body?.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.startDate) ? req.body.startDate : fallback; return ok(res, buildWeekPlans(data, startDate), 201); });
apiRouter.get("/plans/:date", (req, res, next) => { const plan = user(req.authUserId).plans.find((item) => item.date === req.params.date); return plan ? ok(res, plan) : next(notFound("Plan was not found.")); });
apiRouter.post("/plans/generate", (req, res) => ok(res, buildTodayPlan(user(req.authUserId)), 201));
apiRouter.post("/plans/:id/rebalance", (req, res, next) => { const data = user(req.authUserId); const plan = data.plans.find((item) => item.id === req.params.id); if (!plan) return next(notFound("Plan was not found.")); const input = rebalanceSchema.parse(req.body); const result = rebalanceRemainingDay({ now: input.now ?? new Date().toISOString(), currentPlan: plan.blocks.filter((block) => block.type !== "FREE"), reason: input.reason }); plan.blocks = result.blocks; rebuildOpenTime(data, plan); return ok(res, { ...plan, movedBlockIds: result.movedBlockIds, warnings: result.warnings }); });

apiRouter.patch("/time-blocks/:id", (req, res, next) => { const data = user(req.authUserId); const plan = data.plans.find((candidate) => candidate.blocks.some((block) => block.id === req.params.id)); const item = plan?.blocks.find((block) => block.id === req.params.id); if (!plan || !item) return next(notFound("Activity was not found.")); if (item.locked || item.flexibility === "FIXED" || item.type === "FREE" || item.type === "SLEEP") return res.status(409).json({ error: { code: "BLOCK_PROTECTED", message: "This activity is protected and cannot be moved." } }); const input = patchTimeBlockSchema.parse(req.body); const day = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }); if (day.format(new Date(input.startAt)) !== plan.date) return res.status(409).json({ error: { code: "OUTSIDE_DAY", message: "Move the activity within its planned day." } }); const overlaps = data.plans.flatMap((candidate) => candidate.blocks).some((other) => other.id !== item.id && other.type !== "FREE" && new Date(input.startAt) < new Date(other.endAt) && new Date(input.endAt) > new Date(other.startAt)); if (overlaps) return res.status(409).json({ error: { code: "TIME_BLOCK_OVERLAP", message: "That time overlaps another activity." } }); Object.assign(item, input, { metadata: { ...item.metadata, manuallyMoved: true } }); rebuildOpenTime(data, plan); return ok(res, item); });
for (const [path, status] of [["complete", "COMPLETED"], ["skip", "SKIPPED"]] as const) apiRouter.post(`/time-blocks/:id/${path}`, (req, res, next) => { const data = user(req.authUserId); const item = findBlock(data, req.params.id); if (!item) return next(notFound("Activity was not found.")); item.status = status; if (status === "COMPLETED") syncTaskCompletion(data, item.taskId); return ok(res, item); });

apiRouter.post("/focus-sessions", (req, res, next) => { const data = user(req.authUserId); const input = startFocusSchema.parse(req.body); const block = input.timeBlockId ? findBlock(data, input.timeBlockId) : undefined; if (input.timeBlockId && !block) return next(notFound("Activity was not found.")); if (input.taskId && !data.tasks.some((task) => task.id === input.taskId)) return next(notFound("Task was not found.")); if (block?.status === "COMPLETED") return res.status(409).json({ error: { code: "ACTIVITY_COMPLETE", message: "This activity is already complete." } }); const ongoing = data.focus.find((session) => !session.endedAt && session.timeBlockId === input.timeBlockId); if (ongoing) return ok(res, ongoing); const item = { id: crypto.randomUUID(), ...(input.timeBlockId ? { timeBlockId: input.timeBlockId } : {}), ...(input.taskId ? { taskId: input.taskId } : {}), plannedMinutes: input.plannedMinutes, startedAt: new Date().toISOString() }; data.focus.push(item); if (block) block.status = "ACTIVE"; return ok(res, item, 201); });
apiRouter.post("/focus-sessions/:id/finish", (req, res, next) => { const data = user(req.authUserId); const item = data.focus.find((session) => session.id === req.params.id); if (!item) return next(notFound("Focus session was not found.")); if (item.endedAt) return res.status(409).json({ error: { code: "SESSION_FINISHED", message: "This focus session has already ended." } }); const input = finishFocusSchema.parse(req.body); item.endedAt = new Date().toISOString(); item.actualMinutes = Math.max(0, Math.round((Date.now() - new Date(item.startedAt).getTime()) / 60_000)); Object.assign(item, input); const task = item.taskId ? data.tasks.find((candidate) => candidate.id === item.taskId) : undefined; if (task) task.actualMinutes += item.actualMinutes; const block = item.timeBlockId ? findBlock(data, item.timeBlockId) : undefined; if (block) block.status = input.completionState === "COMPLETE" ? "COMPLETED" : "PLANNED"; if (input.completionState === "COMPLETE") syncTaskCompletion(data, item.taskId ?? block?.taskId); return ok(res, item); });
apiRouter.get("/focus-sessions", (req, res) => ok(res, user(req.authUserId).focus));

const hydrationToday = (data: ReturnType<typeof user>) => { const date = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date()); return data.hydration.filter((item) => new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date(item.loggedAt)) === date).reduce((sum, item) => sum + item.amountMl, 0); };
apiRouter.get("/hydration/today", (req, res) => { const data = user(req.authUserId); return ok(res, { totalMl: hydrationToday(data), targetMl: data.profile.dailyWaterTargetMl }); });
apiRouter.post("/hydration", (req, res) => { const input = hydrationSchema.parse(req.body); const data = user(req.authUserId); data.hydration.push({ id: crypto.randomUUID(), amountMl: input.amountMl, loggedAt: new Date().toISOString() }); return ok(res, { totalMl: hydrationToday(data), targetMl: data.profile.dailyWaterTargetMl }, 201); });
apiRouter.post("/reflections", (req, res) => { const input = reflectionSchema.parse(req.body); const data = user(req.authUserId); const date = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date()); const previous = data.reflections.find((reflection) => reflection.date === date); const item = { id: previous?.id ?? crypto.randomUUID(), date, dayRating: input.dayRating, energyRating: input.energyRating, focusRating: input.focusRating, ...(input.notes ? { notes: input.notes } : {}) }; data.reflections = [...data.reflections.filter((reflection) => reflection.date !== date), item]; return ok(res, item, previous ? 200 : 201); });
apiRouter.get("/reflections/:date", (req, res, next) => { const item = user(req.authUserId).reflections.find((reflection) => reflection.date === req.params.date); return item ? ok(res, item) : next(notFound("Reflection was not found.")); });
apiRouter.get("/preferences", (req, res) => ok(res, user(req.authUserId).profile));
apiRouter.patch("/preferences", (req, res) => { const data = user(req.authUserId); const parsed = updateProfileSchema.parse(req.body); const { routineWindows, mealWindows, freeTime, planningStyle, ...profileInput } = parsed; Object.assign(data.profile, profileInput); Object.assign(data.profile.preferences, { ...(routineWindows ? { routineWindows } : {}), ...(mealWindows ? { mealWindows } : {}), ...(freeTime ? { freeTime } : {}), ...(planningStyle ? { planningStyle } : {}) }); rebuildFutureWeek(data); return ok(res, data.profile); });
apiRouter.get("/insights/weekly", (req, res) => {
  const data = user(req.authUserId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date());
  const firstDate = addDays(today, -6);
  const recentPlans = data.plans.filter((plan) => plan.date >= firstDate && plan.date <= today);
  const intentional = recentPlans.flatMap((plan) => plan.blocks).filter((block) => block.type !== "FREE" && block.type !== "SLEEP");
  const completed = intentional.filter((block) => block.status === "COMPLETED");
  const minutes = (items: typeof intentional) => Math.round(items.reduce((sum, block) => sum + (new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) / 60_000, 0));
  const daily = Array.from({ length: 7 }, (_, index) => { const date = addDays(firstDate, index); const blocks = recentPlans.find((plan) => plan.date === date)?.blocks.filter((block) => block.type !== "FREE" && block.type !== "SLEEP") ?? []; return { date, label: new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`)), planned: minutes(blocks), actual: minutes(blocks.filter((block) => block.status === "COMPLETED")) }; });
  const focusedMinutes = data.focus.filter((session) => session.endedAt && new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date(session.startedAt)) >= firstDate).reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0);
  const habitConsistency = data.habits.length ? Math.round(data.habits.filter((habit) => habit.completedToday).length / data.habits.length * 100) : 0;
  const planAdherence = intentional.length ? Math.round(completed.length / intentional.length * 100) : 0;
  const areas = ["WORK", "LEARNING", "HEALTH", "PERSONAL", "RECOVERY"].map((area) => ({ name: area.charAt(0) + area.slice(1).toLowerCase(), minutes: minutes(intentional.filter((block) => block.lifeArea === area)) }));
  const todaysOpen = data.plans.find((plan) => plan.date === today)?.blocks.filter((block) => block.type === "FREE").reduce((sum, block) => sum + minutes([block]), 0) ?? 0;
  const recentReflection = data.reflections.filter((item) => item.date >= firstDate && item.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  const recommendations = [
    intentional.length === 0 ? "Build a day to see how your real commitments fit." : planAdherence < 60 ? "Your recent plan may be too full. Try a spacious rhythm or shorten one commitment." : "Your recent plan size is working. Keep protecting the same breathing room.",
    habitConsistency < 50 ? "Pick one small habit to complete today, then repeat it tomorrow." : "Your habits are supporting today's plan.",
    todaysOpen >= data.profile.preferences.freeTime.minimumOpenWindowMinutes ? `You have ${Math.round(todaysOpen / 60)}h of open time today. Use it for ${data.profile.preferences.freeTime.preferredUses[0]?.toLowerCase() ?? "rest"} or keep it free.` : focusedMinutes === 0 ? "Finish a focus session to learn how long concentrated work really takes you." : "Your focus sessions are being recorded for future planning.",
    ...(recentReflection ? [recentReflection.energyRating <= 2 ? "Your latest check-in showed low energy. Protect a recovery window and consider reducing tomorrow’s load." : recentReflection.focusRating <= 2 ? "Your latest check-in showed difficult focus. Try a shorter focus block with a real break." : "Your latest check-in suggests this rhythm feels workable. Keep the windows that helped."] : [])
  ];
  return ok(res, { focusedMinutes, tasksCompleted: data.tasks.filter((task) => task.status === "COMPLETED").length, planAdherence, habitConsistency, learningMinutes: minutes(completed.filter((block) => block.lifeArea === "LEARNING")), exerciseSessions: completed.filter((block) => block.type === "EXERCISE").length, plannedMinutes: minutes(intentional), completedMinutes: minutes(completed), areas, daily, recommendations });
});
apiRouter.get("/insights/daily/:date", (req, res) => { const data = user(req.authUserId); const plan = data.plans.find((item) => item.date === req.params.date); if (!plan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "No plan exists for that date." } }); const activities = plan.blocks.filter((block) => block.type !== "FREE" && block.type !== "SLEEP"); const focusedMinutes = data.focus.filter((session) => session.endedAt && new Intl.DateTimeFormat("en-CA", { timeZone: data.profile.timezone }).format(new Date(session.startedAt)) === plan.date).reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0); return ok(res, { date: plan.date, completedActivities: activities.filter((block) => block.status === "COMPLETED").length, plannedActivities: activities.length, focusedMinutes }); });
