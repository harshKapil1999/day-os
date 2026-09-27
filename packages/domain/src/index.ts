export const LIFE_AREAS = ["WORK", "LEARNING", "HEALTH", "PERSONAL", "RECOVERY"] as const;
export type LifeAreaSlug = (typeof LIFE_AREAS)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];
export type EnergyRequirement = "LOW" | "MEDIUM" | "HIGH" | "DEEP_FOCUS";
export type SchedulingType = "FIXED" | "SEMI_FLEXIBLE" | "FLEXIBLE";
export type TaskStatus = "BACKLOG" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
export type TimeBlockType = "TASK" | "FOCUS" | "HABIT" | "MEAL" | "EXERCISE" | "LEARNING" | "READING" | "HOBBY" | "FAMILY" | "MEDITATION" | "BREAK" | "EVENT" | "FREE" | "SLEEP";
export type TimeBlockStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "SKIPPED" | "RESCHEDULED";
export type Flexibility = "FIXED" | "SEMI_FLEXIBLE" | "FLEXIBLE";

export interface Task {
  id: string;
  title: string;
  description?: string;
  lifeArea: LifeAreaSlug;
  status: TaskStatus;
  priority: Priority;
  estimatedMinutes: number;
  actualMinutes: number;
  deadline?: string;
  energyRequired: EnergyRequirement;
  preferredTimeOfDay?: "MORNING" | "AFTERNOON" | "EVENING";
  schedulingType: SchedulingType;
  canSplit: boolean;
  minimumSessionMinutes: number;
}

export interface TimeBlock {
  id: string;
  title: string;
  description?: string;
  type: TimeBlockType;
  startAt: string;
  endAt: string;
  status: TimeBlockStatus;
  flexibility: Flexibility;
  priority: Priority;
  taskId?: string;
  lifeArea: LifeAreaSlug;
  locked?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PlannerWarning { code: "NO_CAPACITY" | "INVALID_WINDOW" | "PARTIAL_SCHEDULE"; message: string; }
export interface DailyPlanResult { blocks: TimeBlock[]; unscheduledTasks: Task[]; warnings: PlannerWarning[]; }

export interface UserProfile {
  id: string;
  authUserId: string;
  displayName: string;
  timezone: string;
  wakeTime: string;
  sleepTime: string;
  workStartTime: string;
  workEndTime: string;
  defaultFocusDurationMinutes: number;
  defaultBreakDurationMinutes: number;
  dailyWaterTargetMl: number;
  onboardingCompleted: boolean;
  preferences: UserPreferences;
}

export interface MealWindowPreference {
  start: string;
  end: string;
}

export type RoutineKind = "WORK" | "EXERCISE" | "LEARNING" | "HOBBY" | "FAMILY" | "MEDITATION" | "WIND_DOWN";

export interface RoutineWindowPreference {
  id: string;
  title: string;
  kind: RoutineKind;
  days: number[];
  start: string;
  end: string;
  durationMinutes: number;
  flexibility: "FIXED" | "PREFERRED";
  active: boolean;
}

export interface FreeTimePreference {
  preferredUses: string[];
  minimumOpenWindowMinutes: number;
  dailyUnscheduledMinutes: number;
}

export interface UserPreferences {
  priorities: string[];
  improvementGoals: string[];
  exercisePreference: "MORNING" | "AFTERNOON" | "EVENING" | "NO_PREFERENCE";
  variableWorkHours: boolean;
  mealWindows: {
    breakfast: MealWindowPreference;
    lunch: MealWindowPreference;
    dinner: MealWindowPreference;
  };
  routineWindows: RoutineWindowPreference[];
  freeTime: FreeTimePreference;
  planningStyle: "STRUCTURED" | "BALANCED" | "SPACIOUS";
}

export interface NotificationService {
  createInAppNotification(input: { userId: string; title: string; body: string }): Promise<void>;
  scheduleReminder(input: { userId: string; title: string; at: Date }): Promise<string>;
  cancelReminder(id: string): Promise<void>;
}

export type HapticSemantic = "selection" | "lightImpact" | "mediumImpact" | "success" | "warning";
