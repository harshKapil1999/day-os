import { z } from "zod";

export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const energySchema = z.enum(["LOW", "MEDIUM", "HIGH", "DEEP_FOCUS"]);
export const schedulingTypeSchema = z.enum(["FIXED", "SEMI_FLEXIBLE", "FLEXIBLE"]);
export const lifeAreaSchema = z.enum(["WORK", "LEARNING", "HEALTH", "PERSONAL", "RECOVERY"]);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const routineWindowSchema = z.object({
  id: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(120),
  kind: z.enum(["WORK", "EXERCISE", "LEARNING", "HOBBY", "FAMILY", "MEDITATION", "WIND_DOWN"]),
  days: z.array(z.number().int().min(0).max(6)).max(7), start: timeSchema, end: timeSchema,
  durationMinutes: z.number().int().min(5).max(720), flexibility: z.enum(["FIXED", "PREFERRED"]), active: z.boolean()
}).refine((value) => !value.active || value.days.length > 0, "Choose at least one day for an active routine.");
export const freeTimePreferenceSchema = z.object({
  preferredUses: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
  minimumOpenWindowMinutes: z.number().int().min(20).max(240), dailyUnscheduledMinutes: z.number().int().min(15).max(360)
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  lifeArea: lifeAreaSchema.default("WORK"),
  estimatedMinutes: z.number().int().min(5).max(720),
  priority: prioritySchema.default("MEDIUM"),
  energyRequired: energySchema.default("MEDIUM"),
  deadline: z.iso.datetime().optional(),
  schedulingType: schedulingTypeSchema.default("FLEXIBLE"),
  canSplit: z.boolean().default(true),
  minimumSessionMinutes: z.number().int().min(10).max(180).default(25)
});
export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(["BACKLOG", "PLANNED", "IN_PROGRESS", "COMPLETED", "SKIPPED"]).optional()
});
export const createHabitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  lifeArea: lifeAreaSchema.default("HEALTH"),
  estimatedDurationMinutes: z.number().int().min(1).max(240),
  frequencyType: z.enum(["DAILY", "WEEKDAYS", "TIMES_PER_WEEK"]).default("DAILY"),
  targetPerWeek: z.number().int().min(1).max(7).default(7)
});
export const updateHabitSchema = createHabitSchema.partial().extend({ active: z.boolean().optional() });
const mealWindowsSchema = z.object({
  breakfast: z.object({ start: timeSchema, end: timeSchema }), lunch: z.object({ start: timeSchema, end: timeSchema }), dinner: z.object({ start: timeSchema, end: timeSchema })
});
export const onboardingSchema = z.object({
  timezone: z.string().min(1), wakeTime: timeSchema, sleepTime: timeSchema,
  workStartTime: timeSchema, workEndTime: timeSchema,
  dailyWaterTargetMl: z.number().int().min(500).max(8000), priorities: z.array(z.string()).min(1).max(10),
  displayName: z.string().trim().min(1).max(100).optional(),
  improvementGoals: z.array(z.string()).max(10).default([]),
  exercisePreference: z.enum(["MORNING", "AFTERNOON", "EVENING", "NO_PREFERENCE"]).default("NO_PREFERENCE"),
  variableWorkHours: z.boolean().default(false),
  mealWindows: mealWindowsSchema,
  routineWindows: z.array(routineWindowSchema).max(20), freeTime: freeTimePreferenceSchema,
  planningStyle: z.enum(["STRUCTURED", "BALANCED", "SPACIOUS"]).default("BALANCED")
});
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(), timezone: z.string().min(1).optional(),
  wakeTime: timeSchema.optional(), sleepTime: timeSchema.optional(),
  workStartTime: timeSchema.optional(), workEndTime: timeSchema.optional(),
  defaultFocusDurationMinutes: z.number().int().min(25).max(180).optional(), defaultBreakDurationMinutes: z.number().int().min(5).max(45).optional(),
  dailyWaterTargetMl: z.number().int().min(500).max(8000).optional(),
  routineWindows: z.array(routineWindowSchema).max(20).optional(), mealWindows: mealWindowsSchema.optional(), freeTime: freeTimePreferenceSchema.optional(),
  planningStyle: z.enum(["STRUCTURED", "BALANCED", "SPACIOUS"]).optional()
});
export const hydrationSchema = z.object({ amountMl: z.number().int().min(50).max(2000) });
export const startFocusSchema = z.object({ timeBlockId: z.string().min(1).max(160).optional(), taskId: z.string().min(1).max(160).optional(), plannedMinutes: z.number().int().min(1).max(720) });
export const finishFocusSchema = z.object({ completionState: z.enum(["COMPLETE", "PARTIAL", "NOT_COMPLETE"]), focusRating: z.number().int().min(1).max(5), energyRating: z.number().int().min(1).max(5).optional() });
export const reflectionSchema = z.object({ dayRating: z.number().int().min(1).max(5), energyRating: z.number().int().min(1).max(5), focusRating: z.number().int().min(1).max(5), notes: z.string().max(4000).optional() });
export const rebalanceSchema = z.object({ reason: z.enum(["TASK_FINISHED_EARLY", "TASK_OVERRAN", "TASK_SKIPPED", "TASK_DELAYED", "NEW_TASK_ADDED", "BLOCK_MOVED", "BLOCK_RESIZED"]), now: z.iso.datetime().optional() });
export const patchTimeBlockSchema = z.object({ startAt: z.iso.datetime(), endAt: z.iso.datetime() }).refine((value) => new Date(value.endAt) > new Date(value.startAt), "End must be after start");

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export type ApiSuccess<T> = { data: T };
export type ApiErrorBody = { error: { code: string; message: string; requestId?: string } };
