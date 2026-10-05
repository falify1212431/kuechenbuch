import { normalizeName } from "@/lib/text";

export interface ShoppingLine {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category_id: string | null;
  checked: boolean;
}

/**
 * Doppelte zusammenführen: Gibt es schon eine offene Zeile mit gleichem Namen und
 * gleicher Einheit, wird die Menge dort addiert statt eine neue Zeile anzulegen.
 */
export function findMergeTarget(
  lines: ShoppingLine[],
  candidate: { name: string; unit: string },
): ShoppingLine | undefined {
  const name = normalizeName(candidate.name);
  return lines.find((line) => !line.checked && line.unit === candidate.unit && normalizeName(line.name) === name);
}

export interface ShoppingGroup<T extends ShoppingLine> {
  categoryId: string | null;
  items: T[];
}

/**
 * Sortiert die Liste so, wie ich durch den Laden laufe: Gruppen nach Laden-Reihenfolge
 * der Kategorie, Einträge ohne Kategorie ans Ende. In jeder Gruppe Offenes zuerst, dann alphabetisch.
 */
export function groupForStore<T extends ShoppingLine>(
  lines: T[],
  categories: { id: string; aisle_order: number }[],
): ShoppingGroup<T>[] {
  const order = new Map(categories.map((category) => [category.id, category.aisle_order]));
  const groups = new Map<string | null, T[]>();
  for (const line of lines) {
    const key = line.category_id && order.has(line.category_id) ? line.category_id : null;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? Infinity : order.get(a)!) - (b === null ? Infinity : order.get(b)!))
    .map(([categoryId, items]) => ({
      categoryId,
      items: [...items].sort(
        (x, y) => Number(x.checked) - Number(y.checked) || x.name.localeCompare(y.name, "de"),
      ),
    }));
}
