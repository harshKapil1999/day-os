import type { TimeBlock } from "@dayos/domain";
import { findFirstGap } from "./availability.js";
import type { Interval, RebalanceInput, RebalanceResult } from "./types.js";

export function rebalanceRemainingDay(input: RebalanceInput): RebalanceResult {
  const now = new Date(input.now).getTime();
  const normalizedPlan = input.changedBlock ? input.currentPlan.map((item) => item.id === input.changedBlock!.id ? input.changedBlock! : item) : input.currentPlan;
  const mutable = normalizedPlan.filter((item) => new Date(item.startAt).getTime() >= now && item.flexibility !== "FIXED" && !item.locked && item.status !== "COMPLETED");
  const preserved = normalizedPlan.filter((item) => !mutable.includes(item));
  const occupied: Interval[] = preserved.map((item) => ({ start: new Date(item.startAt).getTime(), end: new Date(item.endAt).getTime() }));
  let cursor = input.changedBlock ? Math.max(now, new Date(input.changedBlock.endAt).getTime()) : now;
  const dayEnd = input.dayEnd ? new Date(input.dayEnd).getTime() : Math.max(...normalizedPlan.map((item) => new Date(item.endAt).getTime()));
  const movedBlockIds: string[] = [];
  const reflowed: TimeBlock[] = [];

  for (const item of mutable.sort((a, b) => a.startAt.localeCompare(b.startAt))) {
    const duration = new Date(item.endAt).getTime() - new Date(item.startAt).getTime();
    const start = findFirstGap(cursor, dayEnd, duration, occupied, cursor);
    if (start === null) continue;
    const next = { ...item, startAt: new Date(start).toISOString(), endAt: new Date(start + duration).toISOString(), status: item.status === "PLANNED" ? "RESCHEDULED" as const : item.status };
    if (next.startAt !== item.startAt) movedBlockIds.push(item.id);
    reflowed.push(next); occupied.push({ start, end: start + duration }); cursor = start + duration;
  }

  return { blocks: [...preserved, ...reflowed].sort((a, b) => a.startAt.localeCompare(b.startAt)), unscheduledTasks: [], warnings: reflowed.length < mutable.length ? [{ code: "NO_CAPACITY", message: "Some activities no longer fit today." }] : [], movedBlockIds };
}
