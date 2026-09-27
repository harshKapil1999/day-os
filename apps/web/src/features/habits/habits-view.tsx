"use client";
import { BookOpen, Check, Circle, Dumbbell, Flame, MoreHorizontal, Moon, Plus, Sparkles, Sunrise } from "lucide-react";
import { useState } from "react";
import { useDayOS, type HabitRecord } from "@/components/providers";
import { GlassCard } from "@/components/glass/glass";
import { Button } from "@/components/ui/button";

const habitIcons = [Sunrise, BookOpen, Dumbbell, Moon];
export function HabitsView() {
  const { habits, toggleHabit, addHabit, updateHabit, deleteHabit } = useDayOS();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKDAYS" | "TIMES_PER_WEEK">("DAILY");
  const [target, setTarget] = useState(7);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = habits.filter((item) => item.completedToday).length;
  const longest = Math.max(0, ...habits.map((item) => item.streak));
  const openNew = () => { setEditing("new"); setName(""); setMinutes(15); setFrequency("DAILY"); setTarget(7); setError(null); };
  const openEdit = (habit: HabitRecord) => { setEditing(habit.id); setName(habit.name); setMinutes(habit.estimatedDurationMinutes); setFrequency(habit.frequencyType as typeof frequency); setTarget(habit.targetPerWeek); setMenuFor(null); setError(null); };
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true); setError(null);
    try {
      if (editing === "new") await addHabit(name.trim(), { estimatedDurationMinutes: minutes, frequencyType: frequency, targetPerWeek: frequency === "DAILY" ? 7 : frequency === "WEEKDAYS" ? 5 : target });
      else if (editing) await updateHabit(editing, { name: name.trim(), estimatedDurationMinutes: minutes, frequencyType: frequency, targetPerWeek: frequency === "DAILY" ? 7 : frequency === "WEEKDAYS" ? 5 : target });
      setEditing(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The habit could not be saved."); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => { setBusy(true); setError(null); try { await deleteHabit(id); setMenuFor(null); setConfirmDelete(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "The habit could not be deleted."); } finally { setBusy(false); } };
  const toggle = async (id: string) => { setError(null); try { await toggleHabit(id); } catch (reason) { setError(reason instanceof Error ? reason.message : "The habit could not be updated."); } };
  return <main className="workspace habits-workspace"><header className="page-heading compact"><div><span className="overline">SMALL RHYTHMS</span><h1>Habits</h1><p>Consistency without pressure.</p></div><Button onClick={openNew}><Plus /> New habit</Button></header>
    {error && !editing && <p className="form-error" role="alert">{error}</p>}
    {editing && <GlassCard className="habit-composer"><div className="habit-fields"><label>{editing === "new" ? "New rhythm" : "Edit rhythm"}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save(); }} placeholder="e.g. Morning walk" /></label><label>Minutes<input aria-label="Habit minutes" type="number" min={1} max={240} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label><label>Frequency<select aria-label="Habit frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)}><option value="DAILY">Daily</option><option value="WEEKDAYS">Weekdays</option><option value="TIMES_PER_WEEK">Times per week</option></select></label>{frequency === "TIMES_PER_WEEK" && <label>Weekly target<input aria-label="Weekly target" type="number" min={1} max={7} value={target} onChange={(event) => setTarget(Number(event.target.value))} /></label>}</div><div><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy || !name.trim() || minutes < 1 || target < 1 || target > 7} onClick={() => void save()}>{editing === "new" ? "Save habit" : "Save changes"}</Button></div>{error && <p className="form-error" role="alert">{error}</p>}</GlassCard>}
    <GlassCard className="habit-progress"><div className="habit-ring" style={{ "--progress": `${habits.length ? complete / habits.length * 360 : 0}deg` } as React.CSSProperties}><span><b>{complete}</b>/{habits.length}</span></div><div><span className="overline">TODAY’S RHYTHM</span><h2>{habits.length === 0 ? "Choose one rhythm to begin." : complete === habits.length ? "Everything is complete." : `${habits.length - complete} gentle nudges remain.`}</h2><p>Your habits support the day. They don’t define its worth.</p></div><div className="streak"><Flame /><div><b>{longest} days</b><small>best rhythm</small></div></div></GlassCard>
    <section className="habit-grid">{habits.map((habit, index) => { const Icon = habitIcons[index % habitIcons.length]!; return <article key={habit.id}><GlassCard className={habit.completedToday ? "habit-card completed" : "habit-card"}><header><div className="habit-icon"><Icon /></div><div className="task-menu-wrap"><button aria-label={`More options for ${habit.name}`} onClick={() => { setMenuFor(menuFor === habit.id ? null : habit.id); setConfirmDelete(null); }}><MoreHorizontal /></button>{menuFor === habit.id && <div className="item-menu">{confirmDelete === habit.id ? <><span>Delete this habit?</span><button disabled={busy} onClick={() => void remove(habit.id)}>Confirm delete</button><button onClick={() => setConfirmDelete(null)}>Cancel</button></> : <><button onClick={() => openEdit(habit)}>Edit habit</button><button onClick={() => setConfirmDelete(habit.id)}>Delete habit</button></>}</div>}</div></header><span className="overline">{habit.lifeArea}</span><h2>{habit.name}</h2><p>{habit.estimatedDurationMinutes} min · {habit.targetPerWeek === 7 ? "every day" : `${habit.targetPerWeek}× per week`}</p><div className="week-dots">{["M", "T", "W", "T", "F", "S", "S"].map((day, i) => <span className={i < Math.min(habit.streak, 7) ? "done" : ""} key={`${day}${i}`}>{day}</span>)}</div><button className="habit-complete" onClick={() => void toggle(habit.id)}>{habit.completedToday ? <><Check /> Complete</> : <><Circle /> Mark complete</>}</button><footer><Flame /><b>{habit.streak}-day streak</b><span>{habit.frequencyType.replaceAll("_", " ").toLowerCase()}</span></footer></GlassCard></article>; })}<GlassCard className="habit-add"><button onClick={openNew}><Plus /><b>Add a new rhythm</b><span>Build consistency around something meaningful.</span></button></GlassCard></section>
    {habits.length > 0 && <GlassCard className="habit-note"><Sparkles /><div><b>Progress, not perfection.</b><p>Your completion history is saved and used to tune future plans.</p></div></GlassCard>}
  </main>;
}
