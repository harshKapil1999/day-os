import { z } from "zod";

export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const energySchema = z.enum(["LOW", "MEDIUM", "HIGH", "DEEP_FOCUS"]);
export const schedulingTypeSchema = z.enum(["FIXED", "SEMI_FLEXIBLE", "FLEXIBLE"]);
export const lifeAreaSchema = z.enum(["WORK", "LEARNING", "HEALTH", "PERSONAL", "RECOVERY"]);

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
export const onboardingSchema = z.object({
  timezone: z.string().min(1), wakeTime: z.string().regex(/^\d{2}:\d{2}$/), sleepTime: z.string().regex(/^\d{2}:\d{2}$/),
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/), workEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  dailyWaterTargetMl: z.number().int().min(500).max(8000), priorities: z.array(z.string()).max(10)
});
export const hydrationSchema = z.object({ amountMl: z.number().int().min(50).max(2000) });
export const finishFocusSchema = z.object({ completionState: z.enum(["COMPLETE", "PARTIAL", "NOT_COMPLETE"]), focusRating: z.number().int().min(1).max(5), energyRating: z.number().int().min(1).max(5).optional() });
export const reflectionSchema = z.object({ dayRating: z.number().int().min(1).max(5), energyRating: z.number().int().min(1).max(5), focusRating: z.number().int().min(1).max(5), notes: z.string().max(4000).optional() });
export const rebalanceSchema = z.object({ reason: z.enum(["TASK_FINISHED_EARLY", "TASK_OVERRAN", "TASK_SKIPPED", "TASK_DELAYED", "NEW_TASK_ADDED", "BLOCK_MOVED", "BLOCK_RESIZED"]), now: z.iso.datetime().optional() });
export const patchTimeBlockSchema = z.object({ startAt: z.iso.datetime(), endAt: z.iso.datetime() }).refine((value) => new Date(value.endAt) > new Date(value.startAt), "End must be after start");

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export type ApiSuccess<T> = { data: T };
export type ApiErrorBody = { error: { code: string; message: string; requestId?: string } };
