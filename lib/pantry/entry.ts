import { effectiveDate, expiryInfo, type DateType, type ExpiryInfo } from "./expiry";
import type { Unit } from "./quantity";
import { matchShelfLife, type ShelfLifeRule } from "./shelf-life";

/** Alles, was die Vorrats-Liste über einen Eintrag wissen muss */
export interface PantryEntry extends ExpiryInfo {
  id: string;
  name: string;
  brand: string | null;
  quantity: number;
  unit: Unit;
  categoryId: string | null;
  locationId: string | null;
  date: string | null;
  dateType: DateType;
  estimated: boolean;
  openedAt: string | null;
  /** Das Datum, das wirklich gilt (verkürzt, wenn geöffnet) */
  effective: string | null;
  /** Erdnuss-Hinweis aus dem Scan: erdnuss, spuren, ungeprueft oder null */
  allergenWarning: "erdnuss" | "spuren" | "ungeprueft" | null;
}

interface PantryRow {
  id: string;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  category_id: string | null;
  location_id: string | null;
  date: string | null;
  date_type: string;
  date_estimated: boolean;
  opened_at: string | null;
  allergen_warning: string | null;
}

/** Rechnet aus einer Datenbank-Zeile den Eintrag für die Anzeige */
export function toPantryEntry(row: PantryRow, rules: ShelfLifeRule[], today: string): PantryEntry {
  const shelfLife = matchShelfLife(
    { name: row.name, categoryId: row.category_id, locationId: row.location_id },
    rules,
  );
  const effective = effectiveDate({ date: row.date, openedAt: row.opened_at, daysOpened: shelfLife.daysOpened });
  const dateType = row.date_type as DateType;
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    quantity: Number(row.quantity),
    unit: row.unit as Unit,
    categoryId: row.category_id,
    locationId: row.location_id,
    date: row.date,
    dateType,
    estimated: row.date_estimated,
    openedAt: row.opened_at,
    effective,
    allergenWarning: row.allergen_warning as PantryEntry["allergenWarning"],
    ...expiryInfo(effective, dateType, today),
  };
}
