"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { askAi } from "@/lib/ai/server";
import { pantryForAi } from "@/lib/cooking/suggest";
import { check, loadBasics } from "@/lib/data/basics";
import { loadPreferences } from "@/lib/data/cooking";
import { loadPlan } from "@/lib/data/plan";
import { addToShoppingList, guessCategoryId } from "@/lib/data/shopping";
import { addDays, todayInBerlin } from "@/lib/dates";
import { toPantryEntry } from "@/lib/pantry/entry";
import { UNITS } from "@/lib/pantry/quantity";
import { buildPlanTask, finalizePlan, planSchema, type PlanContext, type PlanPlace } from "@/lib/plan/ai-plan";
import { planMove } from "@/lib/plan/move";
import { openSlots, SLOTS, weekDates, weekStart } from "@/lib/plan/week";
import { createClient } from "@/lib/supabase/server";
import { normalizeName } from "@/lib/text";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PlanState = { error?: string; notice?: string };

const isUuid = (value: string) => z.uuid().safeParse(value).success;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slotSchema = z.enum(SLOTS);

function revalidatePlan() {
  revalidatePath("/plan");
  revalidatePath("/vorrat");
}

/**
 * Freie Plätze per KI füllen: Gerichte + Zutaten (ohne Schritte), Sperrliste, Reste-Tage.
 * Gemeinsam genutzt von „Woche planen“ und „Tag neu würfeln“.
 */
async function fillPlaces(supabase: Supabase, monday: string, places: PlanPlace[], avoidTitles: string[]): Promise<PlanState> {
  if (places.length === 0) return { notice: "Alle Abende sind schon geplant." };

  const today = todayInBerlin();
  const [{ rules }, prefs, pantryRows, rated, week] = await Promise.all([
    loadBasics(supabase),
    loadPreferences(supabase),
    supabase.from("pantry_items").select("*").eq("status", "da"),
    supabase.from("recipes").select("title, rating, favorite").or("rating.not.is.null,favorite.eq.true").limit(60),
    // Auch die Tage vor der Woche, damit Reste vom Sonntag am Montag möglich sind
    loadPlan(supabase, addDays(monday, -3), addDays(monday, 6)),
  ]);

  const entries = check(pantryRows, "Vorrat laden").map((row) => toPantryEntry(row, rules, today));
  const ratedRows = check(rated, "Bewertungen laden");
  const ctx: PlanContext = {
    today,
    prefs,
    pantry: pantryForAi(entries, [...prefs.allergies, ...prefs.dislikes]),
    places,
    fixed: week.filter((e) => e.recipe).map((e) => ({ date: e.date, slot: e.slot, title: e.recipe!.title, recipeId: e.recipe!.id })),
    likedTitles: ratedRows.filter((r) => r.rating === 1 || r.favorite).map((r) => r.title).slice(0, 10),
    dislikedTitles: ratedRows.filter((r) => r.rating === -1).map((r) => r.title).slice(0, 30),
    avoidTitles,
  };

  const answer = await askAi(supabase, planSchema, { model: "text", ...buildPlanTask(ctx), temperature: 0.7 });
  if (!answer.ok) return { error: answer.error };
  const result = finalizePlan(answer.data.meals, ctx);

  // 1. Neue Rezepte speichern (ohne Schritte – die kommen beim Öffnen)
  const cooked = result.meals.filter((m) => m.kind === "rezept");
  const created = new Map<string, string>(); // Titel (normalisiert) → Rezept-ID
  for (const meal of cooked) {
    const { data, error } = await supabase
      .from("recipes")
      .insert({
        title: meal.recipe.title,
        summary: meal.recipe.summary || null,
        servings: meal.recipe.servings,
        minutes: meal.recipe.minutes,
        difficulty: meal.recipe.difficulty,
        ingredients: meal.recipe.ingredients,
        steps: [],
        source: "ki",
      })
      .select("id")
      .single();
    if (error) return { error: `Speichern hat nicht geklappt: ${error.message}` };
    created.set(normalizeName(meal.recipe.title), data.id);
  }

  // 2. Plan-Einträge anlegen
  const rows: { date: string; slot: string; recipe_id?: string; leftovers_recipe_id?: string }[] = [];
  for (const meal of result.meals) {
    if (meal.kind === "rezept") {
      rows.push({ date: meal.date, slot: meal.slot, recipe_id: created.get(normalizeName(meal.recipe.title)) });
      continue;
    }
    const recipeId = "recipeId" in meal.leftoversOf ? meal.leftoversOf.recipeId : created.get(normalizeName(meal.leftoversOf.title));
    if (recipeId) rows.push({ date: meal.date, slot: meal.slot, leftovers_recipe_id: recipeId });
  }
  if (rows.length > 0) {
    const { error } = await supabase.from("meal_plan").insert(rows);
    if (error) return { error: `Speichern hat nicht geklappt: ${error.message}` };
  }

  revalidatePlan();
  const skipped = places.length - rows.length;
  const reasons = [
    result.blocked > 0 ? `${result.blocked} wegen der Sperrliste aussortiert` : null,
    skipped > 0 ? `${skipped} ${skipped === 1 ? "Abend ist" : "Abende sind"} noch frei – einfach nochmal planen oder selbst eintragen` : null,
  ].filter(Boolean);
  return { notice: reasons.length > 0 ? `Geplant. ${reasons.join(", ")}.` : "Geplant." };
}

