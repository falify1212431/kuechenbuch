import type { Metadata } from "next";
import Link from "next/link";
import { check, loadBasics } from "@/lib/data/basics";
import { toRecipe } from "@/lib/data/cooking";
import { todayInBerlin } from "@/lib/dates";
import { toPantryEntry } from "@/lib/pantry/entry";
import { createClient } from "@/lib/supabase/server";
import { RecipeCard } from "../recipe-card";

export const metadata: Metadata = { title: "Rezeptbuch" };

/** Mein Rezeptbuch: gemerkte Rezepte, darunter was ich schon gekocht oder gut bewertet habe */
export default async function RecipeBookPage() {
  const supabase = await createClient();
  const today = todayInBerlin();
  const [{ rules }, pantryRows, recipeRows] = await Promise.all([
    loadBasics(supabase),
    supabase.from("pantry_items").select("*").eq("status", "da"),
    supabase
      .from("recipes")
      .select("*")
      .or("favorite.eq.true,rating.eq.1,cooked_count.gt.0")
      .order("last_cooked_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);
  const pantry = check(pantryRows, "Vorrat laden").map((row) => toPantryEntry(row, rules, today));
  const recipes = check(recipeRows, "Rezepte laden").map(toRecipe);
  const favorites = recipes.filter((recipe) => recipe.favorite);
  const others = recipes.filter((recipe) => !recipe.favorite);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/kochen" className="text-stone-600 dark:text-stone-400">
        ← Kochen
      </Link>
      <h1 className="text-3xl font-bold">Rezeptbuch</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">★ Favoriten</h2>
        {favorites.length === 0 ? (
          <p className="text-stone-500">Noch keine. Tipp bei einem Rezept auf „☆ Merken“.</p>
        ) : (
          favorites.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} pantry={pantry} />)
        )}
      </section>

      {others.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Gekocht oder 👍</h2>
          {others.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} pantry={pantry} />
          ))}
        </section>
      )}
    </div>
  );
}
