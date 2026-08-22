import type { PlannerConfig } from "./types.js";

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  bufferMinutes: 45,
  breakAfterMinutes: 105,
  breakDurationMinutes: 15,
  slotStepMinutes: 5,
  weights: { priority: 4, deadline: 3, energy: 2, preferredTime: 2, lifeArea: 1.5, contextSwitch: 1 }
};

export const PRIORITY_VALUE = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;
