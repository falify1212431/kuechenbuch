import { describe, expect, it } from "vitest";
import { categoryIdByName, matchShoppingLines, plausibleDate } from "./postprocess";
import { receiptSchema, taskFor } from "./ai-tasks";

const TODAY = "2026-10-05";

describe("plausibleDate", () => {
  it("lässt normale Daten durch", () => {
    expect(plausibleDate("2026-10-12", TODAY)).toBe("2026-10-12");
    expect(plausibleDate("2026-09-30", TODAY)).toBe("2026-09-30");
  });

  it("verwirft Lesefehler und Unsinn", () => {
    expect(plausibleDate("2062-10-12", TODAY)).toBeNull();
    expect(plausibleDate("2019-01-01", TODAY)).toBeNull();
    expect(plausibleDate("2026-13-45", TODAY)).toBeNull();
    expect(plausibleDate(null, TODAY)).toBeNull();
  });
});

describe("categoryIdByName", () => {
  const categories = [
    { id: "1", name: "Obst" },
    { id: "2", name: "Gemüse & Salat" },
  ];

  it("findet die Kategorie unabhängig von Schreibweise", () => {
    expect(categoryIdByName("gemüse & salat", categories)).toBe("2");
    expect(categoryIdByName("Gemuese & Salat", categories)).toBe("2");
  });

  it("unbekannt ergibt null", () => {
    expect(categoryIdByName("Haushalt", categories)).toBeNull();
    expect(categoryIdByName(null, categories)).toBeNull();
  });
});

describe("matchShoppingLines: Kassenbon gegen Einkaufsliste", () => {
  const lines = [
    { id: "a", name: "Milch", checked: false },
    { id: "b", name: "Zwiebeln", checked: false },
    { id: "c", name: "Brot", checked: true },
    { id: "d", name: "Ei", checked: false },
  ];

  it("erkennt passende Einträge in beide Richtungen", () => {
    expect(matchShoppingLines(["H-Milch 1,5 %", "Rote Zwiebeln"], lines)).toEqual(["a", "b"]);
  });

  it("ignoriert Abgehaktes und zu kurze Namen", () => {
    expect(matchShoppingLines(["Vollkornbrot", "Eier"], lines)).toEqual([]);
  });
});

describe("KI-Antworten werden robust gelesen", () => {
  it("repariert fehlende oder falsche Einzelwerte, statt alles zu verwerfen", () => {
    const parsed = receiptSchema.parse({
      items: [{ name: "Bananen", quantity: "6", unit: "Stk.", category: "Obst", shelf_life_days: "5" }],
    });
    expect(parsed.items[0]).toEqual({
      name: "Bananen",
      quantity: 6,
      unit: "Stück",
      category: "Obst",
      shelf_life_days: 5,
      is_food: true,
    });
  });

  it("nennt der KI die erlaubten Kategorien", () => {
    expect(taskFor("lose-ware", TODAY, ["Obst", "Gemüse & Salat"]).prompt).toContain("Obst | Gemüse & Salat");
  });
});
