import { describe, expect, it } from "vitest";
import type { RecipeIngredient } from "@/lib/cooking/ingredients";
import { planMove, type PlanEntry } from "./move";
import { planShoppingList } from "./shopping";
import { isFreezer, thawReminders } from "./thaw";
import { formatDayShort, hourInBerlin, isoWeekNumber, openSlots, parseWeekParam, weekDates, weekStart } from "./week";

const ing = (name: string, amount: number | null, unit: RecipeIngredient["unit"], extra: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  name,
  amount,
  unit,
  pantryItemId: null,
  staple: false,
  ...extra,
});

describe("Woche", () => {
  it("findet den Montag, auch vom Sonntag aus", () => {
    expect(weekStart("2026-10-07")).toBe("2026-10-05"); // Mittwoch
    expect(weekStart("2026-10-05")).toBe("2026-10-05"); // Montag
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sonntag
    expect(weekStart("2027-01-01")).toBe("2026-12-28"); // über den Jahreswechsel
  });

  it("liefert 7 Tage und deutsche Kurznamen", () => {
    const days = weekDates("2026-10-05");
    expect(days).toHaveLength(7);
    expect(days[6]).toBe("2026-10-11");
    expect(formatDayShort("2026-10-08")).toBe("Do 08.10.");
  });

  it("liest die Woche aus der Adresse, sonst die aktuelle", () => {
    expect(parseWeekParam("2026-10-14", "2026-10-07")).toBe("2026-10-12");
    expect(parseWeekParam("quatsch", "2026-10-07")).toBe("2026-10-05");
    expect(parseWeekParam(undefined, "2026-10-07")).toBe("2026-10-05");
  });

  it("zählt Kalenderwochen nach ISO", () => {
    expect(isoWeekNumber("2026-10-07")).toBe(41);
    expect(isoWeekNumber("2027-01-01")).toBe(53);
    expect(isoWeekNumber("2027-01-04")).toBe(1);
  });

  it("kennt die deutsche Uhrzeit", () => {
    expect(hourInBerlin(new Date("2026-10-07T15:30:00Z"))).toBe(17); // Sommerzeit: +2
    expect(hourInBerlin(new Date("2026-12-07T15:30:00Z"))).toBe(16); // Winterzeit: +1
  });

  it("plant nur freie Plätze ab heute", () => {
    const places = openSlots(weekDates("2026-10-05"), ["abend"], [{ date: "2026-10-08", slot: "abend" }], "2026-10-07");
    expect(places.map((p) => p.date)).toEqual(["2026-10-07", "2026-10-09", "2026-10-10", "2026-10-11"]);
  });
});

describe("planMove", () => {
  const entry = (id: string, date: string, extra: Partial<PlanEntry> = {}): PlanEntry => ({
    id,
    date,
    slot: "abend",
    recipe_id: `rezept-${id}`,
    free_text: null,
    leftovers_recipe_id: null,
    skip: false,
    cooked: false,
    ...extra,
  });
  const entries = [entry("a", "2026-10-07"), entry("b", "2026-10-08", { recipe_id: null, free_text: "Pizza" })];

  it("verschiebt auf einen freien Platz", () => {
    expect(planMove(entries, "a", { date: "2026-10-09", slot: "abend" })).toEqual([{ id: "a", date: "2026-10-09", slot: "abend" }]);
  });

  it("tauscht mit einem belegten Platz", () => {
    expect(planMove(entries, "a", { date: "2026-10-08", slot: "abend" })).toEqual([
      { id: "a", recipe_id: null, free_text: "Pizza", leftovers_recipe_id: null, skip: false, cooked: false },
      { id: "b", recipe_id: "rezept-a", free_text: null, leftovers_recipe_id: null, skip: false, cooked: false },
    ]);
  });

  it("tut nichts bei gleichem Platz oder unbekanntem Eintrag", () => {
    expect(planMove(entries, "a", { date: "2026-10-07", slot: "abend" })).toEqual([]);
    expect(planMove(entries, "x", { date: "2026-10-09", slot: "abend" })).toEqual([]);
  });
});

