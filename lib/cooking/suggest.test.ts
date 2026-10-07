import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { PantryEntry } from "@/lib/pantry/entry";
import { DEFAULT_PREFERENCES } from "./preferences";
import {
  buildSuggestTask,
  finalizeSuggestions,
  maxMinutesFor,
  pantryForAi,
  suggestionSchema,
  urgency,
  type AiRecipe,
  type SuggestContext,
  type SuggestFilters,
} from "./suggest";

const TODAY = "2026-10-07"; // ein Mittwoch

function entry(overrides: Partial<PantryEntry>): PantryEntry {
  return {
    id: "id",
    name: "Zutat",
    brand: null,
    quantity: 1,
    unit: "Stück",
    categoryId: null,
    locationId: null,
    date: null,
    dateType: "mhd",
    estimated: false,
    openedAt: null,
    effective: null,
    allergenWarning: null,
    level: "grau",
    daysLeft: null,
    label: "ohne Datum",
    ...overrides,
  };
}

const noFilters: SuggestFilters = { onlyPantry: false, quick: false, mealPrep: false, mustUse: [], wish: "" };

const entries = [
  entry({ id: "nudeln", name: "Spaghetti", quantity: 500, unit: "g", daysLeft: 200 }),
  entry({ id: "hack", name: "Hackfleisch", quantity: 400, unit: "g", daysLeft: 0, dateType: "verbrauch" }),
  entry({ id: "spinat", name: "Spinat", quantity: 1, unit: "Packung", daysLeft: 2 }),
  entry({ id: "riegel", name: "Müsliriegel", allergenWarning: "spuren" }),
  entry({ id: "flips", name: "Erdnussflips" }),
  entry({ id: "kokos", name: "Kokosmilch", unit: "Packung" }),
  entry({ id: "tomaten", name: "Tomaten", quantity: 4, daysLeft: 5 }),
];

function context(overrides: Partial<SuggestContext> = {}): SuggestContext {
  const prefs = { ...DEFAULT_PREFERENCES, ...(overrides.prefs ?? {}) };
  return {
    today: TODAY,
    prefs,
    pantry: pantryForAi(entries, [...prefs.allergies, ...prefs.dislikes]),
    filters: noFilters,
    likedTitles: [],
    dislikedTitles: [],
    recentTitles: [],
    offers: [],
    ...overrides,
  };
}

function recipe(overrides: Partial<AiRecipe>): AiRecipe {
  return {
    title: "Gericht",
    summary: "",
    servings: 2,
    minutes: 25,
    difficulty: "leicht",
    ingredients: [{ name: "Spaghetti", amount: 250, unit: "g", pantry_ref: null }],
    steps: [{ text: "Kochen.", timer_minutes: 10 }],
    meal_prep: null,
    ...overrides,
  };
}

describe("pantryForAi", () => {
  it("lässt Erdnuss (auch Spuren) und Gesperrtes weg und sortiert nach Ablauf", () => {
    const items = pantryForAi(entries, DEFAULT_PREFERENCES.dislikes);
    expect(items.map((item) => item.id)).toEqual(["hack", "spinat", "tomaten", "nudeln"]);
    expect(items.map((item) => item.ref)).toEqual([1, 2, 3, 4]);
  });
});

describe("maxMinutesFor", () => {
  const prefs = { max_minutes_weekday: 30, max_minutes_weekend: 60 };

  it("nimmt unter der Woche und am Wochenende die eigene Grenze", () => {
    expect(maxMinutesFor(prefs, noFilters, "2026-10-07")).toBe(30);
    expect(maxMinutesFor(prefs, noFilters, "2026-10-10")).toBe(60);
  });

  it("„schnell“ heißt 20 Minuten, Meal-Prep darf doppelt so lange dauern", () => {
    expect(maxMinutesFor(prefs, { ...noFilters, quick: true }, "2026-10-10")).toBe(20);
    expect(maxMinutesFor(prefs, { ...noFilters, mealPrep: true }, "2026-10-07")).toBe(60);
  });
});

