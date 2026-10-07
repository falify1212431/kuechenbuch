import { describe, expect, it } from "vitest";
import { planConsumption } from "./consume";
import type { RecipeIngredient } from "./ingredients";

const pantry = [
  { id: "hack", name: "Hackfleisch", quantity: 500, unit: "g" as const },
  { id: "zwiebel", name: "Zwiebeln", quantity: 4, unit: "Stück" as const },
  { id: "tomaten", name: "Passierte Tomaten", quantity: 2, unit: "Packung" as const },
  { id: "sahne", name: "Sahne", quantity: 200, unit: "ml" as const },
];

const ingredient = (overrides: Partial<RecipeIngredient>): RecipeIngredient => ({
  name: "Zutat",
  amount: null,
  unit: null,
  pantryItemId: null,
  staple: false,
  ...overrides,
});

describe("planConsumption", () => {
  it("zieht bei passender Einheit die Rezeptmenge ab, umgerechnet auf die Portionen", () => {
    const lines = planConsumption([ingredient({ name: "Hackfleisch", amount: 200, unit: "g", pantryItemId: "hack" })], 1.5, pantry);
    expect(lines).toEqual([{ pantryItemId: "hack", name: "Hackfleisch", unit: "g", have: 500, use: 300 }]);
  });

  it("nimmt nie mehr, als da ist", () => {
    const lines = planConsumption([ingredient({ name: "Hackfleisch", amount: 400, unit: "g", pantryItemId: "hack" })], 2, pantry);
    expect(lines[0].use).toBe(500);
  });

  it("zählt eine Dose als Packung", () => {
    const lines = planConsumption([ingredient({ name: "Tomaten", amount: 1, unit: "Dose", pantryItemId: "tomaten" })], 1, pantry);
    expect(lines[0].use).toBe(1);
  });

  it("schlägt bei unpassender Einheit eins (Stück/Packung) oder alles (g/ml) vor", () => {
    const lines = planConsumption(
      [
        ingredient({ name: "Zwiebel", amount: 150, unit: "g", pantryItemId: "zwiebel" }),
        ingredient({ name: "Sahne", amount: 2, unit: "EL", pantryItemId: "sahne" }),
      ],
      1,
      pantry,
    );
    expect(lines.find((l) => l.pantryItemId === "zwiebel")?.use).toBe(1);
    expect(lines.find((l) => l.pantryItemId === "sahne")?.use).toBe(200);
  });

  it("findet Zutaten ohne Verknüpfung über den Namen und addiert doppelte", () => {
    const lines = planConsumption(
      [
        ingredient({ name: "Zwiebel", amount: 1, unit: "Stück" }),
        ingredient({ name: "rote Zwiebeln", amount: 1, unit: "Stück", pantryItemId: "zwiebel" }),
      ],
      1,
      pantry,
    );
    expect(lines).toEqual([{ pantryItemId: "zwiebel", name: "Zwiebeln", unit: "Stück", have: 4, use: 2 }]);
  });

  it("lässt Grundvorrat und Fehlendes weg", () => {
    const lines = planConsumption(
      [ingredient({ name: "Salz", staple: true }), ingredient({ name: "Parmesan", amount: 50, unit: "g" })],
      1,
      pantry,
    );
    expect(lines).toEqual([]);
  });
});
