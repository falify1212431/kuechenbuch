import type { Metadata } from "next";
import Link from "next/link";
import { pantryForAi } from "@/lib/cooking/suggest";
import { check, loadBasics } from "@/lib/data/basics";
import { loadPreferences, toRecipe } from "@/lib/data/cooking";
import { todayInBerlin } from "@/lib/dates";
import { toPantryEntry } from "@/lib/pantry/entry";
import { createClient } from "@/lib/supabase/server";
import { CookTabs } from "./cook-tabs";
import { RecipeCard } from "./recipe-card";
import { SuggestForm, type MustUseOption } from "./suggest-form";

export const metadata: Metadata = { title: "Kochen" };

export default async function CookPage() {
  const supabase = await createClient();
  const today = todayInBerlin();
  const [{ rules }, prefs, pantryRows, latest] = await Promise.all([
    loadBasics(supabase),
    loadPreferences(supabase),
    supabase.from("pantry_items").select("*").eq("status", "da"),
    supabase.from("recipes").select("suggested_at").not("suggested_at", "is", null).order("suggested_at", { ascending: false }).limit(1),
  ]);
  const pantry = check(pantryRows, "Vorrat laden").map((row) => toPantryEntry(row, rules, today));

  // Die letzte Runde Vorschläge, in der Reihenfolge, die der Server festgelegt hat
  const batchAt = check(latest, "Vorschläge laden")[0]?.suggested_at;
  const recipes = batchAt
    ? check(
        await supabase.from("recipes").select("*").eq("suggested_at", batchAt).order("suggestion_rank"),
        "Vorschläge laden",
      ).map(toRecipe)
    : [];

  // Für „Das muss weg“: nur, was die KI auch sehen darf, Bald-Ablaufendes zuerst
  const allowed = new Set(pantryForAi(pantry, [...prefs.allergies, ...prefs.dislikes]).map((item) => item.id));
  const options: MustUseOption[] = pantry
    .filter((entry) => allowed.has(entry.id))
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
    .slice(0, 24)
    .map((entry) => ({ id: entry.id, name: entry.name, label: entry.label, level: entry.level }));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold">Kochen</h1>
      <CookTabs current="/kochen" />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Was kann ich heute kochen?</h2>
        <SuggestForm options={options} />
        <p className="text-xs text-stone-500">
          Jede Anfrage zählt als 1 von 50 KI-Aufrufen pro Tag. Erdnuss, Kokos und eingelegter Fisch werden immer aussortiert.{" "}
          <Link href="/einstellungen/vorlieben" className="underline">
            Vorlieben ändern
          </Link>
        </p>
      </section>

      {recipes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Vorschläge</h2>
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} pantry={pantry} />
          ))}
        </section>
      )}
    </div>
  );
}
