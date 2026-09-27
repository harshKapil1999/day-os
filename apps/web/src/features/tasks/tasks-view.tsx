"use client";

import { CalendarPlus, Check, Circle, Clock3, MoreHorizontal, Plus, Search, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import type { Task } from "@dayos/domain";
import { useDayOS } from "@/components/providers";
import { GlassCard } from "@/components/glass/glass";
import { Button } from "@/components/ui/button";

const tabs = ["Today", "Upcoming", "Backlog", "All", "Completed"] as const;
type Draft = { title: string; description: string; lifeArea: Task["lifeArea"]; estimatedMinutes: number; priority: Task["priority"]; energyRequired: Task["energyRequired"]; deadline: string };
const emptyDraft: Draft = { title: "", description: "", lifeArea: "WORK", estimatedMinutes: 30, priority: "MEDIUM", energyRequired: "MEDIUM", deadline: "" };
const priorities = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export function TasksView() {
  const { profile, tasks, blocks, calendarBlocks, addTask, updateTask, deleteTask, completeTask, buildPlan } = useDayOS();
  const [tab, setTab] = useState<typeof tabs[number]>("Today");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"priority" | "duration">("priority");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localDate = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: profile?.timezone ?? "UTC" }).format(new Date(value));
  const today = localDate(new Date());
  const todayIds = new Set(blocks.filter((block) => block.taskId && localDate(block.startAt) === today).map((block) => block.taskId));
  const futureIds = new Set(calendarBlocks.filter((block) => block.taskId && localDate(block.startAt) > today).map((block) => block.taskId));
  const filtered = tasks.filter((item) => {
    if (!item.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (tab === "Completed") return item.status === "COMPLETED";
    if (item.status === "COMPLETED" || item.status === "SKIPPED") return false;
    if (tab === "All") return true;
    if (tab === "Today") return todayIds.has(item.id);
    if (tab === "Upcoming") return futureIds.has(item.id) || Boolean(item.deadline && localDate(item.deadline) > today);
    return !todayIds.has(item.id) && !futureIds.has(item.id);
  }).sort((a, b) => sort === "duration" ? b.estimatedMinutes - a.estimatedMinutes : priorities[b.priority] - priorities[a.priority]);

  const openNew = () => { setDraft(emptyDraft); setEditing("new"); setError(null); };
  const openEdit = (task: Task) => {
    setDraft({ title: task.title, description: task.description ?? "", lifeArea: task.lifeArea, estimatedMinutes: task.estimatedMinutes, priority: task.priority, energyRequired: task.energyRequired, deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "" });
    setEditing(task.id); setMenuFor(null); setError(null);
  };
  const save = async () => {
    if (!draft.title.trim() || draft.estimatedMinutes < 5) return;
    setBusy(true); setError(null);
    try {
      const input = { title: draft.title.trim(), description: draft.description.trim(), lifeArea: draft.lifeArea, estimatedMinutes: draft.estimatedMinutes, priority: draft.priority, energyRequired: draft.energyRequired, ...(draft.deadline ? { deadline: new Date(draft.deadline).toISOString() } : {}) };
      if (editing === "new") await addTask(input); else if (editing) await updateTask(editing, input);
      setTab("All");
      setEditing(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The task could not be saved."); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => { setBusy(true); setError(null); try { await deleteTask(id); setMenuFor(null); setConfirmDelete(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "The task could not be deleted."); } finally { setBusy(false); } };
  const replan = async () => { setBusy(true); setError(null); try { await buildPlan(); } catch (reason) { setError(reason instanceof Error ? reason.message : "The plan could not be rebuilt."); } finally { setBusy(false); } };
  const complete = async (id: string) => { setError(null); try { await completeTask(id); } catch (reason) { setError(reason instanceof Error ? reason.message : "The task could not be updated."); } };

  return <main className="workspace list-workspace">
    <header className="page-heading compact"><div><span className="overline">YOUR COMMITMENTS</span><h1>Tasks</h1><p>Make time for the work that matters.</p></div><div className="heading-actions"><Button variant="secondary" disabled={busy} onClick={() => void replan()}><CalendarPlus /> Rebuild plan</Button><Button onClick={openNew}><Plus /> New task</Button></div></header>
    {error && !editing && <p className="form-error" role="alert">{error}</p>}
    <div className="list-toolbar"><div className="tabs">{tabs.map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><div className="list-tools"><label><Search /><input aria-label="Search tasks" placeholder="Search tasks" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button onClick={() => setSort(sort === "priority" ? "duration" : "priority")}>{sort === "priority" ? "Priority" : "Duration"}</button></div></div>
    <section className="task-list"><div className="task-summary"><div><span className="summary-icon"><Clock3 /></span><div><b>{filtered.length} activities</b><p>{Math.round(filtered.reduce((sum, item) => sum + item.estimatedMinutes, 0) / 6) / 10} hours of intention</p></div></div></div>
      {filtered.map((task) => <article key={task.id}><button aria-label={`${task.status === "COMPLETED" ? "Reopen" : "Complete"} ${task.title}`} className={task.status === "COMPLETED" ? "task-check done" : "task-check"} onClick={() => void complete(task.id)}>{task.status === "COMPLETED" ? <Check /> : <Circle />}</button><div className="task-main"><h3>{task.title}</h3><div><span className={`area-dot ${task.lifeArea.toLowerCase()}`} />{task.lifeArea.toLowerCase()}<span>·</span><Clock3 />{task.estimatedMinutes} min<span>·</span><Zap />{task.energyRequired.replace("_", " ").toLowerCase()}</div></div><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span><Button variant="ghost" size="sm" disabled={busy} onClick={() => void replan()}><CalendarPlus /> Replan</Button><div className="task-menu-wrap"><button className="more" aria-label={`More options for ${task.title}`} onClick={() => { setMenuFor(menuFor === task.id ? null : task.id); setConfirmDelete(null); }}><MoreHorizontal /></button>{menuFor === task.id && <div className="item-menu">{confirmDelete === task.id ? <><span>Delete this task?</span><button disabled={busy} onClick={() => void remove(task.id)}><Trash2 /> Confirm delete</button><button onClick={() => setConfirmDelete(null)}>Cancel</button></> : <><button onClick={() => openEdit(task)}>Edit task</button><button onClick={() => setConfirmDelete(task.id)}>Delete task</button></>}</div>}</div></article>)}
      {!filtered.length && <GlassCard className="empty-state"><h2>{tab === "Today" ? "No tasks scheduled today." : "No tasks here yet."}</h2><p>{tab === "Today" ? "Add a task or adjust your weekly rhythm to make room." : "Add something worth making time for."}</p><Button onClick={openNew}><Plus /> Add a task</Button></GlassCard>}
    </section>
    {editing && <div className="inline-composer glass glass-depth-3" role="dialog" aria-label={editing === "new" ? "New task" : "Edit task"}><div><span className="overline">{editing === "new" ? "NEW TASK" : "EDIT TASK"}</span><h2>What deserves time?</h2></div><input autoFocus aria-label="Task title" placeholder="Name this task" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void save(); }} /><label className="composer-field">Details<input aria-label="Task details" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Optional context" /></label><div className="composer-grid"><label>Minutes<input type="number" min={5} max={720} aria-label="Estimated minutes" value={draft.estimatedMinutes} onChange={(event) => setDraft({ ...draft, estimatedMinutes: Number(event.target.value) })} /></label><label>Area<select aria-label="Life area" value={draft.lifeArea} onChange={(event) => setDraft({ ...draft, lifeArea: event.target.value as Task["lifeArea"] })}>{["WORK", "LEARNING", "HEALTH", "PERSONAL", "RECOVERY"].map((value) => <option value={value} key={value}>{value.toLowerCase()}</option>)}</select></label><label>Energy<select aria-label="Energy required" value={draft.energyRequired} onChange={(event) => setDraft({ ...draft, energyRequired: event.target.value as Task["energyRequired"] })}>{["LOW", "MEDIUM", "HIGH", "DEEP_FOCUS"].map((value) => <option value={value} key={value}>{value.replace("_", " ").toLowerCase()}</option>)}</select></label><label>Priority<select aria-label="Priority" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Task["priority"] })}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => <option value={value} key={value}>{value.toLowerCase()}</option>)}</select></label></div><label className="composer-field">Deadline, if any<input type="datetime-local" aria-label="Task deadline" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy || !draft.title.trim() || draft.estimatedMinutes < 5} onClick={() => void save()}>{busy ? "Saving…" : editing === "new" ? "Add task" : "Save task"}</Button></div></div>}
  </main>;
}
