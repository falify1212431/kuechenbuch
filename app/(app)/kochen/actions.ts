"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { askAi } from "@/lib/ai/server";
import { ingredientStatus, toShoppingLine } from "@/lib/cooking/ingredients";
import { buildSuggestTask, finalizeSuggestions, pantryForAi, suggestionSchema, type SuggestContext } from "@/lib/cooking/suggest";
import { check, loadBasics } from "@/lib/data/basics";
import { cleanupOldSuggestions, loadPreferences, toRecipe } from "@/lib/data/cooking";
import { addToShoppingList, guessCategoryId } from "@/lib/data/shopping";
import { todayInBerlin } from "@/lib/dates";
import { toPantryEntry } from "@/lib/pantry/entry";
import { applyRemaining } from "@/lib/pantry/quantity";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SuggestState = { error?: string; notice?: string; run?: number };

const isUuid = (value: string) => z.uuid().safeParse(value).success;

/** Lädt ein Rezept oder bricht mit „nicht gefunden“ ab */
async function loadRecipe(supabase: Supabase, id: string) {
  if (!isUuid(id)) throw new Error("Ungültiges Rezept.");
  return toRecipe(check(await supabase.from("recipes").select("*").eq("id", id).single(), "Rezept laden"));
}

/** Portionen aus dem Formular: 1–20, sonst die des Rezepts */
function servingsFrom(formData: FormData, fallback: number): number {
  const value = Number(formData.get("servings"));
  return Number.isInteger(value) && value >= 1 && value <= 20 ? value : fallback;
}

/**
 * „Was kann ich heute kochen?“ – fragt die KI, prüft jeden Vorschlag gegen die Sperrliste,
 * sortiert nach Ablaufdaten und speichert das Ergebnis als Vorschläge.
 */
export async function suggestRecipes(previous: SuggestState, formData: FormData): Promise<SuggestState> {
  const run = (previous.run ?? 0) + 1;
  const filters = {
    onlyPantry: formData.get("nur_vorrat") === "on",
    quick: formData.get("schnell") === "on",
    mealPrep: formData.get("meal_prep") === "on",
    mustUse: formData.getAll("muss_weg").map(String).filter(isUuid).slice(0, 3),
    wish: String(formData.get("wunsch") ?? "").trim().slice(0, 200),
  };

  const supabase = await createClient();
  const today = todayInBerlin();
  const [{ rules }, prefs, pantryRows, rated, recent] = await Promise.all([
    loadBasics(supabase),
    loadPreferences(supabase),
    supabase.from("pantry_items").select("*").eq("status", "da"),
    supabase.from("recipes").select("title, rating, favorite").or("rating.not.is.null,favorite.eq.true").limit(60),
    supabase.from("recipes").select("title").not("suggested_at", "is", null).order("suggested_at", { ascending: false }).limit(6),
  ]);

  const entries = check(pantryRows, "Vorrat laden").map((row) => toPantryEntry(row, rules, today));
  const pantry = pantryForAi(entries, [...prefs.allergies, ...prefs.dislikes]);
  if (pantry.length === 0 && filters.onlyPantry) {
    return { run, error: "Dein Vorrat ist leer – „Nur mit dem, was da ist“ geht so nicht." };
  }

  const ratedRows = check(rated, "Bewertungen laden");
  const ctx: SuggestContext = {
    today,
    prefs,
    pantry,
    filters,
    likedTitles: ratedRows.filter((r) => r.rating === 1 || r.favorite).map((r) => r.title).slice(0, 10),
    dislikedTitles: ratedRows.filter((r) => r.rating === -1).map((r) => r.title).slice(0, 30),
    recentTitles: check(recent, "Letzte Vorschläge laden").map((r) => r.title),
  };

  const task = buildSuggestTask(ctx);
  const answer = await askAi(supabase, suggestionSchema, { model: "text", ...task, temperature: 0.7 });
  if (!answer.ok) return { run, error: answer.error };

  const result = finalizeSuggestions(answer.data.recipes, ctx);
  const dropped: string[] = [];
  if (result.blocked > 0) dropped.push(`${result.blocked} wegen der Sperrliste`);
  if (result.filtered > 0) dropped.push(`${result.filtered}, weil ${result.filtered === 1 ? "er" : "sie"} nicht zu den Filtern ${result.filtered === 1 ? "passte" : "passten"}`);

  if (result.recipes.length === 0) {
    return {
      run,
      error: `Diesmal war kein passender Vorschlag dabei${dropped.length > 0 ? ` (aussortiert: ${dropped.join(", ")})` : ""}. Versuch es noch einmal, vielleicht mit weniger Filtern.`,
    };
  }

  await cleanupOldSuggestions(supabase);
  const suggestedAt = new Date().toISOString();
  const { error } = await supabase.from("recipes").insert(
    result.recipes.map((recipe, index) => ({
      title: recipe.title,
      summary: recipe.summary || null,
      servings: recipe.servings,
      minutes: recipe.minutes,
      difficulty: recipe.difficulty,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      meal_prep: recipe.mealPrep,
      source: "ki",
      suggested_at: suggestedAt,
      suggestion_rank: index,
    })),
  );
  if (error) return { run, error: `Speichern hat nicht geklappt: ${error.message}` };

  revalidatePath("/kochen");
  return { run, notice: dropped.length > 0 ? `Aussortiert: ${dropped.join(", ")}.` : undefined };
}