describe("buildSuggestTask", () => {
  it("schreibt alle Ausschlüsse in die Regeln für die KI", () => {
    const { system } = buildSuggestTask(context());
    expect(system).toContain("Erdnuss");
    expect(system).toContain("Kokos");
    expect(system).toContain("Matjes");
    expect(system).toContain("Sardellen");
  });

  it("listet den Vorrat mit Nummern, ohne Gesperrtes, Dringendes zuerst", () => {
    const { prompt } = buildSuggestTask(context());
    expect(prompt).toContain("#1 Hackfleisch – 400 g – läuft heute ab (Verbrauchsdatum)");
    expect(prompt).toContain("#2 Spinat – 1 Packung – noch 2 Tage (MHD)");
    expect(prompt).not.toContain("Erdnussflips");
    expect(prompt).not.toContain("Müsliriegel");
    expect(prompt).not.toContain("Kokosmilch");
    expect(prompt).toContain("Mittwoch, der 07.10.2026");
    expect(prompt).toContain("Höchstens 30 Minuten");
  });

  it("nimmt Filter, Wunsch und „Das muss weg“ auf", () => {
    const { prompt } = buildSuggestTask(
      context({ filters: { onlyPantry: true, quick: true, mealPrep: false, mustUse: ["spinat"], wish: "was Warmes" } }),
    );
    expect(prompt).toContain("Nichts darf fehlen");
    expect(prompt).toContain("höchstens 20 Minuten");
    expect(prompt).toContain("#2 Spinat");
    expect(prompt).toContain("„was Warmes“");
  });

  it("nennt Lieblingsgerichte und was nicht wieder kommen soll", () => {
    const { prompt } = buildSuggestTask(context({ likedTitles: ["Lasagne"], dislikedTitles: ["Linsensuppe"], recentTitles: ["Chili"] }));
    expect(prompt).toContain("Mag ich besonders (als Anregung): Lasagne");
    expect(prompt).toContain("Linsensuppe, Chili");
  });
});

describe("suggestionSchema", () => {
  it("verwirft nur das kaputte Rezept, nicht die ganze Antwort", () => {
    const parsed = suggestionSchema.parse({
      recipes: [{ title: "Ohne Zutaten", minutes: 10, ingredients: [], steps: [] }, recipe({ title: "Gut" })],
    });
    expect(parsed.recipes[0]).toBeNull();
    expect(parsed.recipes[1]?.title).toBe("Gut");
  });

  it("repariert kleine Fehler (unbekannte Einheit, Text statt Zahl)", () => {
    const parsed = suggestionSchema.parse({
      recipes: [
        {
          title: "Suppe",
          minutes: "30",
          difficulty: "einfach",
          ingredients: [{ name: "Brühe", amount: "1", unit: "Liter", pantry_ref: "x" }],
          steps: [{ text: "Kochen", timer_minutes: null }],
        },
      ],
    });
    const soup = parsed.recipes[0]!;
    expect(soup.minutes).toBe(30);
    expect(soup.difficulty).toBe("mittel");
    expect(soup.ingredients[0]).toEqual({ name: "Brühe", amount: 1, unit: null, pantry_ref: null });
  });
});

