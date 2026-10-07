import { DEFAULT_PREFERENCES, DIETS, withFixedAllergy, type Preferences } from "@/lib/cooking/preferences";
import {
  storedIngredientsSchema,
  storedMealPrepSchema,
  storedStepsSchema,
  type MealPrep,
  type RecipeIngredient,
  type RecipeStep,
} from "@/lib/cooking/ingredients";
import type { Tables } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";
import { check } from "./basics";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function toPreferences(row: Tables<"preferences">): Preferences {
  return {
    diet: DIETS.find((diet) => diet === row.diet) ?? "alles",
    diet_notes: row.diet_notes,
    // Erdnuss steht immer drin, auch wenn sie in der Datenbank fehlen sollte
    allergies: withFixedAllergy(row.allergies),
    dislikes: row.dislikes,
    cuisines: row.cuisines,
    goals: row.goals,
    servings: row.servings,
    max_minutes_weekday: row.max_minutes_weekday,
    max_minutes_weekend: row.max_minutes_weekend,
    budget_week: row.budget_week === null ? null : Number(row.budget_week),
    appliances: row.appliances,
    staples: row.staples,
  };
}

/** Lädt meine Vorlieben. Beim ersten Mal werden die Startwerte aus der SPEC angelegt. */
export async function loadPreferences(supabase: Supabase): Promise<Preferences> {
  const { data, error } = await supabase.from("preferences").select("*").maybeSingle();
  if (error) throw new Error(`Vorlieben laden fehlgeschlagen: ${error.message}`);
  if (data) return toPreferences(data);

  // Gleichzeitige Aufrufe dürfen nicht doppelt anlegen: bei vorhandener Zeile passiert nichts
  const { error: insertError } = await supabase
    .from("preferences")
    .upsert(DEFAULT_PREFERENCES, { onConflict: "user_id", ignoreDuplicates: true });
  if (insertError) throw new Error(`Vorlieben anlegen fehlgeschlagen: ${insertError.message}`);
  return toPreferences(check(await supabase.from("preferences").select("*").single(), "Vorlieben laden"));
}

export interface Recipe {
  id: string;
  title: string;
  summary: string | null;
  servings: number;
  minutes: number;
  difficulty: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  mealPrep: MealPrep | null;
  rating: number | null;
  favorite: boolean;
  cookedCount: number;
  lastCookedAt: string | null;
  suggestedAt: string | null;
}

/** Datenbank-Zeile → Rezept. Die JSON-Felder werden dabei nochmal geprüft. */
export function toRecipe(row: Tables<"recipes">): Recipe {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    servings: row.servings,
    minutes: row.minutes,
    difficulty: row.difficulty,
    ingredients: storedIngredientsSchema.catch([]).parse(row.ingredients),
    steps: storedStepsSchema.catch([]).parse(row.steps),
    mealPrep: storedMealPrepSchema.catch(null).parse(row.meal_prep),
    rating: row.rating,
    favorite: row.favorite,
    cookedCount: row.cooked_count,
    lastCookedAt: row.last_cooked_at,
    suggestedAt: row.suggested_at,
  };
}

/**
 * Räumt alte Vorschläge weg: älter als 7 Tage, nie gekocht, nicht gemerkt, nicht bewertet.
 * Bewertete mit 👎 bleiben, damit die KI sie nicht wieder vorschlägt.
 */
export async function cleanupOldSuggestions(supabase: Supabase) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("source", "ki")
    .eq("favorite", false)
    .eq("cooked_count", 0)
    .is("rating", null)
    .lt("created_at", weekAgo);
  if (error) console.error("Alte Vorschläge aufräumen fehlgeschlagen:", error.message);
}