describe("Auftau-Erinnerung", () => {
  it("erkennt Tiefkühler-Lagerorte", () => {
    expect(isFreezer("Tiefkühler")).toBe(true);
    expect(isFreezer("Gefrierschrank")).toBe(true);
    expect(isFreezer("TK-Fach")).toBe(true);
    expect(isFreezer("Kühlschrank")).toBe(false);
    expect(isFreezer(null)).toBe(false);
  });

  const pantry = [
    { id: "h", name: "Hähnchenbrust", frozen: true },
    { id: "s", name: "Sahne", frozen: false },
    { id: "e", name: "Erbsen", frozen: true },
  ];
  const curry = {
    title: "Hähnchen-Curry",
    ingredients: [ing("Hähnchenbrust", 400, "g", { pantryItemId: "h" }), ing("Sahne", 200, "ml", { pantryItemId: "s" }), ing("Erbsen", 100, "g")],
  };

  it("erinnert ab 17 Uhr am Vorabend an morgen", () => {
    const entries = [{ date: "2026-10-08", slot: "abend", cooked: false, recipe: curry }];
    expect(thawReminders(entries, pantry, "2026-10-07", 16)).toEqual([]);
    expect(thawReminders(entries, pantry, "2026-10-07", 17)).toEqual([
      { date: "2026-10-08", slot: "abend", when: "morgen", title: "Hähnchen-Curry", items: ["Hähnchenbrust", "Erbsen"] },
    ]);
  });

  it("zeigt den Hinweis am Tag selbst weiter, bis gekocht wurde", () => {
    const entry = { date: "2026-10-07", slot: "abend", cooked: false, recipe: curry };
    expect(thawReminders([entry], pantry, "2026-10-07", 9)[0].when).toBe("heute");
    expect(thawReminders([{ ...entry, cooked: true }], pantry, "2026-10-07", 9)).toEqual([]);
  });

  it("schweigt, wenn nichts aus dem Tiefkühler kommt", () => {
    const salad = { title: "Salat", ingredients: [ing("Sahne", 100, "ml", { pantryItemId: "s" })] };
    expect(thawReminders([{ date: "2026-10-08", slot: "abend", cooked: false, recipe: salad }], pantry, "2026-10-07", 20)).toEqual([]);
  });
});

describe("planShoppingList", () => {
  const bolognese = { title: "Bolognese", ingredients: [ing("Hackfleisch", 500, "g"), ing("Zwiebel", 1, "Stück"), ing("Tomatenmark", 2, "EL"), ing("Salz", null, "Prise")] };
  const chili = { title: "Chili", ingredients: [ing("Hackfleisch", 400, "g"), ing("Zwiebeln", 2, "Stück"), ing("Tomatenmark", 1, "EL"), ing("Kidneybohnen", 1, "Dose")] };
  const staples = ["Salz", "Pfeffer", "Öl"];

  it("führt Doppelte zusammen und lässt den Grundvorrat weg", () => {
    const lines = planShoppingList([bolognese, chili], [], [], staples);
    expect(lines.map((l) => [l.name, l.quantity, l.unit])).toEqual([
      ["Hackfleisch", 900, "g"],
      ["Kidneybohnen", 1, "Packung"],
      ["Tomatenmark", 1, "Packung"], // Löffel werden nicht verdoppelt
      ["Zwiebel", 3, "Stück"],
    ]);
    expect(lines[0].recipes).toEqual(["Bolognese", "Chili"]);
  });

  it("zieht den Vorrat ab, auch über mehrere Gerichte", () => {
    const pantry = [
      { name: "Hackfleisch", quantity: 500, unit: "g" as const },
      { name: "Zwiebeln", quantity: 5, unit: "Stück" as const },
      { name: "Tomatenmark", quantity: 1, unit: "Packung" as const },
    ];
    const lines = planShoppingList([bolognese, chili], pantry, [], staples);
    expect(lines.map((l) => [l.name, l.quantity, l.status, l.note])).toEqual([
      ["Hackfleisch", 400, "kaufen", "500 g im Vorrat"],
      ["Kidneybohnen", 1, "kaufen", null],
    ]);
  });

  it("fragt nach, wenn der Vorrat eine andere Einheit hat", () => {
    const lines = planShoppingList([bolognese], [{ name: "Hackfleisch", quantity: 1, unit: "Packung" }], [], staples);
    expect(lines.find((l) => l.name === "Hackfleisch")).toMatchObject({ status: "pruefen", quantity: 500, note: "im Vorrat: 1 Packung – reicht das?" });
  });

  it("berücksichtigt, was schon auf der Einkaufsliste steht", () => {
    const lines = planShoppingList([chili], [], [{ name: "Kidneybohnen", quantity: 2, unit: "Packung" }, { name: "Hackfleisch", quantity: 100, unit: "g" }], staples);
    expect(lines.map((l) => [l.name, l.quantity])).toEqual([
      ["Hackfleisch", 300],
      ["Tomatenmark", 1],
      ["Zwiebeln", 2],
    ]);
  });

  it("liefert nichts, wenn alles da ist", () => {
    const salad = { title: "Salat", ingredients: [ing("Gurke", 1, "Stück"), ing("Olivenöl", 2, "EL", { staple: true })] };
    expect(planShoppingList([salad], [{ name: "Gurken", quantity: 2, unit: "Stück" }], [], staples)).toEqual([]);
  });
});