describe("finalizeSuggestions", () => {
  it("verwirft Vorschläge mit Erdnuss, Kokos oder eingelegtem Fisch – auch versteckt in den Schritten", () => {
    const result = finalizeSuggestions(
      [
        recipe({ title: "Hähnchen-Saté" }),
        recipe({ title: "Gemüsecurry", ingredients: [{ name: "Kokosmilch", amount: 400, unit: "ml", pantry_ref: null }] }),
        recipe({ title: "Bowl", steps: [{ text: "Mit Erdnüssen bestreuen.", timer_minutes: null }] }),
        recipe({ title: "Kartoffelsalat mit Matjes" }),
        recipe({ title: "Spaghetti aglio e olio" }),
      ],
      context(),
    );
    expect(result.blocked).toBe(4);
    expect(result.recipes.map((r) => r.title)).toEqual(["Spaghetti aglio e olio"]);
  });

  it("verwirft auch eigene Abneigungen aus den Vorlieben", () => {
    const ctx = context({ prefs: { ...DEFAULT_PREFERENCES, dislikes: ["Rosenkohl"] } });
    const result = finalizeSuggestions([recipe({ title: "Rosenkohl-Auflauf" })], ctx);
    expect(result.blocked).toBe(1);
  });

  it("sortiert Gerichte mit Bald-Ablaufendem nach vorn", () => {
    const result = finalizeSuggestions(
      [
        recipe({ title: "Nur Nudeln", ingredients: [{ name: "Spaghetti", amount: 250, unit: "g", pantry_ref: 4 }] }),
        recipe({ title: "Hack-Pfanne", ingredients: [{ name: "Hackfleisch", amount: 400, unit: "g", pantry_ref: 1 }] }),
        recipe({ title: "Spinat-Nudeln", ingredients: [{ name: "Spinat", amount: 1, unit: "Packung", pantry_ref: 2 }] }),
      ],
      context(),
    );
    expect(result.recipes.map((r) => r.title)).toEqual(["Hack-Pfanne", "Spinat-Nudeln", "Nur Nudeln"]);
  });

  it("stellt „Das muss weg“ ganz nach vorn", () => {
    const result = finalizeSuggestions(
      [
        recipe({ title: "Hack-Pfanne", ingredients: [{ name: "Hackfleisch", amount: 400, unit: "g", pantry_ref: 1 }] }),
        recipe({ title: "Tomatensalat", ingredients: [{ name: "Tomaten", amount: 4, unit: "Stück", pantry_ref: 3 }] }),
      ],
      context({ filters: { ...noFilters, mustUse: ["tomaten"] } }),
    );
    expect(result.recipes[0].title).toBe("Tomatensalat");
  });

  it("verknüpft Zutaten mit dem Vorrat und erkennt den Grundvorrat", () => {
    const result = finalizeSuggestions(
      [
        recipe({
          ingredients: [
            { name: "Hackfleisch", amount: 300, unit: "g", pantry_ref: 1 },
            { name: "Tomaten", amount: 2, unit: "Stück", pantry_ref: null }, // ohne Nummer, aber im Vorrat
            { name: "Olivenöl", amount: 2, unit: "EL", pantry_ref: null }, // Grundvorrat
            { name: "Parmesan", amount: 50, unit: "g", pantry_ref: null }, // fehlt
            { name: "Spinat", amount: 1, unit: "Packung", pantry_ref: 99 }, // falsche Nummer → über Namen
          ],
        }),
      ],
      context(),
    );
    expect(result.recipes[0].ingredients.map((i) => [i.name, i.pantryItemId, i.staple])).toEqual([
      ["Hackfleisch", "hack", false],
      ["Tomaten", "tomaten", false],
      ["Olivenöl", null, true],
      ["Parmesan", null, false],
      ["Spinat", "spinat", false],
    ]);
  });

  it("„Nur mit dem, was da ist“ verwirft Gerichte, bei denen etwas fehlt", () => {
    const result = finalizeSuggestions(
      [
        recipe({ title: "Mit Parmesan", ingredients: [{ name: "Parmesan", amount: 50, unit: "g", pantry_ref: null }] }),
        recipe({ title: "Nudeln mit Öl", ingredients: [{ name: "Spaghetti", amount: 250, unit: "g", pantry_ref: 4 }, { name: "Öl", amount: 2, unit: "EL", pantry_ref: null }] }),
      ],
      context({ filters: { ...noFilters, onlyPantry: true } }),
    );
    expect(result.filtered).toBe(1);
    expect(result.recipes.map((r) => r.title)).toEqual(["Nudeln mit Öl"]);
  });

  it("verwirft zu lange und schlecht bewertete Gerichte", () => {
    const result = finalizeSuggestions(
      [recipe({ title: "Schmorbraten", minutes: 180 }), recipe({ title: "linsensuppe" }), recipe({ title: "Rührei", minutes: 35 })],
      context({ dislikedTitles: ["Linsensuppe"] }),
    );
    expect(result.filtered).toBe(2);
    // 35 Minuten bei 30 erlaubt: 10 Minuten Spielraum
    expect(result.recipes.map((r) => r.title)).toEqual(["Rührei"]);
  });

  it("bei „schnell“ gibt es keinen Spielraum", () => {
    const result = finalizeSuggestions([recipe({ minutes: 25 })], context({ filters: { ...noFilters, quick: true } }));
    expect(result.recipes).toHaveLength(0);
  });

  it("übernimmt Schritte mit Timer und Meal-Prep-Hinweise", () => {
    const result = finalizeSuggestions(
      [recipe({ meal_prep: { days: 3, storage: "Kühlschrank", reheat: "Mikrowelle 3 Min." } })],
      context(),
    );
    expect(result.recipes[0].steps).toEqual([{ text: "Kochen.", timerMinutes: 10 }]);
    expect(result.recipes[0].mealPrep?.days).toBe(3);
  });
});

describe("urgency", () => {
  it("gewichtet Abgelaufenes und Heutiges am stärksten", () => {
    expect(urgency(-2)).toBeGreaterThan(urgency(1));
    expect(urgency(1)).toBeGreaterThan(urgency(3));
    expect(urgency(3)).toBeGreaterThan(urgency(30));
    expect(urgency(30)).toBeGreaterThan(urgency(null));
  });
});

describe("suggestionSchema als JSON-Schema", () => {
  it("lässt sich für die KI beschreiben", () => {
    const json = JSON.stringify(z.toJSONSchema(suggestionSchema));
    expect(json).toContain("pantry_ref");
    expect(json).toContain("timer_minutes");
  });
});

describe("Portionen im Prompt", () => {
  it("plant bei Meal-Prep mehr Portionen", () => {
    expect(buildSuggestTask(context()).prompt).toContain("- Portionen: 2");
    expect(buildSuggestTask(context({ filters: { ...noFilters, mealPrep: true } })).prompt).toContain("mindestens 4 Portionen");
  });
});

describe("Angebote im Prompt", () => {
  it("nennt Angebote nur, wenn es welche gibt", () => {
    expect(buildSuggestTask(context()).prompt).not.toContain("ANGEBOTE");
    expect(buildSuggestTask(context({ offers: ["Lidl: Hackfleisch 3,99 € – bis 11.10.2026"] })).prompt).toContain("- Lidl: Hackfleisch 3,99 €");
  });
});
