// Zutaten eines Rezepts: Einheiten, Umrechnen auf andere Portionen, Abgleich mit Vorrat
// und Grundvorrat, Übernahme auf die Einkaufsliste.

import { z } from "zod";
import type { Unit } from "@/lib/pantry/quantity";
import { normalizeName } from "@/lib/text";

/** Einheiten in Rezepten. Die ersten vier gibt es auch im Vorrat und auf der Einkaufsliste. */
export const RECIPE_UNITS = ["g", "ml", "Stück", "Packung", "Dose", "EL", "TL", "Prise", "Bund", "Zehe"] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];

export type RecipeIngredient = {
  name: string;
  amount: number | null;
  unit: RecipeUnit | null;
  /** Vorrats-Eintrag, aus dem die Zutat kommt (für „Gekocht“) */
  pantryItemId: string | null;
  /** Gehört zum Grundvorrat (Salz, Öl …) und gilt immer als vorhanden */
  staple: boolean;
};

export type RecipeStep = {
  text: string;
  /** Für den Timer im Koch-Modus */
  timerMinutes: number | null;
};

export type MealPrep = {
  days: number;
  storage: string;
  reheat: string;
};

// So liegen die Rezept-Teile als JSON in der Datenbank. Beim Lesen wird nochmal geprüft.
export const storedIngredientsSchema = z.array(
  z.object({
    name: z.string(),
    amount: z.number().nullable(),
    unit: z.enum(RECIPE_UNITS).nullable(),
    pantryItemId: z.string().nullable(),
    staple: z.boolean(),
  }),
);
export const storedStepsSchema = z.array(z.object({ text: z.string(), timerMinutes: z.number().nullable() }));
export const storedMealPrepSchema = z.object({ days: z.number(), storage: z.string(), reheat: z.string() }).nullable();

/** Sinnvoll runden: Gramm/Milliliter auf 5, Stück & Co. auf halbe, Löffel auf halbe */
function roundFor(amount: number, unit: RecipeUnit | null): number {
  if (unit === "g" || unit === "ml") return amount >= 20 ? Math.round(amount / 5) * 5 : Math.round(amount);
  return Math.max(0.5, Math.round(amount * 2) / 2);
}

/** Menge für eine andere Portionszahl: 200 g für 2 Portionen → 300 g für 3 */
export function scaleAmount(amount: number | null, unit: RecipeUnit | null, factor: number): number | null {
  if (amount === null) return null;
  if (unit === "Prise") return amount; // Eine Prise bleibt eine Prise
  return roundFor(amount * factor, unit);
}

/** „300 g“, „1,5 EL“, „2 Zehen“ … für die Anzeige */
export function formatAmount(amount: number | null, unit: RecipeUnit | null): string {
  if (amount === null) return unit === "Prise" ? "1 Prise" : "";
  const number = amount.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  if (unit === null) return number;
  if (unit === "Zehe") return `${number} ${amount === 1 ? "Zehe" : "Zehen"}`;
  if (unit === "Dose") return `${number} ${amount === 1 ? "Dose" : "Dosen"}`;
  if (unit === "Prise") return `${number} ${amount === 1 ? "Prise" : "Prisen"}`;
  return `${number} ${unit}`;
}

/** Ist die Zutat im Grundvorrat? „Olivenöl“ passt zu „Öl“, „Kräuter“ zu „getrocknete Kräuter“. */
export function isStaple(name: string, staples: string[]): boolean {
  const ingredient = normalizeName(name);
  return staples.some((staple) => {
    const s = normalizeName(staple);
    return s.length >= 2 && (ingredient.includes(s) || (ingredient.length >= 4 && s.includes(ingredient)));
  });
}

export type IngredientStatus = "vorrat" | "grundvorrat" | "fehlt";

/**
 * Hab ich die Zutat? Erst der verknüpfte Vorrats-Eintrag, dann der Grundvorrat,
 * dann ein Eintrag mit passendem Namen (z. B. nachgekauft, seit das Rezept vorgeschlagen wurde).
 */
export function ingredientStatus(
  ingredient: Pick<RecipeIngredient, "name" | "pantryItemId" | "staple">,
  pantry: { id: string; name: string }[],
): IngredientStatus {
  if (ingredient.pantryItemId && pantry.some((item) => item.id === ingredient.pantryItemId)) return "vorrat";
  if (ingredient.staple) return "grundvorrat";
  return findPantryMatch(ingredient.name, pantry) ? "vorrat" : "fehlt";
}

/** Vorrats-Eintrag mit passendem Namen: „Zwiebeln“ ↔ „Zwiebel“, „Hackfleisch gemischt“ ↔ „Hackfleisch“ */
export function findPantryMatch<T extends { name: string }>(name: string, pantry: T[]): T | null {
  const wanted = stem(normalizeName(name));
  if (wanted.length < 3) return null;
  // Erst gleiche Namen (Einzahl/Mehrzahl egal), dann Namen, die einander enthalten
  return (
    pantry.find((item) => stem(normalizeName(item.name)) === wanted) ??
    pantry.find((item) => {
      const have = stem(normalizeName(item.name));
      return have.length >= 3 && (have.includes(wanted) || wanted.includes(have));
    }) ??
    null
  );
}

/** Grobe Grundform: „Zwiebeln“/„Zwiebel“ → „zwiebel“, „Tomaten“/„Tomate“ → „tomat“ */
export function stem(word: string): string {
  return word.replace(/(en|n|e|s)$/, "");
}

const SHOPPING_UNITS: Record<RecipeUnit, Unit | null> = {
  g: "g",
  ml: "ml",
  Stück: "Stück",
  Packung: "Packung",
  Dose: "Packung",
  Bund: "Stück",
  Zehe: null,
  EL: null,
  TL: null,
  Prise: null,
};

/**
 * Fehlende Zutat → Zeile für die Einkaufsliste. Löffel, Prisen und Zehen kauft man nicht einzeln:
 * daraus wird „1 Packung“ bzw. „1 Stück“ (Knoblauch).
 */
export function toShoppingLine(
  ingredient: Pick<RecipeIngredient, "name" | "amount" | "unit">,
  factor: number,
): { name: string; quantity: number; unit: Unit } {
  const unit = ingredient.unit ? SHOPPING_UNITS[ingredient.unit] : null;
  const amount = scaleAmount(ingredient.amount, ingredient.unit, factor);
  if (unit && amount !== null && amount > 0) return { name: ingredient.name, quantity: amount, unit };
  if (ingredient.unit === "Zehe") return { name: ingredient.name, quantity: 1, unit: "Stück" };
  if (!ingredient.unit && amount !== null && amount > 0) return { name: ingredient.name, quantity: amount, unit: "Stück" };
  return { name: ingredient.name, quantity: 1, unit: "Packung" };
}

/** Vergleichsschlüssel für Zutatennamen: „Zwiebeln“ und „zwiebel“ ergeben dasselbe */
export function nameKey(name: string): string {
  return stem(normalizeName(name));
}

/** Kommt bei toShoppingLine eine echte Menge heraus (und nicht nur „1 Packung“ für ein paar Löffel)? */
export function isExactShoppingAmount(ingredient: Pick<RecipeIngredient, "amount" | "unit">): boolean {
  if (ingredient.amount === null || ingredient.amount <= 0) return false;
  return ingredient.unit === null || SHOPPING_UNITS[ingredient.unit] !== null;
}
