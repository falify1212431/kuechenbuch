import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonDanger, card } from "@/components/styles";
import { ingredientStatus } from "@/lib/cooking/ingredients";
import { check } from "@/lib/data/basics";
import { toRecipe } from "@/lib/data/cooking";
import { createClient } from "@/lib/supabase/server";
import { addMissingToShopping, deleteRecipe, setRating, toggleFavorite } from "../actions";
import { RecipeMeta } from "../recipe-card";
import { IngredientsPanel } from "./ingredients-panel";

export const metadata: Metadata = { title: "Rezept" };

const notice = "rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100";

export default async function RecipePage({ params, searchParams }: PageProps<"/kochen/[id]">) {
  const { id } = await params;
  const { hinweis, anzahl } = await searchParams;

  const supabase = await createClient();
  const { data: row } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const recipe = toRecipe(row);
  const pantry = check(await supabase.from("pantry_items").select("id, name").eq("status", "da"), "Vorrat laden");

  const toggle = "flex-1 rounded-xl border px-3 py-2 text-lg";
  const on = "border-emerald-700 bg-emerald-50 dark:bg-emerald-950";
  const off = "border-stone-300 dark:border-stone-600";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/kochen" className="text-stone-600 dark:text-stone-400">
        ← Kochen
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{recipe.title}</h1>
        <RecipeMeta recipe={recipe} />
        {recipe.summary && <p className="mt-1">{recipe.summary}</p>}
        {recipe.cookedCount > 0 && (
          <p className="mt-1 text-sm text-stone-500">
            {recipe.cookedCount}× gekocht, zuletzt am {new Date(recipe.lastCookedAt!).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" })}
          </p>
        )}
      </div>

      {hinweis === "gekocht" && <p className={notice}>Guten Appetit! Der Vorrat ist angepasst.</p>}
      {hinweis === "einkauf" && (
        <p className={notice}>
          {anzahl === "1" ? "1 Zutat steht" : `${anzahl} Zutaten stehen`} jetzt auf der{" "}
          <Link href="/einkauf" className="underline">
            Einkaufsliste
          </Link>
          .
        </p>
      )}

      {/* Merken und bewerten */}
      <div className="flex gap-2">
        <form action={toggleFavorite.bind(null, recipe.id, !recipe.favorite)} className="flex flex-[2]">
          <button type="submit" className={`${toggle} w-full ${recipe.favorite ? on : off}`} aria-pressed={recipe.favorite}>
            {recipe.favorite ? "★ Gemerkt" : "☆ Merken"}
          </button>
        </form>
        <form action={setRating.bind(null, recipe.id, recipe.rating === 1 ? null : 1)} className="flex flex-1">
          <button type="submit" className={`${toggle} ${recipe.rating === 1 ? on : off}`} aria-pressed={recipe.rating === 1} aria-label="Daumen hoch">
            👍
          </button>
        </form>
        <form action={setRating.bind(null, recipe.id, recipe.rating === -1 ? null : -1)} className="flex flex-1">
          <button type="submit" className={`${toggle} ${recipe.rating === -1 ? "border-red-600 bg-red-50 dark:bg-red-950" : off}`} aria-pressed={recipe.rating === -1} aria-label="Daumen runter">
            👎
          </button>
        </form>
      </div>
      {recipe.rating === -1 && <p className="text-sm text-stone-500">Wird dir nicht mehr vorgeschlagen.</p>}

      <IngredientsPanel
        recipeId={recipe.id}
        baseServings={recipe.servings}
        ingredients={recipe.ingredients.map((ingredient) => ({
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
          status: ingredientStatus(ingredient, pantry),
        }))}
        addMissing={addMissingToShopping.bind(null, recipe.id)}
      />

      <p className="text-sm text-stone-500">
        Geprüft gegen Erdnuss, Kokos und eingelegten Fisch. Bei gekauften Zutaten trotzdem immer die Zutatenliste auf der Packung lesen.
      </p>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="text-lg font-semibold">Zubereitung</h2>
        <ol className="flex flex-col gap-3">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">{index + 1}</span>
              <p>
                {step.text}
                {step.timerMinutes && <span className="text-sm text-stone-500"> · ⏱ {step.timerMinutes} Min.</span>}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {recipe.mealPrep && (
        <section className={`${card} flex flex-col gap-1`}>
          <h2 className="text-lg font-semibold">🥡 Meal-Prep</h2>
          <p>
            <strong>Hält:</strong> {recipe.mealPrep.days} {recipe.mealPrep.days === 1 ? "Tag" : "Tage"} im Kühlschrank
          </p>
          {recipe.mealPrep.storage && (
            <p>
              <strong>Lagern:</strong> {recipe.mealPrep.storage}
            </p>
          )}
          {recipe.mealPrep.reheat && (
            <p>
              <strong>Aufwärmen:</strong> {recipe.mealPrep.reheat}
            </p>
          )}
        </section>
      )}

      <details>
        <summary className="cursor-pointer text-sm text-red-700 dark:text-red-400">Rezept löschen …</summary>
        <form action={deleteRecipe.bind(null, recipe.id)} className="mt-2">
          <button type="submit" className={`${buttonDanger} w-full`}>
            „{recipe.title}“ wirklich löschen
          </button>
        </form>
      </details>
    </div>
  );
}