/** „Woche planen“: alle freien Abende ab heute füllen */
export async function planWeek(monday: string): Promise<PlanState> {
  if (!isoDate.safeParse(monday).success) return { error: "Ungültige Woche." };
  const supabase = await createClient();
  const prefs = await loadPreferences(supabase);
  const dates = weekDates(weekStart(monday));
  const taken = await loadPlan(supabase, dates[0], dates[6]);
  return fillPlaces(supabase, weekStart(monday), openSlots(dates, prefs.meal_slots, taken, todayInBerlin()), []);
}

/** 🎲 Einen Tag neu planen: KI-Gerichte und Reste dieses Tages ersetzen (Freitext und „frei“ bleiben) */
export async function rerollDay(date: string): Promise<PlanState> {
  if (!isoDate.safeParse(date).success) return { error: "Ungültiger Tag." };
  if (date < todayInBerlin()) return { error: "Vergangene Tage lassen sich nicht neu planen." };
  const supabase = await createClient();
  const prefs = await loadPreferences(supabase);
  const day = await loadPlan(supabase, date, date);
  const replace = day.filter((entry) => !entry.cooked && (entry.recipe || entry.leftovers));
  const keep = day.filter((entry) => !replace.includes(entry));

  if (replace.length > 0) {
    const { error } = await supabase.from("meal_plan").delete().in("id", replace.map((entry) => entry.id));
    if (error) return { error: `Ändern hat nicht geklappt: ${error.message}` };
  }
  const places = openSlots([date], prefs.meal_slots, keep, date);
  const avoid = replace.map((entry) => entry.recipe?.title ?? entry.leftovers?.title ?? "").filter(Boolean);
  return fillPlaces(supabase, weekStart(date), places, avoid);
}

const entrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().trim().min(1, "Bitte etwas eintragen.").max(120, "Höchstens 120 Zeichen.") }),
  z.object({ kind: z.literal("frei") }),
  z.object({ kind: z.literal("rezept"), recipe_id: z.uuid() }),
  z.object({ kind: z.literal("reste"), recipe_id: z.uuid() }),
]);

/** Einen Platz belegen (ersetzt, was dort stand) */
export async function setEntry(date: string, slot: string, formData: FormData) {
  const place = z.object({ date: isoDate, slot: slotSchema }).parse({ date, slot });
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/plan/eintragen?datum=${date}&slot=${slot}&fehler=1`);
  const entry = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { error } = await supabase.from("meal_plan").upsert(
    {
      user_id: auth.claims.sub,
      ...place,
      recipe_id: entry.kind === "rezept" ? entry.recipe_id : null,
      leftovers_recipe_id: entry.kind === "reste" ? entry.recipe_id : null,
      free_text: entry.kind === "text" ? entry.text : null,
      skip: entry.kind === "frei",
      cooked: false,
    },
    { onConflict: "user_id,date,slot" },
  );
  if (error) throw new Error(`Speichern hat nicht geklappt: ${error.message}`);
  revalidatePlan();
  redirect(`/plan?woche=${weekStart(place.date)}`);
}

/** Eintrag entfernen */
export async function removeEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plan").delete().eq("id", id);
  if (error) throw new Error(`Löschen hat nicht geklappt: ${error.message}`);
  revalidatePlan();
}

/** Gegessen / gekocht abhaken (z. B. für Reste-Abende) */
export async function toggleCooked(id: string, cooked: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plan").update({ cooked }).eq("id", id);
  if (error) throw new Error(`Ändern hat nicht geklappt: ${error.message}`);
  revalidatePlan();
}

/** Verschieben: Ziel kommt als „JJJJ-MM-TT|abend“ aus dem Formular. Belegte Ziele werden getauscht. */
export async function moveEntry(id: string, formData: FormData) {
  const [date, slot] = String(formData.get("target") ?? "").split("|");
  const target = z.object({ date: isoDate, slot: slotSchema }).safeParse({ date, slot });
  if (!target.success || !isUuid(id)) return;

  const supabase = await createClient();
  const rows = check(
    await supabase.from("meal_plan").select("id, date, slot, recipe_id, free_text, leftovers_recipe_id, skip, cooked").or(`id.eq.${id},date.eq.${target.data.date}`),
    "Plan laden",
  );
  for (const update of planMove(rows, id, target.data)) {
    const { id: rowId, ...values } = update;
    const { error } = await supabase.from("meal_plan").update(values).eq("id", rowId);
    if (error) throw new Error(`Verschieben hat nicht geklappt: ${error.message}`);
  }
  revalidatePlan();
}

const lineSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number().positive().max(100000),
  unit: z.enum(UNITS),
});

/** Ausgewählte Zeilen aus der Plan-Vorschau auf die Einkaufsliste setzen */
export async function addPlanToShopping(monday: string, formData: FormData) {
  const lines = formData
    .getAll("line")
    .map((value) => {
      try {
        return lineSchema.safeParse(JSON.parse(String(value)));
      } catch {
        return null;
      }
    })
    .filter((result) => result?.success)
    .map((result) => result!.data!);

  const supabase = await createClient();
  for (const line of lines) {
    const result = await addToShoppingList(supabase, { ...line, category_id: await guessCategoryId(supabase, line.name), source: "plan" });
    if (result.error) throw new Error(`Einkaufsliste: ${result.error}`);
  }
  revalidatePath("/einkauf");
  redirect(`/plan?woche=${weekStart(isoDate.safeParse(monday).success ? monday : todayInBerlin())}&hinweis=einkauf&anzahl=${lines.length}`);
}
