import { describe, expect, it } from "vitest";
import { findMergeTarget, groupForStore, type ShoppingLine } from "./list";

const line = (l: Partial<ShoppingLine> & { id: string; name: string }): ShoppingLine => ({
  quantity: 1,
  unit: "Stück",
  category_id: null,
  checked: false,
  ...l,
});

describe("findMergeTarget: Doppelte zusammenführen", () => {
  const lines = [
    line({ id: "1", name: "Zwiebeln", quantity: 2 }),
    line({ id: "2", name: "Mehl", unit: "g", quantity: 500 }),
    line({ id: "3", name: "Milch", checked: true }),
  ];

  it("findet die gleiche Zutat, auch in anderer Schreibweise", () => {
    expect(findMergeTarget(lines, { name: " zwiebeln ", unit: "Stück" })?.id).toBe("1");
  });

  it("legt bei anderer Einheit keine Zeilen zusammen", () => {
    expect(findMergeTarget(lines, { name: "Mehl", unit: "Packung" })).toBeUndefined();
  });

  it("ignoriert schon abgehakte Zeilen", () => {
    expect(findMergeTarget(lines, { name: "Milch", unit: "Stück" })).toBeUndefined();
  });
});

describe("groupForStore: Laden-Reihenfolge", () => {
  const categories = [
    { id: "obst", aisle_order: 1 },
    { id: "milch", aisle_order: 4 },
    { id: "tk", aisle_order: 12 },
  ];

  it("sortiert Gruppen nach Laden-Reihenfolge, ohne Kategorie ans Ende", () => {
    const groups = groupForStore(
      [
        line({ id: "a", name: "Pizza", category_id: "tk" }),
        line({ id: "b", name: "Kerzen" }),
        line({ id: "c", name: "Äpfel", category_id: "obst" }),
        line({ id: "d", name: "Joghurt", category_id: "milch" }),
      ],
      categories,
    );
    expect(groups.map((g) => g.categoryId)).toEqual(["obst", "milch", "tk", null]);
  });

  it("zeigt in jeder Gruppe Offenes zuerst, dann alphabetisch", () => {
    const [obst] = groupForStore(
      [
        line({ id: "1", name: "Bananen", category_id: "obst", checked: true }),
        line({ id: "2", name: "Zitronen", category_id: "obst" }),
        line({ id: "3", name: "Äpfel", category_id: "obst" }),
      ],
      categories,
    );
    expect(obst.items.map((i) => i.name)).toEqual(["Äpfel", "Zitronen", "Bananen"]);
  });
});
