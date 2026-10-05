import type { Tables } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";

export type Category = Tables<"categories">;
export type Location = Tables<"locations">;
export type ShelfLifeRuleRow = Tables<"shelf_life_rules">;
export type PantryItem = Tables<"pantry_items">;
export type ShoppingItem = Tables<"shopping_items">;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Wirft einen verständlichen Fehler, wenn die Datenbank etwas ablehnt */
export function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`${what} fehlgeschlagen: ${result.error?.message ?? "keine Daten"}`);
  }
  return result.data;
}

/**
 * Lädt Kategorien, Lagerorte und Haltbarkeits-Regeln.
 * Beim allerersten Besuch gibt es noch keine. Dann werden die Startwerte aus der SPEC angelegt.
 */
export async function loadBasics(supabase: Supabase) {
  const fetchCategories = async () =>
    check(await supabase.from("categories").select("*").order("sort_order"), "Kategorien laden");

  let categories = await fetchCategories();
  if (categories.length === 0) {
    const { error } = await supabase.rpc("ensure_defaults");
    if (error) throw new Error(`Startwerte anlegen fehlgeschlagen: ${error.message}`);
    categories = await fetchCategories();
  }

  const [locations, rules] = await Promise.all([
    supabase.from("locations").select("*").order("sort_order"),
    supabase.from("shelf_life_rules").select("*"),
  ]);

  return {
    categories,
    locations: check(locations, "Lagerorte laden"),
    rules: check(rules, "Haltbarkeits-Regeln laden"),
  };
}
