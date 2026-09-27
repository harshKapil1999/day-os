import { boolean, date, integer, jsonb, pgEnum, pgTable, real, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const priorityEnum = pgEnum("priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const lifeAreaSlugEnum = pgEnum("life_area_slug", ["WORK", "LEARNING", "HEALTH", "PERSONAL", "RECOVERY"]);
export const taskStatusEnum = pgEnum("task_status", ["BACKLOG", "PLANNED", "IN_PROGRESS", "COMPLETED", "SKIPPED"]);
export const energyEnum = pgEnum("energy_requirement", ["LOW", "MEDIUM", "HIGH", "DEEP_FOCUS"]);
export const schedulingEnum = pgEnum("scheduling_type", ["FIXED", "SEMI_FLEXIBLE", "FLEXIBLE"]);
export const planStatusEnum = pgEnum("plan_status", ["DRAFT", "ACTIVE", "COMPLETED"]);
export const blockTypeEnum = pgEnum("time_block_type", ["TASK", "FOCUS", "HABIT", "MEAL", "EXERCISE", "LEARNING", "READING", "HOBBY", "FAMILY", "MEDITATION", "BREAK", "EVENT", "FREE", "SLEEP"]);
export const blockStatusEnum = pgEnum("time_block_status", ["PLANNED", "ACTIVE", "COMPLETED", "SKIPPED", "RESCHEDULED"]);
export const focusCompletionEnum = pgEnum("focus_completion", ["COMPLETE", "PARTIAL", "NOT_COMPLETE"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(), authUserId: text("auth_user_id").notNull().unique(), displayName: text("display_name").notNull().default("Alex"),
  timezone: text("timezone").notNull().default("UTC"), wakeTime: time("wake_time").notNull().default("07:00"), sleepTime: time("sleep_time").notNull().default("23:00"),
  workStartTime: time("work_start_time").notNull().default("09:00"), workEndTime: time("work_end_time").notNull().default("18:00"),
  preferredFocusStartTime: time("preferred_focus_start_time"), defaultFocusDurationMinutes: integer("default_focus_duration_minutes").notNull().default(90),
  defaultBreakDurationMinutes: integer("default_break_duration_minutes").notNull().default(15), dailyWaterTargetMl: integer("daily_water_target_ml").notNull().default(3000),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false), preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}), ...timestamps
});

export const lifeAreas = pgTable("life_areas", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), name: text("name").notNull(), slug: lifeAreaSlugEnum("slug").notNull(),
  icon: text("icon").notNull(), accent: text("accent").notNull(), targetMinutesPerDay: integer("target_minutes_per_day"), sortOrder: integer("sort_order").notNull().default(0), ...timestamps
}, (table) => [uniqueIndex("life_areas_user_slug_unique").on(table.userId, table.slug)]);

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
  lifeArea: lifeAreaSlugEnum("life_area").notNull().default("WORK"), title: text("title").notNull(), description: text("description"), status: taskStatusEnum("status").notNull().default("BACKLOG"),
  priority: priorityEnum("priority").notNull().default("MEDIUM"), estimatedMinutes: integer("estimated_minutes").notNull(), actualMinutes: integer("actual_minutes").notNull().default(0), deadline: timestamp("deadline", { withTimezone: true }),
  energyRequired: energyEnum("energy_required").notNull().default("MEDIUM"), preferredTimeOfDay: text("preferred_time_of_day"), schedulingType: schedulingEnum("scheduling_type").notNull().default("FLEXIBLE"),
  canSplit: boolean("can_split").notNull().default(true), minimumSessionMinutes: integer("minimum_session_minutes").notNull().default(25), completedAt: timestamp("completed_at", { withTimezone: true }), ...timestamps
});

export const habits = pgTable("habits", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), lifeAreaId: uuid("life_area_id").references(() => lifeAreas.id, { onDelete: "set null" }),
  lifeArea: lifeAreaSlugEnum("life_area").notNull().default("HEALTH"), name: text("name").notNull(), description: text("description"), habitType: text("habit_type").notNull().default("DURATION"),
  targetValue: real("target_value"), unit: text("unit"), preferredStartTime: time("preferred_start_time"), preferredEndTime: time("preferred_end_time"), minimumDurationMinutes: integer("minimum_duration_minutes"),
  estimatedDurationMinutes: integer("estimated_duration_minutes").notNull(), priority: priorityEnum("priority").notNull().default("MEDIUM"), frequencyType: text("frequency_type").notNull().default("DAILY"),
  targetPerWeek: integer("target_per_week").notNull().default(7), weekdays: jsonb("weekdays").$type<number[]>().notNull().default([]), active: boolean("active").notNull().default(true), ...timestamps
});

