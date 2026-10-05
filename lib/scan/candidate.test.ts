import { describe, expect, it } from "vitest";
import { buildCandidate, peanutForAiItem } from "./candidate";

const basics = {
  categories: [{ id: "milch", default_location_id: "kuehl" }],
  rules: [
    { category_id: "milch", location_id: null, keyword: null, days_closed: 10, days_opened: 4 },
  ],
};

describe("buildCandidate", () => {
  it("nimmt Lagerort aus der Kategorie und schätzt das Datum nach Faustregel", () => {
    const candidate = buildCandidate(
      { key: "1", name: "Joghurt", categoryId: "milch", peanut: "frei" },
      basics,
      "2026-10-05",
    );
    expect(candidate).toMatchObject({ locationId: "kuehl", date: "2026-10-15", dateEstimated: true, dateType: "mhd" });
  });

  it("nimmt die Haltbarkeit der KI, wenn sie eine geliefert hat", () => {
    const candidate = buildCandidate(
      { key: "1", name: "Bananen", categoryId: null, shelfLifeDays: 5, peanut: null },
      basics,
      "2026-10-05",
    );
    expect(candidate.date).toBe("2026-10-10");
  });

  it("ohne passende Regel bleibt das Datum leer", () => {
    const candidate = buildCandidate({ key: "1", name: "Kerzen", categoryId: null, peanut: null }, basics, "2026-10-05");
    expect(candidate).toMatchObject({ date: null, dateEstimated: false });
  });
});

describe("peanutForAiItem", () => {
  it("Erdnuss im Namen ist immer rot", () => {
    expect(peanutForAiItem("Erdnussflips", "Snacks & Süßes")).toBe("erdnuss");
    expect(peanutForAiItem("Erdnüsse lose", "Obst")).toBe("erdnuss");
  });

  it("frisches Obst und Gemüse braucht keinen Hinweis", () => {
    expect(peanutForAiItem("Bananen", "Obst")).toBeNull();
  });

  it("verpackte Sachen, die nur die KI kennt, sind ungeprüft", () => {
    expect(peanutForAiItem("Müsli Schoko", "Nudeln, Reis & Getreide")).toBe("ungeprueft");
  });
});
