import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, parseList, preferencesFormSchema, withFixedAllergy } from "./preferences";

describe("Startwerte", () => {
  it("enthalten die Angaben aus der SPEC", () => {
    expect(DEFAULT_PREFERENCES.allergies).toContain("Erdnuss");
    expect(DEFAULT_PREFERENCES.dislikes).toEqual(expect.arrayContaining(["Kokos", "Matjes", "Sardellen", "Rollmops"]));
    expect(DEFAULT_PREFERENCES.budget_week).toBe(80);
    expect(DEFAULT_PREFERENCES.diet_notes).toContain("Nur Nur Natur");
    expect(DEFAULT_PREFERENCES.appliances).toContain("Airfryer (Ninja Double Stack)");
  });
});

describe("parseList", () => {
  it("verbindet Häkchen und Textfeld, trennt an Zeilen und Kommas", () => {
    expect(parseList(["Herd"], "Wok\nSlow Cooker, Grill")).toEqual(["Herd", "Wok", "Slow Cooker", "Grill"]);
  });

  it("entfernt Leeres und Doppeltes (ohne Groß-/Kleinschreibung)", () => {
    expect(parseList(["Salz"], "salz\n\n  Pfeffer  ,")).toEqual(["Salz", "Pfeffer"]);
  });

  it("kürzt zu lange Einträge", () => {
    expect(parseList([], "x".repeat(80))[0]).toHaveLength(60);
  });
});

describe("withFixedAllergy", () => {
  it("setzt Erdnuss immer wieder ein", () => {
    expect(withFixedAllergy([])).toEqual(["Erdnuss"]);
    expect(withFixedAllergy(["Sellerie"])).toEqual(["Erdnuss", "Sellerie"]);
  });

  it("verdoppelt Erdnuss nicht", () => {
    expect(withFixedAllergy(["Erdnuss", "Sellerie"])).toEqual(["Erdnuss", "Sellerie"]);
  });
});

describe("preferencesFormSchema", () => {
  const valid = {
    diet: "alles",
    diet_notes: "naturbelassen",
    servings: "2",
    max_minutes_weekday: "30",
    max_minutes_weekend: "60",
    budget_week: "80,50",
  };

  it("nimmt gültige Werte an und versteht das deutsche Komma", () => {
    const parsed = preferencesFormSchema.parse(valid);
    expect(parsed.budget_week).toBe(80.5);
    expect(parsed.servings).toBe(2);
  });

  it("erlaubt ein leeres Budget", () => {
    expect(preferencesFormSchema.parse({ ...valid, budget_week: "" }).budget_week).toBeNull();
  });

  it("lehnt Unsinn ab", () => {
    expect(preferencesFormSchema.safeParse({ ...valid, servings: "0" }).success).toBe(false);
    expect(preferencesFormSchema.safeParse({ ...valid, max_minutes_weekday: "1000" }).success).toBe(false);
    expect(preferencesFormSchema.safeParse({ ...valid, budget_week: "viel" }).success).toBe(false);
    expect(preferencesFormSchema.safeParse({ ...valid, diet: "carnivor" }).success).toBe(false);
  });
});