export const habitCompletions = pgTable("habit_completions", {
  id: uuid("id").defaultRandom().primaryKey(), habitId: uuid("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(), value: real("value"), completed: boolean("completed").notNull().default(true), completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow()
}, (table) => [uniqueIndex("habit_completions_daily_unique").on(table.habitId, table.userId, table.date)]);

export const dailyPlans = pgTable("daily_plans", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), date: date("date").notNull(), status: planStatusEnum("status").notNull().default("ACTIVE"),
  plannedMinutes: integer("planned_minutes").notNull().default(0), completedMinutes: integer("completed_minutes").notNull().default(0), generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(), ...timestamps
}, (table) => [uniqueIndex("daily_plans_user_date_unique").on(table.userId, table.date)]);

export const timeBlocks = pgTable("time_blocks", {
  id: uuid("id").defaultRandom().primaryKey(), dailyPlanId: uuid("daily_plan_id").notNull().references(() => dailyPlans.id, { onDelete: "cascade" }), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: blockTypeEnum("type").notNull(), title: text("title").notNull(), description: text("description"), startAt: timestamp("start_at", { withTimezone: true }).notNull(), endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  status: blockStatusEnum("status").notNull().default("PLANNED"), flexibility: schedulingEnum("flexibility").notNull(), priority: priorityEnum("priority").notNull().default("MEDIUM"),
  lifeArea: lifeAreaSlugEnum("life_area").notNull().default("PERSONAL"), taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }), habitId: uuid("habit_id").references(() => habits.id, { onDelete: "set null" }),
  learningGoalId: uuid("learning_goal_id"), locked: boolean("locked").notNull().default(false), metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}), ...timestamps
});

export const focusSessions = pgTable("focus_sessions", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), timeBlockId: uuid("time_block_id").references(() => timeBlocks.id, { onDelete: "set null" }), taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(), endedAt: timestamp("ended_at", { withTimezone: true }), plannedMinutes: integer("planned_minutes").notNull(), actualMinutes: integer("actual_minutes"), focusRating: integer("focus_rating"), energyRating: integer("energy_rating"), completionState: focusCompletionEnum("completion_state"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const hydrationLogs = pgTable("hydration_logs", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), amountMl: integer("amount_ml").notNull(), loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull()
});

export const mealPreferences = pgTable("meal_preferences", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), type: text("type").notNull(), preferredStartTime: time("preferred_start_time").notNull(), preferredEndTime: time("preferred_end_time").notNull(), estimatedDurationMinutes: integer("estimated_duration_minutes").notNull(), active: boolean("active").notNull().default(true)
});
export const exercisePreferences = pgTable("exercise_preferences", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), activityType: text("activity_type").notNull(), preferredStartTime: time("preferred_start_time").notNull(), preferredEndTime: time("preferred_end_time").notNull(), durationMinutes: integer("duration_minutes").notNull(), weekdays: jsonb("weekdays").$type<number[]>().notNull().default([]), active: boolean("active").notNull().default(true)
});
export const learningGoals = pgTable("learning_goals", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), title: text("title").notNull(), description: text("description"), weeklyTargetMinutes: integer("weekly_target_minutes").notNull(), active: boolean("active").notNull().default(true), ...timestamps
});
export const learningSessions = pgTable("learning_sessions", {
  id: uuid("id").defaultRandom().primaryKey(), learningGoalId: uuid("learning_goal_id").notNull().references(() => learningGoals.id, { onDelete: "cascade" }), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), timeBlockId: uuid("time_block_id").references(() => timeBlocks.id, { onDelete: "set null" }), topic: text("topic"), plannedMinutes: integer("planned_minutes").notNull(), actualMinutes: integer("actual_minutes"), completedAt: timestamp("completed_at", { withTimezone: true })
});
export const dailyReflections = pgTable("daily_reflections", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), dailyPlanId: uuid("daily_plan_id").notNull().references(() => dailyPlans.id, { onDelete: "cascade" }), dayRating: integer("day_rating").notNull(), energyRating: integer("energy_rating").notNull(), focusRating: integer("focus_rating").notNull(), notes: text("notes"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("daily_reflections_plan_unique").on(table.dailyPlanId)]);
export const planEvents = pgTable("plan_events", {
  id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), dailyPlanId: uuid("daily_plan_id").notNull().references(() => dailyPlans.id, { onDelete: "cascade" }), type: text("type").notNull(), timeBlockId: uuid("time_block_id").references(() => timeBlocks.id, { onDelete: "set null" }), metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
