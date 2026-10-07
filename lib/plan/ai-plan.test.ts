import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DEFAULT_PREFERENCES } from "@/lib/cooking/preferences";
import type { AiPantryItem } from "@/lib/cooking/suggest";
import { buildPlanTask, buildStepsTask, finalizePlan, finalizeSteps, planSchema, stepsSchema, type AiPlanMeal, type PlanContext } from "./ai-plan";

const pantry: AiPantryItem[] = [
  { ref: 1, id: "hack", name: "Hackfleisch", quantity: 500, unit: "g", daysLeft: 1, dateType: "verbrauch", opened: false },
  { ref: 2, id: "reis", name: "Reis", quantity: 1000, unit: "g", daysLeft: 200, dateType: "mhd", opened: false },
];

function context(overrides: Partial<PlanContext> = {}): PlanContext {
  return {
    today: "2026-10-07",
    prefs: DEFAULT_PREFERENCES,
    pantry,
    places: [
      { date: "2026-10-07", slot: "abend" },
      { date: "2026-10-08", slot: "abend" },
      { date: "2026-10-10", slot: "abend" }, // Samstag
    ],
    fixed: [],
    likedTitles: [],
    dislikedTitles: [],
    avoidTitles: [],
    offers: [],
    ...overrides,
  };
}

function meal(overrides: Partial<AiPlanMeal>): AiPlanMeal {
  return {
    date: "2026-10-07",
    slot: "abend",
    title: "Gericht",
    summary: "",
    minutes: 30,
    servings: 2,
    difficulty: "leicht",
    leftovers_of: null,
    ingredients: [{ name: "Reis", amount: 150, unit: "g", pantry_ref: 2 }],
    ...overrides,
  };
}

describe("buildPlanTask", () => {
  it("nennt Termine mit Zeitgrenze, Ausschlüsse und Meal-Prep-Regeln", () => {
    const { system, prompt } = buildPlanTask(context({ fixed: [{ date: "2026-10-09", slot: "abend", title: "Lasagne", recipeId: "r1" }] }));
    expect(system).toContain("Erdnuss");
    expect(prompt).toContain("2026-10-07 (Mi 07.10. Abend), abend: höchstens 30 Minuten");
    expect(prompt).toContain("2026-10-10 (Sa 10.10. Abend), abend: höchstens 60 Minuten");
    expect(prompt).toContain("2026-10-09 abend: Lasagne");
    expect(prompt).toContain("#1 Hackfleisch");
    expect(prompt).toContain("leftovers_of");
  });
});

describe("finalizePlan", () => {
  it("übernimmt nur angefragte Termine, jeden höchstens einmal", () => {
    const result = finalizePlan(
      [meal({ title: "A" }), meal({ title: "B" }), meal({ date: "2026-10-09", title: "C" }), meal({ date: "2026-10-08", title: "D" })],
      context(),
    );
    expect(result.meals.map((m) => [m.date, m.kind === "rezept" ? m.recipe.title : m.title])).toEqual([
      ["2026-10-07", "A"],
      ["2026-10-08", "D"],
    ]);
  });

  it("verwirft Gerichte von der Sperrliste", () => {
    const result = finalizePlan(
      [meal({ title: "Satay-Spieße" }), meal({ date: "2026-10-08", ingredients: [{ name: "Kokosmilch", amount: 400, unit: "ml", pantry_ref: null }] })],
      context(),
    );
    expect(result.blocked).toBe(2);
    expect(result.meals).toHaveLength(0);
  });

  it("erlaubt Reste nur von einem vorher gekochten Gericht", () => {
    const result = finalizePlan(
      [
        meal({ title: "Chili", minutes: 55, ingredients: [{ name: "Hackfleisch", amount: 500, unit: "g", pantry_ref: 1 }] }),
        meal({ date: "2026-10-08", title: "Reste", leftovers_of: "chili", ingredients: [] }),
        meal({ date: "2026-10-10", title: "Reste", leftovers_of: "Gulasch", ingredients: [] }),
      ],
      context(),
    );
    expect(result.meals.map((m) => m.kind)).toEqual(["rezept", "reste"]);
    expect(result.meals[1]).toMatchObject({ kind: "reste", title: "Chili", leftoversOf: { title: "Chili" } });
    // 55 Minuten an einem Mittwoch sind nur okay, weil es Reste gibt (Meal-Prep)
    expect(result.filtered).toBe(1);
  });

  it("findet Reste auch von schon geplanten Rezepten", () => {
    const ctx = context({ fixed: [{ date: "2026-10-06", slot: "abend", title: "Linsen-Dal", recipeId: "dal" }] });
    const result = finalizePlan([meal({ title: "x", leftovers_of: "Linsen-Dal", ingredients: [] })], ctx);
    expect(result.meals[0]).toMatchObject({ kind: "reste", leftoversOf: { recipeId: "dal" } });
  });

  it("verwirft zu lange Gerichte ohne Meal-Prep und schlecht bewertete", () => {
    const result = finalizePlan([meal({ minutes: 90 }), meal({ date: "2026-10-08", title: "Linsensuppe" })], context({ dislikedTitles: ["Linsensuppe"] }));
    expect(result.filtered).toBe(2);
  });

  it("verknüpft Zutaten mit dem Vorrat und lässt die Schritte leer", () => {
    const result = finalizePlan([meal({})], context());
    const first = result.meals[0];
    expect(first.kind === "rezept" && first.recipe.ingredients[0].pantryItemId).toBe("reis");
    expect(first.kind === "rezept" && first.recipe.steps).toEqual([]);
  });
});

describe("Schemas", () => {
  it("lassen sich als JSON-Schema für die KI beschreiben", () => {
    expect(JSON.stringify(z.toJSONSchema(planSchema))).toContain("leftovers_of");
    expect(JSON.stringify(z.toJSONSchema(stepsSchema))).toContain("timer_minutes");
  });

  it("verwerfen kaputte Einträge einzeln", () => {
    const parsed = planSchema.parse({ meals: [{ title: "ohne Datum" }, meal({ title: "Gut" })] });
    expect(parsed.meals[0]).toBeNull();
    expect(parsed.meals[1]?.title).toBe("Gut");
  });
});

describe("Zubereitung nachträglich", () => {
  it("nennt die Zutaten und Geräte", () => {
    const { prompt } = buildStepsTask(
      { title: "Chili", servings: 4, minutes: 50, ingredients: [{ name: "Hackfleisch", amount: 500, unit: "g", pantryItemId: null, staple: false }] },
      DEFAULT_PREFERENCES,
      true,
    );
    expect(prompt).toContain("- 500 g Hackfleisch");
    expect(prompt).toContain("Airfryer");
    expect(prompt).toContain("days (Tage im Kühlschrank)");
  });

  it("verwirft Schritte mit gesperrten Zutaten", () => {
    const bad = { steps: [{ text: "Mit Erdnüssen bestreuen.", timer_minutes: null }], meal_prep: null };
    expect(finalizeSteps(bad, DEFAULT_PREFERENCES)).toBeNull();
    const good = { steps: [{ text: "Köcheln lassen.", timer_minutes: 20 }], meal_prep: null };
    expect(finalizeSteps(good, DEFAULT_PREFERENCES)).toEqual({ steps: [{ text: "Köcheln lassen.", timerMinutes: 20 }], mealPrep: null });
  });
});
