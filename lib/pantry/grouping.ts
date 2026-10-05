export const PANTRY_VIEWS = ["kategorie", "lagerort", "ablauf"] as const;
export type PantryView = (typeof PANTRY_VIEWS)[number];

export interface GroupableItem {
  name: string;
  categoryId: string | null;
  locationId: string | null;
  /** Das Datum, das wirklich gilt (siehe effectiveDate) */
  effective: string | null;
  /** Tage bis zum Ablauf, null = ohne Datum */
  daysLeft: number | null;
}

interface NamedGroup {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface PantryGroup<T> {
  key: string;
  title: string;
  icon: string | null;
  items: T[];
}

// „Nichts wegwerfen“: Bald Ablaufendes zuerst, ohne Datum ans Ende
function bySoonest(a: GroupableItem, b: GroupableItem): number {
  if (a.effective !== b.effective) {
    if (a.effective === null) return 1;
    if (b.effective === null) return -1;
    return a.effective < b.effective ? -1 : 1;
  }
  return a.name.localeCompare(b.name, "de");
}

/** Teilt den Vorrat in Gruppen für die gewählte Ansicht */
export function groupPantry<T extends GroupableItem>(
  items: T[],
  view: PantryView,
  categories: NamedGroup[],
  locations: NamedGroup[],
): PantryGroup<T>[] {
  if (view === "ablauf") {
    const buckets: { key: string; title: string; test: (d: number | null) => boolean }[] = [
      { key: "faellig", title: "Heute fällig oder abgelaufen", test: (d) => d !== null && d <= 0 },
      { key: "bald", title: "In den nächsten 3 Tagen", test: (d) => d !== null && d >= 1 && d <= 3 },
      { key: "spaeter", title: "Später", test: (d) => d !== null && d > 3 },
      { key: "ohne", title: "Ohne Datum", test: (d) => d === null },
    ];
    return buckets
      .map((bucket) => ({
        key: bucket.key,
        title: bucket.title,
        icon: null,
        items: items.filter((item) => bucket.test(item.daysLeft)).sort(bySoonest),
      }))
      .filter((group) => group.items.length > 0);
  }

  const known = view === "kategorie" ? categories : locations;
  const groupOf = (item: T) => (view === "kategorie" ? item.categoryId : item.locationId);
  const knownIds = new Set(known.map((entry) => entry.id));

  const groups: PantryGroup<T>[] = [...known]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((entry) => ({
      key: entry.id,
      title: entry.name,
      icon: entry.icon,
      items: items.filter((item) => groupOf(item) === entry.id).sort(bySoonest),
    }));

  groups.push({
    key: "ohne",
    title: view === "kategorie" ? "Ohne Kategorie" : "Ohne Lagerort",
    icon: null,
    items: items.filter((item) => !knownIds.has(groupOf(item) ?? "")).sort(bySoonest),
  });

  return groups.filter((group) => group.items.length > 0);
}
