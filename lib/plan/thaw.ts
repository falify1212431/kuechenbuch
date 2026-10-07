// Auftau-Erinnerung: Braucht ein geplantes Gericht etwas aus dem Tiefkühler?
// Am Vorabend ab 17 Uhr erscheint der Hinweis in der App, am Tag selbst bleibt er stehen.

import { findPantryMatch, type RecipeIngredient } from "@/lib/cooking/ingredients";
import { SLOTS } from "./week";
import { addDays } from "@/lib/dates";
import { normalizeName } from "@/lib/text";

/** Ab dieser Uhrzeit (deutsche Zeit) erinnert die App an das Auftauen für morgen */
export const THAW_HOUR = 17;

/** Ist der Lagerort ein Tiefkühler? („Tiefkühler“, „Gefrierschrank“, „TK-Fach“ …) */
export function isFreezer(locationName: string | null | undefined): boolean {
  if (!locationName) return false;
  const name = normalizeName(locationName);
  return /tiefkuehl|gefrier|freezer|\btk\b|\btk-/.test(name);
}

export interface ThawPantryItem {
  id: string;
  name: string;
  frozen: boolean;
}

export interface ThawEntry {
  date: string;
  slot: string;
  cooked: boolean;
  recipe: { title: string; ingredients: RecipeIngredient[] } | null;
}

export interface ThawReminder {
  date: string;
  slot: string;
  when: "heute" | "morgen";
  title: string;
  /** Was aus dem Tiefkühler muss */
  items: string[];
}

/** Welche Zutaten eines Rezepts liegen im Tiefkühler? */
function frozenIngredients(ingredients: RecipeIngredient[], pantry: ThawPantryItem[]): string[] {
  const found = new Set<string>();
  for (const ingredient of ingredients) {
    if (ingredient.staple) continue;
    const item = pantry.find((entry) => entry.id === ingredient.pantryItemId) ?? findPantryMatch(ingredient.name, pantry);
    if (item?.frozen) found.add(item.name);
  }
  return [...found];
}

export function thawReminders(entries: ThawEntry[], pantry: ThawPantryItem[], today: string, hour: number): ThawReminder[] {
  const tomorrow = addDays(today, 1);
  const reminders: ThawReminder[] = [];
  for (const entry of entries) {
    if (entry.cooked || !entry.recipe) continue;
    const when = entry.date === today ? "heute" : entry.date === tomorrow && hour >= THAW_HOUR ? "morgen" : null;
    if (!when) continue;
    const items = frozenIngredients(entry.recipe.ingredients, pantry);
    if (items.length > 0) reminders.push({ date: entry.date, slot: entry.slot, when, title: entry.recipe.title, items });
  }
  const slotOrder = (slot: string) => SLOTS.indexOf(slot as (typeof SLOTS)[number]);
  return reminders.sort((a, b) => a.date.localeCompare(b.date) || slotOrder(a.slot) - slotOrder(b.slot));
}