/** Als Favorit merken oder wieder entfernen */
export async function toggleFavorite(id: string, favorite: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").update({ favorite }).eq("id", id);
  if (error) throw new Error(`Ändern hat nicht geklappt: ${error.message}`);
  revalidatePath(`/kochen/${id}`);
  revalidatePath("/kochen/rezeptbuch");
}

/** Daumen hoch (1) oder runter (-1); nochmal tippen nimmt die Bewertung zurück (null) */
export async function setRating(id: string, rating: 1 | -1 | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").update({ rating }).eq("id", id);
  if (error) throw new Error(`Ändern hat nicht geklappt: ${error.message}`);
  revalidatePath(`/kochen/${id}`);
  revalidatePath("/kochen/rezeptbuch");
}

/** Rezept löschen */
export async function deleteRecipe(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw new Error(`Löschen hat nicht geklappt: ${error.message}`);
  revalidatePath("/kochen");
  revalidatePath("/kochen/rezeptbuch");
  redirect("/kochen/rezeptbuch");
}

/** Alles, was für das Rezept fehlt, auf die Einkaufsliste – passend zur gewählten Portionszahl */
export async function addMissingToShopping(id: string, formData: FormData) {
  const supabase = await createClient();
  const recipe = await loadRecipe(supabase, id);
  const factor = servingsFrom(formData, recipe.servings) / recipe.servings;
  const pantry = check(await supabase.from("pantry_items").select("id, name").eq("status", "da"), "Vorrat laden");

  const missing = recipe.ingredients.filter((ingredient) => ingredientStatus(ingredient, pantry) === "fehlt");
  for (const ingredient of missing) {
    const line = toShoppingLine(ingredient, factor);
    const result = await addToShoppingList(supabase, {
      ...line,
      category_id: await guessCategoryId(supabase, line.name),
      source: "rezept",
    });
    if (result.error) throw new Error(`Einkaufsliste: ${result.error}`);
  }

  revalidatePath("/einkauf");
  redirect(`/kochen/${id}?hinweis=einkauf&anzahl=${missing.length}`);
}

/**
 * „Gekocht“: zieht die bestätigten Mengen vom Vorrat ab. Was leer wird, gilt als verbraucht.
 * Formularfelder: use_<Vorrats-ID> = verbrauchte Menge.
 */
export async function markCooked(id: string, formData: FormData) {
  const supabase = await createClient();
  const recipe = await loadRecipe(supabase, id);

  const uses = new Map<string, number>();
  for (const [key, value] of formData) {
    if (!key.startsWith("use_")) continue;
    const itemId = key.slice(4);
    const amount = Number(String(value).replace(",", "."));
    if (isUuid(itemId) && Number.isFinite(amount) && amount > 0) uses.set(itemId, amount);
  }

  if (uses.size > 0) {
    const items = check(
      await supabase.from("pantry_items").select("id, quantity").eq("status", "da").in("id", [...uses.keys()]),
      "Vorrat laden",
    );
    for (const item of items) {
      const have = Number(item.quantity);
      const result = applyRemaining(have, have - (uses.get(item.id) ?? 0));
      const { error } = await supabase
        .from("pantry_items")
        .update(
          result.usedUp
            ? { quantity: 0, status: "verbraucht", status_changed_at: new Date().toISOString() }
            : { quantity: result.quantity },
        )
        .eq("id", item.id);
      if (error) throw new Error(`Vorrat ändern hat nicht geklappt: ${error.message}`);
    }
  }

  const { error } = await supabase
    .from("recipes")
    .update({ cooked_count: recipe.cookedCount + 1, last_cooked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Speichern hat nicht geklappt: ${error.message}`);

  revalidatePath("/vorrat");
  revalidatePath("/kochen");
  redirect(`/kochen/${id}?hinweis=gekocht`);
}
