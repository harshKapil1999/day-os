import type { Interval } from "./types.js";

export function overlaps(a: Interval, b: Interval): boolean { return a.start < b.end && b.start < a.end; }

export function findFirstGap(dayStart: number, dayEnd: number, duration: number, occupied: Interval[], earliest = dayStart, latest = dayEnd): number | null {
  const sorted = [...occupied].sort((a, b) => a.start - b.start);
  let cursor = Math.max(dayStart, earliest);
  for (const interval of sorted) {
    if (interval.end <= cursor || interval.start >= latest) continue;
    if (interval.start - cursor >= duration) return cursor;
    cursor = Math.max(cursor, interval.end);
    if (cursor + duration > latest) return null;
  }
  return cursor + duration <= Math.min(dayEnd, latest) ? cursor : null;
}

export function assertNoOverlaps(intervals: Interval[]): boolean {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  return sorted.every((item, index) => index === 0 || sorted[index - 1]!.end <= item.start);
}
