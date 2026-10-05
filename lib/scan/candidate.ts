import { checkPeanut, mentionsPeanut, type PeanutStatus } from "@/lib/allergens/peanut";
import { addDays } from "@/lib/dates";
import type { DateType } from "@/lib/pantry/expiry";
import type { Unit } from "@/lib/pantry/quantity";
import { estimateDate, matchShelfLife, type ShelfLifeRule } from "@/lib/pantry/shelf-life";

/** Ein erkannter Eintrag, den ich vor dem Speichern sehe und korrigieren kann */
export interface ScanCandidate {
  key: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: Unit;
  categoryId: string | null;
  locationId: string | null;
  date: string | null;
  dateType: DateType;
  dateEstimated: boolean;
  /** null = keine Warnung nötig (z. B. loses Obst ohne Erdnuss-Bezug) */
  peanut: PeanutStatus | null;
  /** Nährwerte pro 100 g/ml, falls aus der Datenbank bekannt */
  nutriments: Record<string, number | null> | null;
  imageUrl: string | null;
}

interface Basics {
  categories: { id: string; default_location_id: string | null }[];
  rules: ShelfLifeRule[];
}

/**
 * Baut aus einem Treffer einen fertigen Vorschlag: Lagerort aus der Kategorie,
 * Datum geschätzt (aus der Haltbarkeit der KI oder nach Faustregel).
 */
export function buildCandidate(
  input: {
    key: string;
    barcode?: string | null;
    name: string;
    brand?: string | null;
    quantity?: number | null;
    unit?: Unit | null;
    categoryId: string | null;
    shelfLifeDays?: number | null;
    peanut: PeanutStatus | null;
    nutriments?: Record<string, number | null> | null;
    imageUrl?: string | null;
  },
  basics: Basics,
  today: string,
): ScanCandidate {
  const locationId = basics.categories.find((c) => c.id === input.categoryId)?.default_location_id ?? null;
  const date =
    input.shelfLifeDays !== undefined && input.shelfLifeDays !== null
      ? addDays(today, input.shelfLifeDays)
      : estimateDate(today, matchShelfLife({ name: input.name, categoryId: input.categoryId, locationId }, basics.rules));

  return {
    key: input.key,
    barcode: input.barcode ?? null,
    name: input.name,
    brand: input.brand ?? null,
    quantity: input.quantity ?? 1,
    unit: input.unit ?? (input.quantity ? "Stück" : "Packung"),
    categoryId: input.categoryId,
    locationId,
    date,
    dateType: "mhd",
    dateEstimated: date !== null,
    peanut: input.peanut,
    nutriments: input.nutriments ?? null,
    imageUrl: input.imageUrl ?? null,
  };
}

/**
 * Erdnuss-Status für Dinge, die nur die KI erkannt hat:
 * Erdnuss im Namen → rot. Frisches Obst und Gemüse → keine Warnung.
 * Alles andere → „Allergene nicht geprüft – Packung lesen“.
 */
export function peanutForAiItem(name: string, categoryName: string | null): PeanutStatus | null {
  if (mentionsPeanut(name)) return "erdnuss";
  if (categoryName === "Obst" || categoryName === "Gemüse & Salat") return null;
  return checkPeanut({ name, source: "ki" });
}
