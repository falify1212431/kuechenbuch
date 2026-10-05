import { addDays, daysBetween } from "@/lib/dates";

export type DateType = "mhd" | "verbrauch";
export type ExpiryLevel = "rot" | "gelb" | "gruen" | "grau";

export interface ExpiryInfo {
  level: ExpiryLevel;
  /** Tage bis zum Ablauf: 0 = heute, negativ = abgelaufen, null = kein Datum */
  daysLeft: number | null;
  /** Kurzer Text für die Liste, z. B. „in 2 Tagen“ */
  label: string;
  /** Zusätzlicher Hinweis bei Abgelaufenem, abhängig von MHD oder Verbrauchsdatum */
  hint?: string;
}

/**
 * Das Datum, das wirklich gilt. Ist etwas geöffnet, gilt die Faustregel ab dem Öffnen,
 * aber nur, wenn sie früher endet als das aufgedruckte Datum.
 */
export function effectiveDate(input: {
  date: string | null;
  openedAt: string | null;
  daysOpened: number | null;
}): string | null {
  const openedLimit =
    input.openedAt && input.daysOpened !== null ? addDays(input.openedAt, input.daysOpened) : null;
  if (!input.date) return openedLimit;
  if (!openedLimit) return input.date;
  return openedLimit < input.date ? openedLimit : input.date;
}

/**
 * Ablauf-Status laut SPEC: rot = abgelaufen oder heute, gelb = 1–3 Tage,
 * grün = länger, grau = ohne Datum.
 */
export function expiryInfo(effective: string | null, dateType: DateType, today: string): ExpiryInfo {
  if (!effective) return { level: "grau", daysLeft: null, label: "ohne Datum" };

  const daysLeft = daysBetween(today, effective);

  if (daysLeft < 0) {
    const days = -daysLeft;
    return {
      level: "rot",
      daysLeft,
      label: days === 1 ? "seit gestern abgelaufen" : `seit ${days} Tagen abgelaufen`,
      hint: dateType === "verbrauch" ? "Nicht mehr essen" : "Abgelaufen, aber meist noch gut – prüfen",
    };
  }
  if (daysLeft === 0) {
    return {
      level: "rot",
      daysLeft,
      label: "läuft heute ab",
      hint: dateType === "verbrauch" ? "Heute verbrauchen" : undefined,
    };
  }
  if (daysLeft <= 3) {
    return { level: "gelb", daysLeft, label: daysLeft === 1 ? "morgen" : `in ${daysLeft} Tagen` };
  }
  return { level: "gruen", daysLeft, label: `noch ${daysLeft} Tage` };
}

/** Für die Leiste oben: „2 heute fällig, 3 in den nächsten 3 Tagen“ */
export function countDue(levels: ExpiryInfo[]): { dueNow: number; dueSoon: number } {
  return {
    dueNow: levels.filter((info) => info.daysLeft !== null && info.daysLeft <= 0).length,
    dueSoon: levels.filter((info) => info.daysLeft !== null && info.daysLeft >= 1 && info.daysLeft <= 3).length,
  };
}
