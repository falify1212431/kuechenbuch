// „Gekocht“: Welche Vorrats-Einträge werden um wie viel weniger? Erst Vorschau, dann bestätigen.

import type { Unit } from "@/lib/pantry/quantity";
import { findPantryMatch, scaleAmount, type RecipeIngredient } from "./ingredients";

export interface PantryStock {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
}

export interface ConsumptionLine {
  pantryItemId: string;
  name: string;
  unit: Unit;
  /** So viel ist da */
  have: number;
  /** Vorschlag: so viel wird verbraucht (in der Einheit des Vorrats) */
  use: number;
}

/** Passt die Rezept-Einheit zur Vorrats-Einheit? Eine Dose zählt als Packung. */
function sameUnit(recipeUnit: RecipeIngredient["unit"], pantryUnit: Unit): boolean {
  return recipeUnit === pantryUnit || (recipeUnit === "Dose" && pantryUnit === "Packung");
}

/**
 * Rechnet aus, was beim Kochen vom Vorrat weggeht.
 * - Passende Einheit: genau die (umgerechnete) Rezeptmenge, höchstens was da ist.
 * - Einheit passt nicht (z. B. Rezept 200 g, Vorrat 1 Packung): bei Stück/Packung eins,
 *   bei g/ml alles. Das ist nur ein Vorschlag – in der Vorschau lässt sich jede Menge ändern.
 * - Grundvorrat wird nicht abgezogen. Mehrere Zutaten aus demselben Eintrag werden addiert.
 */
export function planConsumption(ingredients: RecipeIngredient[], factor: number, pantry: PantryStock[]): ConsumptionLine[] {
  const lines = new Map<string, ConsumptionLine>();

  for (const ingredient of ingredients) {
    if (ingredient.staple) continue;
    const item =
      pantry.find((entry) => entry.id === ingredient.pantryItemId) ?? findPantryMatch(ingredient.name, pantry);
    if (!item) continue;

    const amount = scaleAmount(ingredient.amount, ingredient.unit, factor);
    let use: number;
    if (amount !== null && sameUnit(ingredient.unit, item.unit)) use = amount;
    else if (item.unit === "Stück" || item.unit === "Packung") use = Math.min(item.quantity, 1);
    else use = item.quantity;

    const line = lines.get(item.id);
    const total = Math.min(item.quantity, (line?.use ?? 0) + use);
    lines.set(item.id, { pantryItemId: item.id, name: item.name, unit: item.unit, have: item.quantity, use: Math.round(total * 100) / 100 });
  }

  return [...lines.values()];
}
