import type { EnergyRequirement, Task, TimeBlock } from "@dayos/domain";
import { localTimeOnDate } from "@dayos/utils";
import { findFirstGap } from "./availability.js";
import { DEFAULT_PLANNER_CONFIG } from "./constants.js";
import { scoreTask } from "./scoring.js";
import type { GenerateDayPlanInput, Interval, PlannerConfig } from "./types.js";

const iso = (ms: number) => new Date(ms).toISOString();
const minutes = (value: number) => value * 60_000;

function block(input: Omit<TimeBlock, "status">): TimeBlock { return { ...input, status: "PLANNED" }; }

function resolveDay(input: GenerateDayPlanInput): { start: number; end: number } {
  const start = localTimeOnDate(input.date, input.wakeTime, input.timezone).getTime();
  let end = localTimeOnDate(input.date, input.sleepTime, input.timezone).getTime();
  if (end <= start) end += 24 * 60 * 60_000;
  return { start, end };
}

function energyAt(ms: number, input: GenerateDayPlanInput): EnergyRequirement[] {
  const local = new Intl.DateTimeFormat("en-US", { timeZone: input.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
  const value = Number(local.slice(0, 2)) * 60 + Number(local.slice(3));
  for (const window of input.energyWindows ?? []) {
    const [sh, sm] = window.start.split(":").map(Number); const [eh, em] = window.end.split(":").map(Number);
    if (value >= sh! * 60 + sm! && value < eh! * 60 + em!) return window.energy;
  }
  if (value < 12 * 60) return ["DEEP_FOCUS", "HIGH"];
  if (value < 17 * 60) return ["HIGH", "MEDIUM"];
  return ["MEDIUM", "LOW"];
}

export function generateDayPlan(input: GenerateDayPlanInput) {
  const config: PlannerConfig = { ...DEFAULT_PLANNER_CONFIG, ...input.config, weights: { ...DEFAULT_PLANNER_CONFIG.weights, ...input.config?.weights } };
  const day = resolveDay(input);
  const effectiveEnd = day.end - minutes(config.bufferMinutes);
  const blocks: TimeBlock[] = [];
  const occupied: Interval[] = [];

  for (const event of input.fixedEvents ?? []) {
    const start = new Date(event.startAt).getTime(); const end = new Date(event.endAt).getTime();
    if (start < day.start || end > day.end || end <= start) continue;
    blocks.push(block({ id: event.id, title: event.title, type: event.type ?? "EVENT", startAt: iso(start), endAt: iso(end), flexibility: "FIXED", priority: "HIGH", lifeArea: event.lifeArea ?? "PERSONAL", locked: true }));
    occupied.push({ start, end });
  }

  for (const preference of input.protectedWindows ?? []) {
    const windowStart = localTimeOnDate(input.date, preference.windowStart, input.timezone).getTime();
    let windowEnd = localTimeOnDate(input.date, preference.windowEnd, input.timezone).getTime();
    if (windowEnd <= windowStart) windowEnd += 24 * 60 * 60_000;
    const start = findFirstGap(day.start, effectiveEnd, minutes(preference.durationMinutes), occupied, windowStart, windowEnd);
    if (start === null) continue;
    const end = start + minutes(preference.durationMinutes);
    blocks.push(block({ id: preference.id, title: preference.title, type: preference.type, startAt: iso(start), endAt: iso(end), flexibility: "SEMI_FLEXIBLE", priority: preference.priority ?? "MEDIUM", lifeArea: preference.lifeArea }));
    occupied.push({ start, end });
  }

  const pending = input.tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "SKIPPED").map((task) => ({ task, remaining: task.estimatedMinutes }));
  const unscheduledTasks: Task[] = [];
  let focusedMinutes = 0;
  let previousArea: string | undefined;

  while (pending.some((item) => item.remaining > 0)) {
    const firstGap = findFirstGap(day.start, effectiveEnd, minutes(10), occupied);
    if (firstGap === null) break;
    const availableEnergy = energyAt(firstGap, input);
    const ranked = pending.filter((item) => item.remaining > 0).sort((a, b) => scoreTask(b.task, { planDate: input.date, minuteOfDay: new Date(firstGap).getUTCHours() * 60, availableEnergy, previousArea, lifeAreaImportance: input.lifeAreaImportance?.[b.task.lifeArea], config }) - scoreTask(a.task, { planDate: input.date, minuteOfDay: new Date(firstGap).getUTCHours() * 60, availableEnergy, previousArea, lifeAreaImportance: input.lifeAreaImportance?.[a.task.lifeArea], config }));
    const selected = ranked[0];
    if (!selected) break;

    const duration = selected.task.canSplit ? Math.min(selected.remaining, Math.max(selected.task.minimumSessionMinutes, 90)) : selected.remaining;
    let start = findFirstGap(day.start, effectiveEnd, minutes(duration), occupied, firstGap);
    let actualDuration = duration;
    if (start === null && selected.task.canSplit) {
      actualDuration = selected.task.minimumSessionMinutes;
      start = findFirstGap(day.start, effectiveEnd, minutes(actualDuration), occupied, firstGap);
    }
    if (start === null) { unscheduledTasks.push(selected.task); selected.remaining = 0; continue; }

    const end = start + minutes(actualDuration);
    blocks.push(block({ id: `${selected.task.id}-${selected.task.estimatedMinutes - selected.remaining}`, title: selected.task.title, ...(selected.task.description ? { description: selected.task.description } : {}), type: selected.task.energyRequired === "DEEP_FOCUS" ? "FOCUS" : "TASK", startAt: iso(start), endAt: iso(end), flexibility: selected.task.schedulingType, priority: selected.task.priority, taskId: selected.task.id, lifeArea: selected.task.lifeArea }));
    occupied.push({ start, end }); selected.remaining -= actualDuration; focusedMinutes += actualDuration; previousArea = selected.task.lifeArea;

    if (focusedMinutes >= config.breakAfterMinutes) {
      const breakStart = findFirstGap(day.start, effectiveEnd, minutes(config.breakDurationMinutes), occupied, end);
      if (breakStart !== null && breakStart - end <= minutes(15)) {
        const breakEnd = breakStart + minutes(config.breakDurationMinutes);
        blocks.push(block({ id: `break-${breakStart}`, title: "Reset break", type: "BREAK", startAt: iso(breakStart), endAt: iso(breakEnd), flexibility: "FLEXIBLE", priority: "LOW", lifeArea: "RECOVERY" }));
        occupied.push({ start: breakStart, end: breakEnd }); focusedMinutes = 0;
      }
    }
  }

  for (const item of pending) if (item.remaining > 0 && !unscheduledTasks.some((task) => task.id === item.task.id)) unscheduledTasks.push(item.task);
  const scheduled = [...blocks].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const withFree: TimeBlock[] = [];
  let cursor = day.start;
  for (const item of scheduled) {
    const start = new Date(item.startAt).getTime();
    if (start - cursor >= minutes(20)) withFree.push(block({ id: `free-${cursor}`, title: "Free time", type: "FREE", startAt: iso(cursor), endAt: iso(start), flexibility: "FLEXIBLE", priority: "LOW", lifeArea: "RECOVERY" }));
    withFree.push(item); cursor = Math.max(cursor, new Date(item.endAt).getTime());
  }
  if (day.end - cursor >= minutes(20)) withFree.push(block({ id: `free-${cursor}`, title: "Free time", type: "FREE", startAt: iso(cursor), endAt: iso(day.end), flexibility: "FLEXIBLE", priority: "LOW", lifeArea: "RECOVERY" }));

  return { blocks: withFree, unscheduledTasks, warnings: unscheduledTasks.length ? [{ code: "PARTIAL_SCHEDULE" as const, message: `${unscheduledTasks.length} activities remain in the backlog.` }] : [] };
}
