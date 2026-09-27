import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { makeEmptyUser, makeUser, resetDemoStore, setUserData } from "./store/demo-store.js";

const app = createApp();
beforeEach(resetDemoStore);

describe("DayOS API", () => {
  it("reports health without authentication", async () => { expect((await request(app).get("/health")).status).toBe(200); });
  it("isolates users", async () => {
    const created = await request(app).post("/api/v1/tasks").set("x-dayos-demo-user", "user-a").send({ title: "Private task", estimatedMinutes: 30, priority: "HIGH" });
    const list = await request(app).get("/api/v1/tasks").set("x-dayos-demo-user", "user-b");
    expect(created.status).toBe(201); expect(list.body.data.some((item: { title: string }) => item.title === "Private task")).toBe(false);
  });
  it("persists onboarding answers and creates a personalized first day", async () => {
    const authUserId = "fresh-user";
    setUserData(authUserId, makeEmptyUser(authUserId));
    const headers = { "x-dayos-demo-user": authUserId };
    const before = await request(app).get("/api/v1/me").set(headers);
    expect(before.body.data.onboardingCompleted).toBe(false);

    const onboarded = await request(app).post("/api/v1/onboarding").set(headers).send({
      displayName: "Harsh", timezone: "Asia/Kolkata", wakeTime: "06:30", sleepTime: "22:45",
      workStartTime: "09:30", workEndTime: "18:30", dailyWaterTargetMl: 3500,
      priorities: ["Work", "Exercise", "Reading"], improvementGoals: ["Focus", "Health"],
      exercisePreference: "MORNING", variableWorkHours: true,
      planningStyle: "BALANCED",
      freeTime: { preferredUses: ["family", "meditation", "reading"], minimumOpenWindowMinutes: 60, dailyUnscheduledMinutes: 90 },
      routineWindows: [
        { id: "work", kind: "WORK", title: "Core work", start: "09:30", end: "18:30", durationMinutes: 540, days: [1,2,3,4,5], active: true, flexibility: "FIXED" },
        { id: "movement", kind: "EXERCISE", title: "Movement", start: "07:00", end: "07:45", durationMinutes: 45, days: [0,1,2,3,4,5,6], active: true, flexibility: "PREFERRED" },
        { id: "learning", kind: "LEARNING", title: "Learning", start: "20:00", end: "21:00", durationMinutes: 60, days: [1,2,3,4,5], active: true, flexibility: "PREFERRED" },
        { id: "family", kind: "FAMILY", title: "Family", start: "21:00", end: "21:45", durationMinutes: 45, days: [0,1,2,3,4,5,6], active: true, flexibility: "FIXED" }
      ],
      mealWindows: {
        breakfast: { start: "07:30", end: "08:30" }, lunch: { start: "12:30", end: "14:00" }, dinner: { start: "19:00", end: "20:30" }
      }
    });
    expect(onboarded.status).toBe(200);
    expect(onboarded.body.data).toMatchObject({ displayName: "Harsh", onboardingCompleted: true, wakeTime: "06:30", dailyWaterTargetMl: 3500 });
    expect(onboarded.body.data.preferences).toMatchObject({ priorities: ["Work", "Exercise", "Reading"], exercisePreference: "MORNING", variableWorkHours: true });

    const [tasks, habits, plan] = await Promise.all([
      request(app).get("/api/v1/tasks").set(headers), request(app).get("/api/v1/habits").set(headers), request(app).get("/api/v1/plans/today").set(headers)
    ]);
    expect(tasks.body.data.map((item: { title: string }) => item.title)).toContain("Define today’s most important work outcome");
    expect(habits.body.data.map((item: { name: string }) => item.name)).toEqual(expect.arrayContaining(["Move my body", "Read"]));
    expect(plan.status).toBe(200);
    expect(plan.body.data.blocks.map((item: { title: string }) => item.title)).toEqual(expect.arrayContaining(["Breakfast", "Movement", "Sleep · protected recovery"]));
    const week = await request(app).get(`/api/v1/plans/week?start=${plan.body.data.date}`).set(headers);
    expect(week.body.data.plans).toHaveLength(7);
    expect(week.body.data.blocks.some((item: { type: string }) => item.type === "FAMILY")).toBe(true);
  });
  it("validates and completes task CRUD", async () => {
    const invalid = await request(app).post("/api/v1/tasks").send({ title: "", estimatedMinutes: 0 }); expect(invalid.status).toBe(422);
    const created = await request(app).post("/api/v1/tasks").send({ title: "New task", estimatedMinutes: 30, priority: "HIGH" });
    const completed = await request(app).post(`/api/v1/tasks/${created.body.data.id}/complete`); expect(completed.body.data.status).toBe("COMPLETED");
  });
  it("logs hydration", async () => { const before = await request(app).get("/api/v1/hydration/today"); const after = await request(app).post("/api/v1/hydration").send({ amountMl: 250 }); expect(after.body.data.totalMl - before.body.data.totalMl).toBe(250); });
  it("starts and finishes a focus session", async () => { const started = await request(app).post("/api/v1/focus-sessions").send({ plannedMinutes: 45 }); const finished = await request(app).post(`/api/v1/focus-sessions/${started.body.data.id}/finish`).send({ completionState: "COMPLETE", focusRating: 5 }); expect(finished.body.data.completionState).toBe("COMPLETE"); });
  it("validates focus ownership and does not create duplicate active sessions", async () => {
    const id = "focus-user"; const headers = { "x-dayos-demo-user": id }; setUserData(id, makeUser(id));
    const foreign = await request(app).post("/api/v1/focus-sessions").set(headers).send({ timeBlockId: crypto.randomUUID(), plannedMinutes: 30 });
    expect(foreign.status).toBe(404);
    const plan = await request(app).get("/api/v1/plans/today").set(headers);
    const block = plan.body.data.blocks.find((item: { type: string; status: string }) => item.type === "FOCUS" && item.status !== "COMPLETED");
    const first = await request(app).post("/api/v1/focus-sessions").set(headers).send({ timeBlockId: block.id, plannedMinutes: 30 });
    const duplicate = await request(app).post("/api/v1/focus-sessions").set(headers).send({ timeBlockId: block.id, plannedMinutes: 30 });
    expect(first.status).toBe(201); expect(duplicate.body.data.id).toBe(first.body.data.id);
  });
  it("updates a daily reflection instead of duplicating it", async () => {
    const id = "reflection-user"; const headers = { "x-dayos-demo-user": id }; setUserData(id, makeUser(id));
    const first = await request(app).post("/api/v1/reflections").set(headers).send({ dayRating: 3, energyRating: 3, focusRating: 3 });
    const second = await request(app).post("/api/v1/reflections").set(headers).send({ dayRating: 5, energyRating: 4, focusRating: 4, notes: "A better day" });
    expect(first.status).toBe(201); expect(second.status).toBe(200); expect(second.body.data.id).toBe(first.body.data.id);
    const saved = await request(app).get(`/api/v1/reflections/${second.body.data.date}`).set(headers);
    expect(saved.body.data.notes).toBe("A better day");
  });
  it("rejects overlapping timeline edits", async () => { const plan = await request(app).get("/api/v1/plans/today"); const [first, second] = plan.body.data.blocks; const result = await request(app).patch(`/api/v1/time-blocks/${second.id}`).send({ startAt: first.startAt, endAt: first.endAt }); expect(result.status).toBe(409); });
  it("keeps completed history while task changes rebuild the future week", async () => {
    const id = "history-user"; const headers = { "x-dayos-demo-user": id }; setUserData(id, makeUser(id));
    const first = await request(app).get("/api/v1/plans/today").set(headers);
    const completedBlock = first.body.data.blocks.find((block: { type: string }) => block.type === "MEAL");
    expect((await request(app).post(`/api/v1/time-blocks/${completedBlock.id}/complete`).set(headers)).status).toBe(200);
    const created = await request(app).post("/api/v1/tasks").set(headers).send({ title: "Personalized learning session", lifeArea: "LEARNING", estimatedMinutes: 35, priority: "HIGH" });
    expect(created.status).toBe(201);
    const after = await request(app).get("/api/v1/plans/today").set(headers);
    expect(after.body.data.id).toBe(first.body.data.id);
    expect(after.body.data.blocks.find((block: { id: string }) => block.id === completedBlock.id)?.status).toBe("COMPLETED");
    const week = await request(app).get(`/api/v1/plans/week?start=${first.body.data.date}`).set(headers);
    expect(week.body.data.blocks.some((block: { taskId: string }) => block.taskId === created.body.data.id)).toBe(true);
    const insights = await request(app).get(`/api/v1/insights/daily/${first.body.data.date}`).set(headers);
    expect(insights.body.data.completedActivities).toBeGreaterThanOrEqual(1);
  });
  it("saves meal preferences and rebuilds their time windows", async () => {
    const id = "settings-user"; const headers = { "x-dayos-demo-user": id }; setUserData(id, makeUser(id));
    const result = await request(app).patch("/api/v1/me").set(headers).send({ mealWindows: { breakfast: { start: "06:30", end: "08:00" }, lunch: { start: "12:00", end: "13:30" }, dinner: { start: "18:30", end: "20:00" } } });
    expect(result.status).toBe(200);
    expect(result.body.data.preferences.mealWindows.breakfast.start).toBe("06:30");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const tomorrow = new Date(new Date(`${today}T12:00:00.000Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
    const week = await request(app).get(`/api/v1/plans/week?start=${tomorrow}`).set(headers);
    const breakfast = week.body.data.blocks.find((block: { title: string; startAt: string }) => block.title === "Breakfast" && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(block.startAt)) === tomorrow);
    expect(breakfast).toBeTruthy();
    expect(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }).format(new Date(breakfast.startAt)) < "08:00").toBe(true);
  });
  it("moves flexible activities into open time and recalculates availability", async () => {
    const id = "move-user"; const headers = { "x-dayos-demo-user": id }; setUserData(id, makeUser(id));
    const before = await request(app).get("/api/v1/plans/today").set(headers);
    const task = before.body.data.blocks.find((block: { taskId?: string; flexibility: string }) => block.taskId && block.flexibility !== "FIXED");
    const durationMs = new Date(task.endAt).getTime() - new Date(task.startAt).getTime();
    const free = before.body.data.blocks.find((block: { type: string; startAt: string; endAt: string }) => block.type === "FREE" && new Date(block.endAt).getTime() - new Date(block.startAt).getTime() >= durationMs && block.startAt !== task.startAt);
    expect(free).toBeTruthy();
    const startAt = free.startAt; const endAt = new Date(new Date(startAt).getTime() + durationMs).toISOString();
    const moved = await request(app).patch(`/api/v1/time-blocks/${task.id}`).set(headers).send({ startAt, endAt });
    expect(moved.status).toBe(200);
    const after = await request(app).get("/api/v1/plans/today").set(headers);
    const updated = after.body.data.blocks.find((block: { id: string }) => block.id === task.id);
    expect(updated.startAt).toBe(startAt);
    expect(after.body.data.blocks.filter((block: { type: string }) => block.type === "FREE").every((block: { startAt: string; endAt: string }) => new Date(block.startAt) >= new Date(endAt) || new Date(block.endAt) <= new Date(startAt))).toBe(true);
  });
});
