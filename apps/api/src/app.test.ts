import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { resetDemoStore } from "./store/demo-store.js";

const app = createApp();
beforeEach(resetDemoStore);

describe("DayOS API", () => {
  it("reports health without authentication", async () => { expect((await request(app).get("/health")).status).toBe(200); });
  it("isolates users", async () => {
    const created = await request(app).post("/api/v1/tasks").set("x-dayos-demo-user", "user-a").send({ title: "Private task", estimatedMinutes: 30, priority: "HIGH" });
    const list = await request(app).get("/api/v1/tasks").set("x-dayos-demo-user", "user-b");
    expect(created.status).toBe(201); expect(list.body.data.some((item: { title: string }) => item.title === "Private task")).toBe(false);
  });
  it("validates and completes task CRUD", async () => {
    const invalid = await request(app).post("/api/v1/tasks").send({ title: "", estimatedMinutes: 0 }); expect(invalid.status).toBe(422);
    const created = await request(app).post("/api/v1/tasks").send({ title: "New task", estimatedMinutes: 30, priority: "HIGH" });
    const completed = await request(app).post(`/api/v1/tasks/${created.body.data.id}/complete`); expect(completed.body.data.status).toBe("COMPLETED");
  });
  it("logs hydration", async () => { const before = await request(app).get("/api/v1/hydration/today"); const after = await request(app).post("/api/v1/hydration").send({ amountMl: 250 }); expect(after.body.data.totalMl - before.body.data.totalMl).toBe(250); });
  it("starts and finishes a focus session", async () => { const started = await request(app).post("/api/v1/focus-sessions").send({ plannedMinutes: 45 }); const finished = await request(app).post(`/api/v1/focus-sessions/${started.body.data.id}/finish`).send({ completionState: "COMPLETE", focusRating: 5 }); expect(finished.body.data.completionState).toBe("COMPLETE"); });
  it("rejects overlapping timeline edits", async () => { const plan = await request(app).get("/api/v1/plans/today"); const [first, second] = plan.body.data.blocks; const result = await request(app).patch(`/api/v1/time-blocks/${second.id}`).send({ startAt: first.startAt, endAt: first.endAt }); expect(result.status).toBe(409); });
});
