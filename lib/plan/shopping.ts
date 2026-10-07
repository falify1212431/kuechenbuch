// Einkaufsliste aus dem Plan: Bedarf aller geplanten Gerichte – minus Vorrat – minus
// Grundvorrat – minus was schon auf der Einkaufsliste steht. Doppelte werden zusammengeführt.

import { findPantryMatch, isExactShoppingAmount, isStaple, nameKey, toShoppingLine, type RecipeIngredient } from "@/lib/cooking/ingredients";
import { formatQuantity, type Unit } from "@/lib/pantry/quantity";

export interface PlannedRecipe {
  title: string;
  ingredients: RecipeIngredient[];
}

export interface StockItem {
  name: string;
  quantity: number;
  unit: Unit;
}

export interface NeedLine {
  name: string;
  quantity: number;
  unit: Unit;
  /** Für welche Gerichte */
  recipes: string[];
  /**
   * kaufen = fehlt sicher (vorab angehakt);
   * pruefen = ist im Vorrat, aber in anderer Einheit – selbst entscheiden (nicht angehakt)
   */
  status: "kaufen" | "pruefen";
  /** Was davon schon da ist, z. B. „im Vorrat: 1 Packung“ */
  note: string | null;
}

interface Collected {
  name: string;
  quantity: number;
  unit: Unit;
  exact: boolean;
  recipes: string[];
}

const round = (value: number) => Math.round(value * 100) / 100;

export function planShoppingList(
  recipes: PlannedRecipe[],
  pantry: StockItem[],
  openShopping: StockItem[],
  staples: string[],
): NeedLine[] {
  // 1. Bedarf sammeln und Doppelte zusammenführen (gleicher Name + gleiche Einheit)
  const collected = new Map<string, Collected>();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      if (ingredient.staple || isStaple(ingredient.name, staples)) continue;
      const line = toShoppingLine(ingredient, 1);
      const exact = isExactShoppingAmount(ingredient);
      const key = `${nameKey(line.name)}|${line.unit}`;
      const existing = collected.get(key);
      if (!existing) {
        collected.set(key, { ...line, exact, recipes: [recipe.title] });
        continue;
      }
      // Echte Mengen addieren; „1 Packung“ für ein paar Löffel nicht verdoppeln
      existing.quantity = existing.exact && exact ? round(existing.quantity + line.quantity) : Math.max(existing.quantity, line.quantity);
      existing.exact = existing.exact && exact;
      if (!existing.recipes.includes(recipe.title)) existing.recipes.push(recipe.title);
    }
  }

  // 2. Vorrat und Einkaufsliste abziehen. Restmengen merken, falls mehrere Zeilen denselben Eintrag treffen.
  const pantryLeft = pantry.map((item) => ({ ...item }));
  const shoppingLeft = openShopping.map((item) => ({ ...item }));
  const result: NeedLine[] = [];

  for (const need of collected.values()) {
    let quantity = need.quantity;
    let note: string | null = null;
    let status: NeedLine["status"] = "kaufen";

    const onList = shoppingLeft.find((item) => item.unit === need.unit && nameKey(item.name) === nameKey(need.name));
    if (onList) {
      const used = Math.min(onList.quantity, quantity);
      onList.quantity -= used;
      quantity = round(quantity - used);
      if (quantity <= 0) continue; // steht schon auf der Liste
    }

    const inPantry = findPantryMatch(need.name, pantryLeft);
    if (inPantry) {
      if (!need.exact) continue; // Ein paar Löffel: was im Vorrat ist, reicht
      if (inPantry.unit === need.unit) {
        const used = Math.min(inPantry.quantity, quantity);
        inPantry.quantity -= used;
        quantity = round(quantity - used);
        if (quantity <= 0) continue; // reicht
        note = `${formatQuantity(round(used), need.unit)} im Vorrat`;
      } else {
        status = "pruefen";
        note = `im Vorrat: ${formatQuantity(inPantry.quantity, inPantry.unit)} – reicht das?`;
      }
    }

    result.push({ name: need.name, quantity, unit: need.unit, recipes: need.recipes, status, note });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "de"));
}
