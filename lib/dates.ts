// Datums-Helfer. Daten ohne Uhrzeit werden überall als Text „JJJJ-MM-TT“ gespeichert
// (so liefert sie auch die Datenbank). Gerechnet wird in UTC, damit Sommer-/Winterzeit
// keine Tage verschluckt.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Das heutige Datum nach deutscher Zeit, z. B. "2026-10-05" */
export function todayInBerlin(now: Date = new Date()): string {
  // Das Format "en-CA" liefert praktischerweise genau JJJJ-MM-TT
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtc(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

/** Zählt Tage zu einem Datum dazu (oder zieht sie ab, wenn negativ) */
export function addDays(isoDate: string, days: number): string {
  return new Date(toUtc(isoDate) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Wie viele Tage liegen zwischen zwei Daten? Positiv, wenn `to` später ist. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** "2026-10-05" → "05.10.2026" */
export function formatDateDe(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/** Samstag oder Sonntag? (für die längere Kochzeit am Wochenende) */
export function isWeekend(isoDate: string): boolean {
  const weekday = new Date(toUtc(isoDate)).getUTCDay();
  return weekday === 0 || weekday === 6;
}
