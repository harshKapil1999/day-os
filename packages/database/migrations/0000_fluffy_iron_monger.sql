CREATE TYPE "public"."time_block_status" AS ENUM('PLANNED', 'ACTIVE', 'COMPLETED', 'SKIPPED', 'RESCHEDULED');--> statement-breakpoint
CREATE TYPE "public"."time_block_type" AS ENUM('TASK', 'FOCUS', 'HABIT', 'MEAL', 'EXERCISE', 'LEARNING', 'READING', 'BREAK', 'EVENT', 'FREE');--> statement-breakpoint
CREATE TYPE "public"."energy_requirement" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'DEEP_FOCUS');--> statement-breakpoint
CREATE TYPE "public"."focus_completion" AS ENUM('COMPLETE', 'PARTIAL', 'NOT_COMPLETE');--> statement-breakpoint
CREATE TYPE "public"."life_area_slug" AS ENUM('WORK', 'LEARNING', 'HEALTH', 'PERSONAL', 'RECOVERY');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('DRAFT', 'ACTIVE', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."scheduling_type" AS ENUM('FIXED', 'SEMI_FLEXIBLE', 'FLEXIBLE');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('BACKLOG', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "daily_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "plan_status" DEFAULT 'ACTIVE' NOT NULL,
	"planned_minutes" integer DEFAULT 0 NOT NULL,
	"completed_minutes" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"daily_plan_id" uuid NOT NULL,
	"day_rating" integer NOT NULL,
	"energy_rating" integer NOT NULL,
	"focus_rating" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"preferred_start_time" time NOT NULL,
	"preferred_end_time" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"weekdays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"time_block_id" uuid,
	"task_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"planned_minutes" integer NOT NULL,
	"actual_minutes" integer,
	"focus_rating" integer,
	"energy_rating" integer,
	"completion_state" "focus_completion",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"value" real,
	"completed" boolean DEFAULT true NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"life_area_id" uuid,
	"life_area" "life_area_slug" DEFAULT 'HEALTH' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"habit_type" text DEFAULT 'DURATION' NOT NULL,
	"target_value" real,
	"unit" text,
	"preferred_start_time" time,
	"preferred_end_time" time,
	"minimum_duration_minutes" integer,
	"estimated_duration_minutes" integer NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"frequency_type" text DEFAULT 'DAILY' NOT NULL,
	"target_per_week" integer DEFAULT 7 NOT NULL,
	"weekdays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hydration_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_ml" integer NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"weekly_target_minutes" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learning_goal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"time_block_id" uuid,
	"topic" text,
	"planned_minutes" integer NOT NULL,
	"actual_minutes" integer,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "life_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" "life_area_slug" NOT NULL,
	"icon" text NOT NULL,
	"accent" text NOT NULL,
	"target_minutes_per_day" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"preferred_start_time" time NOT NULL,
	"preferred_end_time" time NOT NULL,
	"estimated_duration_minutes" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"daily_plan_id" uuid NOT NULL,
	"type" text NOT NULL,
	"time_block_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"life_area_id" uuid,
	"life_area" "life_area_slug" DEFAULT 'WORK' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'BACKLOG' NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"actual_minutes" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp with time zone,
	"energy_required" "energy_requirement" DEFAULT 'MEDIUM' NOT NULL,
	"preferred_time_of_day" text,
	"scheduling_type" "scheduling_type" DEFAULT 'FLEXIBLE' NOT NULL,
	"can_split" boolean DEFAULT true NOT NULL,
	"minimum_session_minutes" integer DEFAULT 25 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_plan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" time_block_type NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" time_block_status DEFAULT 'PLANNED' NOT NULL,
	"flexibility" "scheduling_type" NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"life_area" "life_area_slug" DEFAULT 'PERSONAL' NOT NULL,
	"task_id" uuid,
	"habit_id" uuid,
	"learning_goal_id" uuid,
	"locked" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"display_name" text DEFAULT 'Alex' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"wake_time" time DEFAULT '07:00' NOT NULL,
	"sleep_time" time DEFAULT '23:00' NOT NULL,
	"work_start_time" time DEFAULT '09:00' NOT NULL,
	"work_end_time" time DEFAULT '18:00' NOT NULL,
	"preferred_focus_start_time" time,
	"default_focus_duration_minutes" integer DEFAULT 90 NOT NULL,
	"default_break_duration_minutes" integer DEFAULT 15 NOT NULL,
	"daily_water_target_ml" integer DEFAULT 3000 NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reflections" ADD CONSTRAINT "daily_reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reflections" ADD CONSTRAINT "daily_reflections_daily_plan_id_daily_plans_id_fk" FOREIGN KEY ("daily_plan_id") REFERENCES "public"."daily_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_preferences" ADD CONSTRAINT "exercise_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_time_block_id_time_blocks_id_fk" FOREIGN KEY ("time_block_id") REFERENCES "public"."time_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hydration_logs" ADD CONSTRAINT "hydration_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_learning_goal_id_learning_goals_id_fk" FOREIGN KEY ("learning_goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_time_block_id_time_blocks_id_fk" FOREIGN KEY ("time_block_id") REFERENCES "public"."time_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_areas" ADD CONSTRAINT "life_areas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_preferences" ADD CONSTRAINT "meal_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_events" ADD CONSTRAINT "plan_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_events" ADD CONSTRAINT "plan_events_daily_plan_id_daily_plans_id_fk" FOREIGN KEY ("daily_plan_id") REFERENCES "public"."daily_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_events" ADD CONSTRAINT "plan_events_time_block_id_time_blocks_id_fk" FOREIGN KEY ("time_block_id") REFERENCES "public"."time_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_daily_plan_id_daily_plans_id_fk" FOREIGN KEY ("daily_plan_id") REFERENCES "public"."daily_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_plans_user_date_unique" ON "daily_plans" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_reflections_plan_unique" ON "daily_reflections" USING btree ("daily_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_completions_daily_unique" ON "habit_completions" USING btree ("habit_id","user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "life_areas_user_slug_unique" ON "life_areas" USING btree ("user_id","slug");