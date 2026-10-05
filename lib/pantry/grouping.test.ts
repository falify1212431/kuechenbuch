import { describe, expect, it } from "vitest";
import { groupPantry, type GroupableItem } from "./grouping";

const item = (i: Partial<GroupableItem> & { name: string }): GroupableItem => ({
  categoryId: null,
  locationId: null,
  effective: null,
  daysLeft: null,
  ...i,
});

const categories = [
  { id: "milch", name: "Milchprodukte & Eier", icon: "🥛", sort_order: 3 },
  { id: "obst", name: "Obst", icon: "🍎", sort_order: 1 },
];
const locations = [{ id: "kuehl", name: "Kühlschrank", icon: "❄️", sort_order: 1 }];

const ITEMS = [
  item({ name: "Joghurt", categoryId: "milch", locationId: "kuehl", effective: "2026-10-07", daysLeft: 2 }),
  item({ name: "Milch", categoryId: "milch", locationId: "kuehl", effective: "2026-10-05", daysLeft: 0 }),
  item({ name: "Äpfel", categoryId: "obst", effective: "2026-10-20", daysLeft: 15 }),
  item({ name: "Kerzen" }),
];

describe("groupPantry", () => {
  it("nach Kategorie: Reihenfolge der Kategorien, Bald-Ablaufendes zuerst", () => {
    const groups = groupPantry(ITEMS, "kategorie", categories, locations);
    expect(groups.map((g) => g.title)).toEqual(["Obst", "Milchprodukte & Eier", "Ohne Kategorie"]);
    expect(groups[1].items.map((i) => i.name)).toEqual(["Milch", "Joghurt"]);
  });

  it("nach Lagerort: Unbekanntes landet in „Ohne Lagerort“", () => {
    const groups = groupPantry(ITEMS, "lagerort", categories, locations);
    expect(groups.map((g) => g.title)).toEqual(["Kühlschrank", "Ohne Lagerort"]);
    expect(groups[1].items.map((i) => i.name)).toEqual(["Äpfel", "Kerzen"]);
  });

  it("nach Ablauf: Fällig, bald, später, ohne Datum – leere Gruppen fallen weg", () => {
    const groups = groupPantry(ITEMS, "ablauf", categories, locations);
    expect(groups.map((g) => g.key)).toEqual(["faellig", "bald", "spaeter", "ohne"]);
    expect(groupPantry([ITEMS[2]], "ablauf", categories, locations).map((g) => g.key)).toEqual(["spaeter"]);
  });
});
