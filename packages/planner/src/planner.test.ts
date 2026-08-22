import { describe, expect, it } from "vitest";
import type { Task, TimeBlock } from "@dayos/domain";
import { assertNoOverlaps, generateDayPlan, rebalanceRemainingDay } from "./index.js";

const task = (overrides: Partial<Task> = {}): Task => ({ id: crypto.randomUUID(), title: "Build DayOS", lifeArea: "WORK", status: "BACKLOG", priority: "HIGH", estimatedMinutes: 60, actualMinutes: 0, energyRequired: "HIGH", schedulingType: "FLEXIBLE", canSplit: true, minimumSessionMinutes: 25, ...overrides });
const base = { date: "2026-08-20", timezone: "Asia/Kolkata", wakeTime: "07:00", sleepTime: "23:00" };

describe("generateDayPlan", () => {
  it("creates no overlaps and respects wake/sleep boundaries", () => {
    const result = generateDayPlan({ ...base, tasks: [task(), task()] });
    expect(assertNoOverlaps(result.blocks.map((item) => ({ start: +new Date(item.startAt), end: +new Date(item.endAt) })))).toBe(true);
    expect(result.blocks[0]!.startAt).toBe("2026-08-20T01:30:00.000Z");
    expect(result.blocks.at(-1)!.endAt).toBe("2026-08-20T17:30:00.000Z");
  });
  it("preserves fixed events", () => {
    const startAt = "2026-08-20T06:30:00.000Z"; const endAt = "2026-08-20T07:30:00.000Z";
    const result = generateDayPlan({ ...base, tasks: [task({ estimatedMinutes: 300 })], fixedEvents: [{ id: "meeting", title: "Client review", startAt, endAt }] });
    expect(result.blocks.find((item) => item.id === "meeting")).toMatchObject({ startAt, endAt, locked: true });
  });
  it("prioritizes urgent and critical tasks", () => {
    const result = generateDayPlan({ ...base, tasks: [task({ id: "low", title: "Low", priority: "LOW" }), task({ id: "critical", title: "Critical", priority: "CRITICAL", deadline: "2026-08-20T18:00:00.000Z" })] });
    expect(result.blocks.find((item) => item.taskId)?.taskId).toBe("critical");
  });
  it("respects meal and exercise windows", () => {
    const result = generateDayPlan({ ...base, tasks: [task()], protectedWindows: [
      { id: "lunch", title: "Lunch", type: "MEAL", windowStart: "13:00", windowEnd: "14:30", durationMinutes: 45, lifeArea: "RECOVERY" },
      { id: "gym", title: "Gym", type: "EXERCISE", windowStart: "17:00", windowEnd: "19:30", durationMinutes: 60, lifeArea: "HEALTH" }
    ] });
    expect(result.blocks.find((item) => item.id === "lunch")?.startAt).toBe("2026-08-20T07:30:00.000Z");
    expect(result.blocks.find((item) => item.id === "gym")?.startAt).toBe("2026-08-20T11:30:00.000Z");
  });
  it("splits allowed tasks and honors minimum duration", () => {
    const result = generateDayPlan({ ...base, tasks: [task({ id: "large", estimatedMinutes: 180, minimumSessionMinutes: 30 })] });
    const parts = result.blocks.filter((item) => item.taskId === "large");
    expect(parts.length).toBe(2);
    expect(parts.every((item) => (+new Date(item.endAt) - +new Date(item.startAt)) >= 30 * 60_000)).toBe(true);
  });
  it("does not split an unsplittable task and returns impossible work", () => {
    const result = generateDayPlan({ ...base, wakeTime: "09:00", sleepTime: "10:00", tasks: [task({ id: "huge", estimatedMinutes: 120, canSplit: false })], config: { bufferMinutes: 30 } });
    expect(result.blocks.some((item) => item.taskId === "huge")).toBe(false);
    expect(result.unscheduledTasks.map((item) => item.id)).toContain("huge");
  });
  it("inserts breaks and preserves buffer/free time", () => {
    const result = generateDayPlan({ ...base, tasks: [task({ estimatedMinutes: 240 })], config: { breakAfterMinutes: 90, breakDurationMinutes: 15, bufferMinutes: 45 } });
    expect(result.blocks.some((item) => item.type === "BREAK")).toBe(true);
    expect(result.blocks.some((item) => item.type === "FREE")).toBe(true);
  });
});

describe("rebalanceRemainingDay", () => {
  const blocks: TimeBlock[] = [
    { id: "past", title: "Done", type: "TASK", startAt: "2026-08-20T05:00:00Z", endAt: "2026-08-20T06:00:00Z", status: "COMPLETED", flexibility: "FLEXIBLE", priority: "MEDIUM", lifeArea: "WORK" },
    { id: "current", title: "Overrun", type: "FOCUS", startAt: "2026-08-20T06:00:00Z", endAt: "2026-08-20T07:30:00Z", status: "ACTIVE", flexibility: "FLEXIBLE", priority: "HIGH", lifeArea: "WORK" },
    { id: "fixed", title: "Lunch", type: "MEAL", startAt: "2026-08-20T08:00:00Z", endAt: "2026-08-20T08:45:00Z", status: "PLANNED", flexibility: "FIXED", priority: "MEDIUM", lifeArea: "RECOVERY", locked: true },
    { id: "future", title: "Learn", type: "LEARNING", startAt: "2026-08-20T07:00:00Z", endAt: "2026-08-20T08:00:00Z", status: "PLANNED", flexibility: "FLEXIBLE", priority: "MEDIUM", lifeArea: "LEARNING" }
  ];
  it("rebalances after an overrun without moving completed, past, or fixed blocks", () => {
    const result = rebalanceRemainingDay({ now: "2026-08-20T06:30:00Z", currentPlan: blocks, changedBlock: blocks[1], reason: "TASK_OVERRAN", dayEnd: "2026-08-20T12:00:00Z" });
    expect(result.blocks.find((item) => item.id === "past")?.startAt).toBe(blocks[0]!.startAt);
    expect(result.blocks.find((item) => item.id === "fixed")?.startAt).toBe(blocks[2]!.startAt);
    expect(result.blocks.find((item) => item.id === "future")?.startAt).toBe("2026-08-20T08:45:00.000Z");
  });
  it("uses gained time after early completion", () => {
    const early = { ...blocks[1]!, endAt: "2026-08-20T06:40:00Z" };
    const result = rebalanceRemainingDay({ now: "2026-08-20T06:40:00Z", currentPlan: blocks, changedBlock: early, reason: "TASK_FINISHED_EARLY", dayEnd: "2026-08-20T12:00:00Z" });
    expect(result.blocks.find((item) => item.id === "future")?.startAt).toBe("2026-08-20T06:40:00.000Z");
  });
});
