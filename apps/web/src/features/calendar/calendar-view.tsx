"use client";

import { DndContext, PointerSensor, useDraggable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, GripVertical, LockKeyhole, Moon, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { TimeBlock } from "@dayos/domain";
import { useDayOS } from "@/components/providers";

const hourStart = 5;
const hourEnd = 24;
const pixelsPerMinute = .75;
const hourCount = hourEnd - hourStart;
const dateKey = (value: Date | string, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const addDays = (key: string, days: number) => new Date(new Date(`${key}T12:00:00.000Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const formatDate = (key: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(new Date(`${key}T12:00:00.000Z`));
const formatTime = (value: string, timeZone: string) => new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
const minutesOfDay = (value: string, timeZone: string) => { const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)); return Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0); };
const duration = (block: TimeBlock) => Math.max(0, Math.round((new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) / 60_000));

function DraggableBlock({ block, day = 0, timeZone }: { block: TimeBlock; day?: number; timeZone: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `calendar-${block.id}-${day}`, data: { blockId: block.id }, disabled: block.flexibility === "FIXED" });
  const minute = minutesOfDay(block.startAt, timeZone);
  const minutesFromStart = minute - hourStart * 60;
  const visibleMinutes = Math.min(duration(block), 24 * 60 - minute);
  const height = Math.max(28, visibleMinutes * pixelsPerMinute);
  return <article ref={setNodeRef} style={{ top: Math.max(0, minutesFromStart * pixelsPerMinute) + 4, height, transform: CSS.Translate.toString(transform), opacity: isDragging ? .55 : 1 }} className={`calendar-block type-${block.type.toLowerCase()} ${block.flexibility === "FIXED" ? "locked" : ""}`} {...attributes} {...listeners}><span>{block.flexibility === "FIXED" ? <LockKeyhole /> : <GripVertical />}</span><div><b>{block.title}</b><small>{formatTime(block.startAt, timeZone)}–{formatTime(block.endAt, timeZone)}</small></div></article>;
}

export function CalendarView() {
  const { profile, calendarBlocks, loadWeek, moveBlock } = useDayOS();
  const timeZone = profile?.timezone ?? "UTC";
  const [view, setView] = useState<"Day" | "Week">("Week");
  const [anchor, setAnchor] = useState(() => dateKey(new Date(), timeZone));
  const [notice, setNotice] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  useEffect(() => { void loadWeek(anchor).catch(() => setNotice("Your calendar could not be loaded.")); }, [anchor, loadWeek]);
  const days = view === "Day" ? [anchor] : Array.from({ length: 7 }, (_, index) => addDays(anchor, index));
  const visibleKeys = new Set(days);
  const summary = calendarBlocks.filter((block) => visibleKeys.has(dateKey(block.startAt, timeZone))).reduce((total, block) => {
    if (block.type === "FREE") total.open += duration(block); else if (block.type === "SLEEP") total.sleep += duration(block); else total.planned += duration(block);
    return total;
  }, { planned: 0, open: 0, sleep: 0 });
  const onDragEnd = async (event: DragEndEvent) => {
    const id = event.active.data.current?.blockId as string | undefined;
    if (!id || Math.abs(event.delta.y) < 8) return;
    const block = calendarBlocks.find((item) => item.id === id); if (!block) return;
    const deltaMinutes = Math.round(event.delta.y / pixelsPerMinute / 15) * 15;
    const startAt = new Date(new Date(block.startAt).getTime() + deltaMinutes * 60_000).toISOString();
    const endAt = new Date(new Date(block.endAt).getTime() + deltaMinutes * 60_000).toISOString();
    try { await moveBlock(id, startAt, endAt); setNotice("Activity moved and saved."); } catch { setNotice("That move overlaps another activity."); }
    window.setTimeout(() => setNotice(null), 2600);
  };
  return <main className="workspace calendar-workspace"><header className="page-heading compact"><div><span className="overline">YOUR WEEK, FULLY ACCOUNTED FOR</span><h1>Calendar</h1><p>Every commitment has a place. Open time stays visible and intentional.</p></div></header><div className="calendar-summary"><span><Sparkles />{Math.round(summary.planned / 60)}h planned</span><span>{Math.round(summary.open / 60)}h intentionally open</span><span><Moon />sleep protected</span></div><div className="calendar-toolbar"><div className="calendar-nav"><button aria-label="Previous period" onClick={() => setAnchor(addDays(anchor, view === "Day" ? -1 : -7))}><ChevronLeft /></button><button onClick={() => setAnchor(dateKey(new Date(), timeZone))}>Today</button><button aria-label="Next period" onClick={() => setAnchor(addDays(anchor, view === "Day" ? 1 : 7))}><ChevronRight /></button><h2>{formatDate(anchor, { month: "long", year: "numeric" })}</h2></div><div className="segmented"><button className={view === "Day" ? "active" : ""} onClick={() => setView("Day")}>Day</button><button className={view === "Week" ? "active" : ""} onClick={() => setView("Week")}>Week</button></div></div>{notice && <div className="calendar-notice" role="status">{notice}</div>}<DndContext id="dayos-calendar-dnd" sensors={sensors} onDragEnd={(event) => void onDragEnd(event)}><div className={`calendar-grid ${view.toLowerCase()}`}><div className="calendar-hours"><span /><div>{Array.from({ length: hourCount }, (_, index) => <time key={index}>{String(index + hourStart).padStart(2, "0")}:00</time>)}</div></div>{days.map((day, index) => <section key={day}><header className={day === dateKey(new Date(), timeZone) ? "today" : ""}><span>{formatDate(day, { weekday: "short" })}</span><b>{formatDate(day, { day: "numeric" })}</b></header><div className="calendar-column">{Array.from({ length: hourCount }, (_, row) => <i key={row} />)}{calendarBlocks.filter((item) => dateKey(item.startAt, timeZone) === day).map((block) => <DraggableBlock key={`${block.id}-${index}`} block={block} day={index} timeZone={timeZone} />)}</div></section>)}</div></DndContext><div className="calendar-legend"><span><i className="fixed" /> Protected</span><span><i className="flexible" /> Flexible</span><span><i className="window" /> Intentional open time</span><p>Drag flexible activities by 15-minute increments. DayOS checks conflicts before saving.</p></div></main>;
}
