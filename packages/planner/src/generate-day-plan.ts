import type { EnergyRequirement, Task, TimeBlock } from "@dayos/domain";
import { localTimeOnDate } from "@dayos/utils";
import { findFirstGap, overlaps } from "./availability.js";
import { DEFAULT_PLANNER_CONFIG } from "./constants.js";
import { scoreTask } from "./scoring.js";
import type { GenerateDayPlanInput, Interval, PlannerConfig, TaskWindowPreference } from "./types.js";

const iso = (ms: number) => new Date(ms).toISOString();
const minutes = (value: number) => value * 60_000;
const durationOf = (item: TimeBlock) => Math.round((new Date(item.endAt).getTime() - new Date(item.startAt).getTime()) / 60_000);
function block(input: Omit<TimeBlock, "status">): TimeBlock { return { ...input, status: "PLANNED" }; }

function resolveDay(input: GenerateDayPlanInput): { start: number; end: number } {
  const start = localTimeOnDate(input.date, input.wakeTime, input.timezone).getTime();
  let end = localTimeOnDate(input.date, input.sleepTime, input.timezone).getTime();
  if (end <= start) end += 24 * 60 * 60_000;
  return { start, end };
}

function localMinute(ms: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms)).split(":").map(Number);
  return parts[0]! * 60 + parts[1]!;
}

function energyAt(ms: number, input: GenerateDayPlanInput): EnergyRequirement[] {
  const value = localMinute(ms, input.timezone);
  for (const window of input.energyWindows ?? []) {
    const [sh, sm] = window.start.split(":").map(Number); const [eh, em] = window.end.split(":").map(Number);
    if (value >= sh! * 60 + sm! && value < eh! * 60 + em!) return window.energy;
  }
  if (value < 12 * 60) return ["DEEP_FOCUS", "HIGH"];
  if (value < 17 * 60) return ["HIGH", "MEDIUM"];
  return ["MEDIUM", "LOW"];
}

function bounds(date: string, timezone: string, window: Pick<TaskWindowPreference, "windowStart" | "windowEnd">): Interval {
  const start = localTimeOnDate(date, window.windowStart, timezone).getTime();
  let end = localTimeOnDate(date, window.windowEnd, timezone).getTime();
  if (end <= start) end += 24 * 60 * 60_000;
  return { start, end };
}

function freeBlock(input: GenerateDayPlanInput, start: number, end: number): TimeBlock {
  const durationMinutes = Math.round((end - start) / 60_000);
  const suggestions = input.freeTimeSuggestions?.length ? input.freeTimeSuggestions : ["rest", "family", "meditation", "learning"];
  const abundant = durationMinutes >= (input.minimumAbundantWindowMinutes ?? 60);
  const context = input.taskWindows?.find((window) => { const interval = bounds(input.date, input.timezone, window); return start < interval.end && end > interval.start; });
  if (context) return block({
    id: `free-${start}`, title: `${context.title} · capacity available`, type: "FREE", startAt: iso(start), endAt: iso(end), flexibility: "FLEXIBLE", priority: "LOW", lifeArea: context.lifeAreas[0] ?? "PERSONAL",
    description: `No task is waiting here. Add something meaningful or deliberately keep this ${durationMinutes}-minute window open.`, metadata: { intentional: true, abundant, suggestions, durationMinutes, taskWindowId: context.id }
  });
  return block({
    id: `free-${start}`, title: abundant ? "Open window · time in abundance" : "Breathing room", type: "FREE", startAt: iso(start), endAt: iso(end),
    flexibility: "FLEXIBLE", priority: "LOW", lifeArea: "RECOVERY",
    description: abundant ? `Protected choice: ${suggestions.slice(0, 4).join(", ")}, or simply enjoy the quiet.` : "A deliberate buffer so the day can breathe.",
    metadata: { intentional: true, abundant, suggestions, durationMinutes }
  });
}

