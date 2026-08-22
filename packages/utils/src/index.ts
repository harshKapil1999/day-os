import { TZDate } from "@date-fns/tz";

export function localTimeOnDate(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) throw new Error("Invalid local date or time");
  return new TZDate(year!, month! - 1, day!, hour!, minute!, timezone);
}

export function minutesBetween(start: string | Date, end: string | Date): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}

export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours}h${minutes ? ` ${minutes}m` : ""}` : `${minutes}m`;
}
