import { addDays } from "@/lib/dates";
import { normalizeName } from "@/lib/text";

/**
 * Verwirft unplausible Daten (Lesefehler der KI): erlaubt sind höchstens 2 Jahre zurück
 * und 6 Jahre in die Zukunft.
 */
export function plausibleDate(date: string | null, today: string): string | null {
  if (!date || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return null;
  if (date < addDays(today, -730) || date > addDays(today, 2190)) return null;
  return date;
}

/** Findet unsere Kategorie zu dem Namen, den die KI geliefert hat */
export function categoryIdByName(name: string | null, categories: { id: string; name: string }[]): string | null {
  if (!name) return null;
  const wanted = normalizeName(name);
  return categories.find((category) => normalizeName(category.name) === wanted)?.id ?? null;
}

/**
 * Kassenbon-Abgleich: Welche offenen Zeilen der Einkaufsliste wurden gekauft?
 * Eine Zeile passt, wenn ihr Name im Bon-Namen steckt oder umgekehrt
 * („Milch“ auf der Liste passt zu „H-Milch 1,5 %“ auf dem Bon). Mindestens 3 Buchstaben.
 */
export function matchShoppingLines(
  boughtNames: string[],
  lines: { id: string; name: string; checked: boolean }[],
): string[] {
  const bought = boughtNames.map(normalizeName);
  return lines
    .filter((line) => {
      const name = normalizeName(line.name);
      if (line.checked || name.length < 3) return false;
      return bought.some((item) => item.length >= 3 && (item.includes(name) || name.includes(item)));
    })
    .map((line) => line.id);
}