export function generateDayPlan(input: GenerateDayPlanInput) {
  const config: PlannerConfig = { ...DEFAULT_PLANNER_CONFIG, ...input.config, weights: { ...DEFAULT_PLANNER_CONFIG.weights, ...input.config?.weights } };
  const day = resolveDay(input); const effectiveEnd = day.end - minutes(config.bufferMinutes);
  const blocks: TimeBlock[] = []; const occupied: Interval[] = []; const planningWarnings: Array<{ code: "INVALID_WINDOW"; message: string }> = [];

  for (const event of input.fixedEvents ?? []) {
    const start = new Date(event.startAt).getTime(); const end = new Date(event.endAt).getTime();
    if (start < day.start || end > day.end || end <= start) continue;
    blocks.push(block({ id: event.id, title: event.title, type: event.type ?? "EVENT", startAt: iso(start), endAt: iso(end), flexibility: "FIXED", priority: "HIGH", lifeArea: event.lifeArea ?? "PERSONAL", locked: true })); occupied.push({ start, end });
  }

  const protectedWindows = [...(input.protectedWindows ?? [])].sort((a, b) => {
    const priority = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;
    return Number(b.flexibility === "FIXED") - Number(a.flexibility === "FIXED") || priority[b.priority ?? "MEDIUM"] - priority[a.priority ?? "MEDIUM"] || b.durationMinutes - a.durationMinutes;
  });
  for (const preference of protectedWindows) {
    const window = bounds(input.date, input.timezone, preference); const duration = minutes(preference.durationMinutes); const strict = preference.flexibility === "FIXED"; const exact = { start: window.start, end: window.start + duration };
    const start = strict ? exact.end <= day.end && !occupied.some((item) => overlaps(item, exact)) ? exact.start : null : findFirstGap(day.start, effectiveEnd, duration, occupied, window.start, Math.min(window.end, day.end));
    if (start === null) { planningWarnings.push({ code: "INVALID_WINDOW", message: `${preference.title} could not fit inside its preferred window.` }); continue; }
    const end = start + duration;
    blocks.push(block({ id: `${preference.id}-${input.date}`, title: preference.title, ...(preference.description ? { description: preference.description } : {}), type: preference.type, startAt: iso(start), endAt: iso(end), flexibility: strict ? "FIXED" : "SEMI_FLEXIBLE", priority: preference.priority ?? "MEDIUM", lifeArea: preference.lifeArea, locked: strict })); occupied.push({ start, end });
  }

  const taskWindows = input.taskWindows ?? [];
  const pending = input.tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "SKIPPED").map((task) => ({ task, remaining: task.estimatedMinutes }));
  const unscheduledTasks: Task[] = []; let focusedMinutes = 0; let previousArea: string | undefined;
  const taskStart = (task: Task, durationMinutes: number): number | null => {
    const matching = taskWindows.filter((window) => window.lifeAreas.includes(task.lifeArea));
    const windows = matching.length ? matching.map((window) => bounds(input.date, input.timezone, window)) : input.strictTaskWindows ? [] : [{ start: day.start, end: effectiveEnd }];
    const starts = windows.map((window) => findFirstGap(day.start, effectiveEnd, minutes(durationMinutes), occupied, Math.max(day.start, window.start), Math.min(effectiveEnd, window.end))).filter((value): value is number => value !== null);
    return starts.length ? Math.min(...starts) : null;
  };

  while (pending.some((item) => item.remaining > 0)) {
    const candidates = pending.flatMap((item) => {
      if (item.remaining <= 0) return [];
      const ideal = item.task.canSplit ? Math.min(item.remaining, Math.max(item.task.minimumSessionMinutes, Math.min(config.breakAfterMinutes, 90))) : item.remaining;
      let durationMinutes = ideal; let start = taskStart(item.task, durationMinutes);
      if (start === null && item.task.canSplit && ideal > item.task.minimumSessionMinutes) { durationMinutes = item.task.minimumSessionMinutes; start = taskStart(item.task, durationMinutes); }
      if (start === null) return [];
      const score = scoreTask(item.task, { planDate: input.date, minuteOfDay: localMinute(start, input.timezone), availableEnergy: energyAt(start, input), previousArea, lifeAreaImportance: input.lifeAreaImportance?.[item.task.lifeArea], config });
      return [{ item, start, durationMinutes, score }];
    }).sort((a, b) => b.score - a.score || a.start - b.start);
    const selected = candidates[0]; if (!selected) break;
    const { item, start, durationMinutes } = selected; const end = start + minutes(durationMinutes);
    blocks.push(block({ id: `${item.task.id}-${input.date}-${item.task.estimatedMinutes - item.remaining}`, title: item.task.title, ...(item.task.description ? { description: item.task.description } : {}), type: item.task.energyRequired === "DEEP_FOCUS" ? "FOCUS" : "TASK", startAt: iso(start), endAt: iso(end), flexibility: item.task.schedulingType, priority: item.task.priority, taskId: item.task.id, lifeArea: item.task.lifeArea }));
    occupied.push({ start, end }); item.remaining -= durationMinutes; focusedMinutes += durationMinutes; previousArea = item.task.lifeArea;
    if (focusedMinutes >= config.breakAfterMinutes) {
      const breakStart = findFirstGap(day.start, effectiveEnd, minutes(config.breakDurationMinutes), occupied, end, end + minutes(15));
      if (breakStart !== null) { const breakEnd = breakStart + minutes(config.breakDurationMinutes); blocks.push(block({ id: `break-${breakStart}`, title: "Reset · water, move, look away", type: "BREAK", startAt: iso(breakStart), endAt: iso(breakEnd), flexibility: "FLEXIBLE", priority: "LOW", lifeArea: "RECOVERY", description: "A scheduled recovery break before the next focused window." })); occupied.push({ start: breakStart, end: breakEnd }); focusedMinutes = 0; }
    }
  }

  for (const item of pending) if (item.remaining > 0 && !unscheduledTasks.some((task) => task.id === item.task.id)) unscheduledTasks.push({ ...item.task, estimatedMinutes: item.remaining });
  const scheduled = [...blocks].sort((a, b) => a.startAt.localeCompare(b.startAt)); const withFree: TimeBlock[] = []; let cursor = day.start;
  const appendFree = (start: number, end: number) => {
    const boundaries = new Set([start, end]);
    for (const window of input.taskWindows ?? []) { const interval = bounds(input.date, input.timezone, window); if (interval.start > start && interval.start < end) boundaries.add(interval.start); if (interval.end > start && interval.end < end) boundaries.add(interval.end); }
    const points = [...boundaries].sort((a, b) => a - b);
    for (let index = 0; index < points.length - 1; index += 1) if (points[index + 1]! - points[index]! >= minutes(20)) withFree.push(freeBlock(input, points[index]!, points[index + 1]!));
  };
  for (const item of scheduled) { const start = new Date(item.startAt).getTime(); if (start - cursor >= minutes(20)) appendFree(cursor, start); withFree.push(item); cursor = Math.max(cursor, new Date(item.endAt).getTime()); }
  if (day.end - cursor >= minutes(20)) appendFree(cursor, day.end);
  if (input.includeSleep !== false) {
    const tomorrow = new Date(`${input.date}T12:00:00.000Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); const nextDate = tomorrow.toISOString().slice(0, 10); const sleepEnd = localTimeOnDate(nextDate, input.wakeTime, input.timezone).getTime();
    withFree.push(block({ id: `sleep-${input.date}`, title: "Sleep · protected recovery", description: "The day closes here. DayOS will not schedule through your sleep window.", type: "SLEEP", startAt: iso(day.end), endAt: iso(sleepEnd), flexibility: "FIXED", priority: "CRITICAL", lifeArea: "RECOVERY", locked: true, metadata: { targetMinutes: Math.round((sleepEnd - day.end) / 60_000) } }));
  }
  const warnings = [...planningWarnings, ...(unscheduledTasks.length ? [{ code: "PARTIAL_SCHEDULE" as const, message: `${unscheduledTasks.length} activities remain in the backlog.` }] : [])];
  return { blocks: withFree, unscheduledTasks, warnings, summary: { plannedMinutes: withFree.filter((item) => item.type !== "SLEEP" && item.type !== "FREE").reduce((sum, item) => sum + durationOf(item), 0), openMinutes: withFree.filter((item) => item.type === "FREE").reduce((sum, item) => sum + durationOf(item), 0) } };
}
