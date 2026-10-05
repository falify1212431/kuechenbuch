import { describe, expect, it } from "vitest";
import { estimateDate, matchShelfLife, type ShelfLifeRule } from "./shelf-life";

// Ein Ausschnitt der Startwerte aus der Datenbank
const MILCH = "kat-milch";
const FLEISCH = "kat-fleisch";
const GETRAENKE = "kat-getraenke";
const KUEHL = "ort-kuehl";
const TK = "ort-tk";

const rule = (r: Partial<ShelfLifeRule>): ShelfLifeRule => ({
  category_id: null,
  location_id: null,
  keyword: null,
  days_closed: null,
  days_opened: null,
  ...r,
});

const RULES: ShelfLifeRule[] = [
  rule({ category_id: MILCH, days_closed: 10, days_opened: 4 }),
  rule({ category_id: FLEISCH, days_closed: 2, days_opened: 1 }),
  rule({ category_id: GETRAENKE, days_closed: 180, days_opened: 4 }),
  rule({ location_id: TK, days_closed: 90 }),
  rule({ keyword: "milch", days_closed: 7, days_opened: 3 }),
  rule({ keyword: "h-milch", days_closed: 90, days_opened: 3 }),
  rule({ keyword: "buttermilch", days_closed: 10, days_opened: 3 }),
  rule({ keyword: "hack", days_closed: 1 }),
  rule({ keyword: "hähnchen", days_closed: 2 }),
  rule({ keyword: "apfel", days_closed: 21 }),
  rule({ keyword: "saft", days_closed: 180, days_opened: 4 }),
];

describe("matchShelfLife", () => {
  it("nimmt die Kategorie, wenn kein Schlagwort passt", () => {
    expect(matchShelfLife({ name: "Joghurt", categoryId: MILCH, locationId: KUEHL }, RULES)).toEqual({
      daysClosed: 10,
      daysOpened: 4,
    });
  });

  it("Schlagwort ist genauer als Kategorie", () => {
    expect(matchShelfLife({ name: "Vollmilch", categoryId: MILCH, locationId: KUEHL }, RULES).daysClosed).toBe(7);
  });

  it("das längere, genauere Schlagwort gewinnt", () => {
    expect(matchShelfLife({ name: "H-Milch 1,5%", categoryId: MILCH, locationId: KUEHL }, RULES).daysClosed).toBe(90);
    expect(matchShelfLife({ name: "Buttermilch", categoryId: MILCH, locationId: KUEHL }, RULES).daysClosed).toBe(10);
  });

  it("bei zusammengesetzten Wörtern zählt das Ende: Apfelsaft ist ein Saft", () => {
    expect(matchShelfLife({ name: "Apfelsaft", categoryId: GETRAENKE, locationId: null }, RULES).daysClosed).toBe(180);
  });

  it("findet Schlagwörter auch ohne Umlaute und in anderer Schreibweise", () => {
    expect(matchShelfLife({ name: "HAEHNCHENBRUST", categoryId: null, locationId: null }, RULES).daysClosed).toBe(2);
  });

  it("im Tiefkühler hält alles lange, auch Hack", () => {
    expect(matchShelfLife({ name: "Rinderhack", categoryId: FLEISCH, locationId: TK }, RULES).daysClosed).toBe(90);
    expect(matchShelfLife({ name: "Rinderhack", categoryId: FLEISCH, locationId: KUEHL }, RULES).daysClosed).toBe(1);
  });

  it("nimmt für „geöffnet“ die nächstbeste Regel, wenn die beste keinen Wert hat", () => {
    // Hack-Regel kennt keinen Öffnungs-Wert, also gilt der der Kategorie
    expect(matchShelfLife({ name: "Hackfleisch", categoryId: FLEISCH, locationId: KUEHL }, RULES)).toEqual({
      daysClosed: 1,
      daysOpened: 1,
    });
  });

  it("liefert nichts, wenn keine Regel passt", () => {
    expect(matchShelfLife({ name: "Kerzen", categoryId: null, locationId: null }, RULES)).toEqual({
      daysClosed: null,
      daysOpened: null,
    });
  });
});

describe("estimateDate", () => {
  it("rechnet ab heute", () => {
    expect(estimateDate("2026-10-05", { daysClosed: 7, daysOpened: 3 })).toBe("2026-10-12");
    expect(estimateDate("2026-10-05", { daysClosed: null, daysOpened: null })).toBeNull();
  });
});
