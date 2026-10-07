// Wochen-Helfer für den Essensplan. Eine Woche geht von Montag bis Sonntag.

import { addDays } from "@/lib/dates";

export const SLOTS = ["mittag", "abend"] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABELS: Record<Slot, string> = { mittag: "Mittag", abend: "Abend" };

const SHORT_DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** Der Montag der Woche, in der das Datum liegt */
export function weekStart(isoDate: string): string {
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = Sonntag
  return addDays(isoDate, weekday === 0 ? -6 : 1 - weekday);
}

/** Die 7 Tage ab einem Montag */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Woche aus der Adresse (?woche=2026-10-12) – ungültig oder fehlend → aktuelle Woche */
export function parseWeekParam(value: unknown, today: string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) {
    return weekStart(value);
  }
  return weekStart(today);
}

/** Kalenderwoche nach ISO 8601 (die Woche mit dem ersten Donnerstag ist KW 1) */
export function isoWeekNumber(isoDate: string): number {
  const thursday = addDays(weekStart(isoDate), 3);
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  const dayOfYear = Math.round((Date.parse(`${thursday}T00:00:00Z`) - Date.parse(`${jan1}T00:00:00Z`)) / 86_400_000);
  return Math.floor(dayOfYear / 7) + 1;
}

/** „Mi 08.10.“ */
export function formatDayShort(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${SHORT_DAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()]} ${day}.${month}.`;
}

/** Aktuelle Stunde in Deutschland (0–23) */
export function hourInBerlin(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(now));
}

/** Plätze, die geplant werden sollen: ab heute, nur eingestellte Mahlzeiten */
export function openSlots(
  dates: string[],
  slots: Slot[],
  taken: { date: string; slot: string }[],
  today: string,
): { date: string; slot: Slot }[] {
  const takenKeys = new Set(taken.map((entry) => `${entry.date}|${entry.slot}`));
  return dates
    .filter((date) => date >= today)
    .flatMap((date) => slots.map((slot) => ({ date, slot })))
    .filter((place) => !takenKeys.has(`${place.date}|${place.slot}`));
}
