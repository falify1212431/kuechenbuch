import { addDays } from "@/lib/dates";
import { isFreezer, thawReminders, type ThawReminder } from "@/lib/plan/thaw";
import { hourInBerlin, SLOTS, type Slot } from "@/lib/plan/week";
import type { createClient } from "@/lib/supabase/server";
import { check } from "./basics";
import { toRecipe, type Recipe } from "./cooking";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface PlanRow {
  id: string;
  date: string;
  slot: Slot;
  recipe: Recipe | null;
  freeText: string | null;
  leftovers: { id: string; title: string } | null;
  skip: boolean;
  cooked: boolean;
}

// Zwei Verweise auf dieselbe Tabelle: deshalb mit Namen der Fremdschlüssel
const SELECT =
  "id, date, slot, free_text, skip, cooked, recipe:recipes!meal_plan_recipe_id_fkey(*), leftovers:recipes!meal_plan_leftovers_recipe_id_fkey(id, title)";

/** Plan-Einträge von … bis (jeweils einschließlich), mit Rezept */
export async function loadPlan(supabase: Supabase, from: string, to: string): Promise<PlanRow[]> {
  const rows = check(
    await supabase.from("meal_plan").select(SELECT).gte("date", from).lte("date", to).order("date"),
    "Plan laden",
  );
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    slot: SLOTS.find((s) => s === row.slot) ?? "abend",
    recipe: row.recipe ? toRecipe(row.recipe) : null,
    freeText: row.free_text,
    leftovers: row.leftovers,
    skip: row.skip,
    cooked: row.cooked,
  }));
}

/** Auftau-Hinweise für heute und (ab 17 Uhr) morgen */
export async function loadThawReminders(supabase: Supabase, today: string): Promise<ThawReminder[]> {
  const [entries, pantry, locations] = await Promise.all([
    loadPlan(supabase, today, addDays(today, 1)),
    supabase.from("pantry_items").select("id, name, location_id").eq("status", "da"),
    supabase.from("locations").select("id, name"),
  ]);
  const freezerIds = new Set(check(locations, "Lagerorte laden").filter((l) => isFreezer(l.name)).map((l) => l.id));
  if (freezerIds.size === 0) return [];
  return thawReminders(
    entries.map((entry) => ({ date: entry.date, slot: entry.slot, cooked: entry.cooked, recipe: entry.recipe })),
    check(pantry, "Vorrat laden").map((item) => ({ id: item.id, name: item.name, frozen: item.location_id !== null && freezerIds.has(item.location_id) })),
    today,
    hourInBerlin(),
  );
}
