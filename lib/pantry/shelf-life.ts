import { addDays } from "@/lib/dates";
import { normalizeName } from "@/lib/text";

export interface ShelfLifeRule {
  category_id: string | null;
  location_id: string | null;
  keyword: string | null;
  days_closed: number | null;
  days_opened: number | null;
}

export interface ShelfLife {
  /** Tage haltbar ab Einkauf, wenn kein Datum aufgedruckt ist */
  daysClosed: number | null;
  /** Tage haltbar nach dem Öffnen */
  daysOpened: number | null;
}

/**
 * Wie gut passt eine Regel? -1 = passt nicht.
 * Eine Regel passt nur, wenn alles zutrifft, was in ihr steht.
 * Gewichtung: Lagerort Tiefkühler & Co. (1000) vor Schlagwort (100+) vor Kategorie (1).
 */
function score(rule: ShelfLifeRule, name: string, categoryId: string | null, locationId: string | null): number {
  let points = 0;
  if (rule.location_id) {
    if (rule.location_id !== locationId) return -1;
    points += 1000;
  }
  if (rule.keyword) {
    const keyword = normalizeName(rule.keyword);
    if (!name.includes(keyword)) return -1;
    points += 100 + keyword.length;
    // Deutsche Wörter: Das Ende bestimmt, was es ist („Apfelsaft“ ist ein Saft)
    if (name.split(" ").some((word) => word.endsWith(keyword)) || name.endsWith(keyword)) points += 50;
  }
  if (rule.category_id) {
    if (rule.category_id !== categoryId) return -1;
    points += 1;
  }
  return points;
}

/** Sucht die passendsten Faustregeln für einen Eintrag */
export function matchShelfLife(
  item: { name: string; categoryId: string | null; locationId: string | null },
  rules: ShelfLifeRule[],
): ShelfLife {
  const name = normalizeName(item.name);
  const ranked = rules
    .map((rule) => ({ rule, points: score(rule, name, item.categoryId, item.locationId) }))
    .filter((entry) => entry.points >= 0)
    .sort((a, b) => b.points - a.points)
    .map((entry) => entry.rule);

  // Die beste Regel gewinnt. Hat sie für „geöffnet“ keinen Wert, gilt die nächstbeste.
  return {
    daysClosed: ranked.find((rule) => rule.days_closed !== null)?.days_closed ?? null,
    daysOpened: ranked.find((rule) => rule.days_opened !== null)?.days_opened ?? null,
  };
}

/** Geschätztes Ablaufdatum ab heute, oder null, wenn keine Regel passt */
export function estimateDate(today: string, shelfLife: ShelfLife): string | null {
  return shelfLife.daysClosed === null ? null : addDays(today, shelfLife.daysClosed);
}
