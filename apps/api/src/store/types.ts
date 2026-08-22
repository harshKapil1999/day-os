import type { Task, TimeBlock, UserProfile } from "@dayos/domain";

export interface HabitRecord { id: string; name: string; lifeArea: string; estimatedDurationMinutes: number; frequencyType: string; targetPerWeek: number; streak: number; completedToday: boolean; active: boolean; }
export interface FocusRecord { id: string; timeBlockId?: string; taskId?: string; startedAt: string; endedAt?: string; plannedMinutes: number; actualMinutes?: number; completionState?: string; focusRating?: number; energyRating?: number; }
export interface ReflectionRecord { id: string; date: string; dayRating: number; energyRating: number; focusRating: number; notes?: string; }
export interface UserData {
  profile: UserProfile; tasks: Task[]; habits: HabitRecord[]; plans: Array<{ id: string; date: string; status: string; blocks: TimeBlock[] }>;
  hydration: Array<{ id: string; amountMl: number; loggedAt: string }>; focus: FocusRecord[]; reflections: ReflectionRecord[];
}
