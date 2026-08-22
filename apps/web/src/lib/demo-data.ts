import type { Task, TimeBlock } from "@dayos/domain";

const now = new Date(); const at = (hour: number, minute = 0) => { const value = new Date(now); value.setHours(hour, minute, 0, 0); return value.toISOString(); };
export const demoTasks: Task[] = [
  { id: "task-auth", title: "Build authentication flow", lifeArea: "WORK", status: "PLANNED", priority: "CRITICAL", estimatedMinutes: 120, actualMinutes: 0, energyRequired: "DEEP_FOCUS", schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 25 },
  { id: "task-planner", title: "Refine planner constraints", lifeArea: "WORK", status: "BACKLOG", priority: "HIGH", estimatedMinutes: 90, actualMinutes: 0, energyRequired: "DEEP_FOCUS", schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 30 },
  { id: "task-course", title: "Systems design course", lifeArea: "LEARNING", status: "PLANNED", priority: "MEDIUM", estimatedMinutes: 60, actualMinutes: 0, energyRequired: "HIGH", schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 25 },
  { id: "task-admin", title: "Clear personal admin", lifeArea: "PERSONAL", status: "BACKLOG", priority: "MEDIUM", estimatedMinutes: 45, actualMinutes: 0, energyRequired: "LOW", schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 20 },
  { id: "task-reading", title: "Read DDIA", lifeArea: "LEARNING", status: "BACKLOG", priority: "LOW", estimatedMinutes: 40, actualMinutes: 0, energyRequired: "LOW", schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 20 }
];
export const demoBlocks: TimeBlock[] = [
  { id: "breakfast", title: "Breakfast", type: "MEAL", startAt: at(8), endAt: at(8, 30), status: "COMPLETED", flexibility: "SEMI_FLEXIBLE", priority: "MEDIUM", lifeArea: "RECOVERY" },
  { id: "focus", title: "Build authentication flow", description: "DayOS web and API", type: "FOCUS", startAt: at(9), endAt: at(11), status: "ACTIVE", flexibility: "FLEXIBLE", priority: "CRITICAL", lifeArea: "WORK", taskId: "task-auth" },
  { id: "reset", title: "Water + short break", type: "BREAK", startAt: at(11), endAt: at(11, 15), status: "PLANNED", flexibility: "FLEXIBLE", priority: "LOW", lifeArea: "RECOVERY" },
  { id: "learning", title: "Systems design course", type: "LEARNING", startAt: at(11, 15), endAt: at(12, 15), status: "PLANNED", flexibility: "FLEXIBLE", priority: "MEDIUM", lifeArea: "LEARNING", taskId: "task-course" },
  { id: "standup", title: "Team stand-up", type: "EVENT", startAt: at(12, 15), endAt: at(12, 45), status: "PLANNED", flexibility: "FIXED", priority: "HIGH", lifeArea: "WORK", locked: true },
  { id: "lunch", title: "Lunch", type: "MEAL", startAt: at(13, 30), endAt: at(14, 15), status: "PLANNED", flexibility: "SEMI_FLEXIBLE", priority: "MEDIUM", lifeArea: "RECOVERY" },
  { id: "admin", title: "Personal admin", type: "TASK", startAt: at(14, 15), endAt: at(15), status: "PLANNED", flexibility: "FLEXIBLE", priority: "MEDIUM", lifeArea: "PERSONAL", taskId: "task-admin" },
  { id: "planner", title: "Refine planner constraints", type: "FOCUS", startAt: at(15), endAt: at(16, 30), status: "PLANNED", flexibility: "FLEXIBLE", priority: "HIGH", lifeArea: "WORK", taskId: "task-planner" },
  { id: "free", title: "Free time", type: "FREE", startAt: at(16, 30), endAt: at(17, 30), status: "PLANNED", flexibility: "FLEXIBLE", priority: "LOW", lifeArea: "RECOVERY" },
  { id: "gym", title: "Strength training", type: "EXERCISE", startAt: at(17, 30), endAt: at(18, 30), status: "PLANNED", flexibility: "SEMI_FLEXIBLE", priority: "HIGH", lifeArea: "HEALTH" },
  { id: "dinner", title: "Dinner", type: "MEAL", startAt: at(19, 15), endAt: at(20), status: "PLANNED", flexibility: "SEMI_FLEXIBLE", priority: "MEDIUM", lifeArea: "RECOVERY" },
  { id: "read", title: "Read DDIA", type: "READING", startAt: at(20), endAt: at(20, 40), status: "PLANNED", flexibility: "FLEXIBLE", priority: "LOW", lifeArea: "LEARNING", taskId: "task-reading" },
  { id: "wind", title: "Wind down", type: "HABIT", startAt: at(22, 15), endAt: at(22, 40), status: "PLANNED", flexibility: "SEMI_FLEXIBLE", priority: "MEDIUM", lifeArea: "RECOVERY" }
];
export const demoHabits = [
  { id: "habit-water", name: "Morning water", lifeArea: "HEALTH", estimatedDurationMinutes: 2, frequencyType: "DAILY", targetPerWeek: 7, streak: 12, completedToday: true, active: true },
  { id: "habit-read", name: "Read", lifeArea: "LEARNING", estimatedDurationMinutes: 30, frequencyType: "DAILY", targetPerWeek: 7, streak: 5, completedToday: false, active: true },
  { id: "habit-gym", name: "Gym", lifeArea: "HEALTH", estimatedDurationMinutes: 60, frequencyType: "TIMES_PER_WEEK", targetPerWeek: 5, streak: 3, completedToday: false, active: true },
  { id: "habit-wind", name: "Wind down", lifeArea: "RECOVERY", estimatedDurationMinutes: 20, frequencyType: "DAILY", targetPerWeek: 7, streak: 8, completedToday: false, active: true }
];
