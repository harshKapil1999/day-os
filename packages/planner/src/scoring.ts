import type { EnergyRequirement, Task } from "@dayos/domain";
import { PRIORITY_VALUE } from "./constants.js";
import type { PlannerConfig } from "./types.js";

function deadlineScore(deadline: string | undefined, planDate: string): number {
  if (!deadline) return 0;
  const days = Math.ceil((new Date(deadline).getTime() - new Date(`${planDate}T23:59:59Z`).getTime()) / 86_400_000);
  if (days < 0) return 5;
  if (days === 0) return 4;
  if (days === 1) return 3;
  if (days <= 7) return 2;
  return 1;
}

function energyMatch(required: EnergyRequirement, available: EnergyRequirement[]): number {
  if (available.includes(required)) return 2;
  if (required === "DEEP_FOCUS" && available.includes("HIGH")) return 1;
  if (required === "HIGH" && available.includes("DEEP_FOCUS")) return 1;
  return 0;
}

export function scoreTask(task: Task, context: { planDate: string; minuteOfDay: number; availableEnergy: EnergyRequirement[]; previousArea: string | undefined; lifeAreaImportance: number | undefined; config: PlannerConfig }): number {
  const config = context.config;
  const hour = Math.floor(context.minuteOfDay / 60);
  const period = hour < 12 ? "MORNING" : hour < 17 ? "AFTERNOON" : "EVENING";
  return PRIORITY_VALUE[task.priority] * config.weights.priority
    + deadlineScore(task.deadline, context.planDate) * config.weights.deadline
    + energyMatch(task.energyRequired, context.availableEnergy) * config.weights.energy
    + (task.preferredTimeOfDay === period ? config.weights.preferredTime : 0)
    + (context.lifeAreaImportance ?? 1) * config.weights.lifeArea
    - (context.previousArea && context.previousArea !== task.lifeArea ? config.weights.contextSwitch : 0);
}
