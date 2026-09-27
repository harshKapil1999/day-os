import type { DailyPlanResult, EnergyRequirement, Flexibility, LifeAreaSlug, Priority, Task, TimeBlock, TimeBlockType } from "@dayos/domain";

export interface FixedEventInput { id: string; title: string; startAt: string; endAt: string; type?: TimeBlockType; lifeArea?: LifeAreaSlug; }
export interface WindowPreference { id: string; title: string; type: Exclude<TimeBlockType, "TASK" | "FOCUS" | "FREE" | "SLEEP">; windowStart: string; windowEnd: string; durationMinutes: number; lifeArea: LifeAreaSlug; priority?: Priority; flexibility?: "FIXED" | "SEMI_FLEXIBLE"; description?: string; }
export interface TaskWindowPreference { id: string; title: string; windowStart: string; windowEnd: string; lifeAreas: LifeAreaSlug[]; }
export interface EnergyWindow { start: string; end: string; energy: EnergyRequirement[]; }
export interface PlannerConfig {
  bufferMinutes: number;
  breakAfterMinutes: number;
  breakDurationMinutes: number;
  slotStepMinutes: number;
  weights: { priority: number; deadline: number; energy: number; preferredTime: number; lifeArea: number; contextSwitch: number };
}
export interface GenerateDayPlanInput {
  date: string;
  timezone: string;
  wakeTime: string;
  sleepTime: string;
  tasks: Task[];
  fixedEvents?: FixedEventInput[];
  protectedWindows?: WindowPreference[];
  taskWindows?: TaskWindowPreference[];
  strictTaskWindows?: boolean;
  freeTimeSuggestions?: string[];
  minimumAbundantWindowMinutes?: number;
  includeSleep?: boolean;
  energyWindows?: EnergyWindow[];
  lifeAreaImportance?: Partial<Record<LifeAreaSlug, number>>;
  config?: Partial<PlannerConfig>;
}
export type RebalanceReason = "TASK_FINISHED_EARLY" | "TASK_OVERRAN" | "TASK_SKIPPED" | "TASK_DELAYED" | "NEW_TASK_ADDED" | "BLOCK_MOVED" | "BLOCK_RESIZED";
export interface RebalanceInput { now: string; currentPlan: TimeBlock[]; changedBlock?: TimeBlock; reason: RebalanceReason; dayEnd?: string; }
export interface RebalanceResult extends DailyPlanResult { movedBlockIds: string[]; }
export interface ScheduleCandidate { task: Task; score: number; }
export interface Interval { start: number; end: number; }
export type { DailyPlanResult, Flexibility, Task, TimeBlock };
