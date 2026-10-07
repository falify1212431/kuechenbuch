import { findMergeTarget } from "@/lib/shopping/list";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ShoppingSource = "hand" | "nachkaufen" | "plan" | "rezept" | "angebot";

/**
 * Setzt etwas auf die Einkaufsliste. Steht es dort schon (gleicher Name, gleiche Einheit,
 * noch nicht abgehakt), wird nur die Menge erhöht. So entstehen keine doppelten Zeilen.
 */
export async function addToShoppingList(
  supabase: Supabase,
  entry: { name: string; quantity: number; unit: string; category_id: string | null; source: ShoppingSource; offer_id?: string | null },
): Promise<{ error?: string; merged: boolean }> {
  const { data: lines, error } = await supabase
    .from("shopping_items")
    .select("id, name, quantity, unit, category_id, checked")
    .eq("checked", false);
  if (error) return { error: error.message, merged: false };

  const target = findMergeTarget(
    lines.map((line) => ({ ...line, quantity: Number(line.quantity) })),
    entry,
  );
  if (target) {
    const { error: updateError } = await supabase
      .from("shopping_items")
      .update({ quantity: Number(target.quantity) + entry.quantity, ...(entry.offer_id ? { offer_id: entry.offer_id } : {}) })
      .eq("id", target.id);
    return { error: updateError?.message, merged: true };
  }

  const { error: insertError } = await supabase.from("shopping_items").insert(entry);
  return { error: insertError?.message, merged: false };
}

/** Kategorie raten: die vom letzten gleichnamigen Vorrats-Eintrag */
export async function guessCategoryId(supabase: Supabase, name: string): Promise<string | null> {
  const { data } = await supabase
    .from("pantry_items")
    .select("category_id")
    .ilike("name", name)
    .not("category_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.category_id ?? null;
}
