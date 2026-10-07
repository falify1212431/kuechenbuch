// „Woche planen“ per KI: Aufgabe (Prompt + Schema) und Nachbearbeitung.
// Damit das Gratis-Limit reicht, liefert die KI hier nur Gericht + Zutaten. Die Zubereitung
// wird erst beim Öffnen des Rezepts erstellt (buildStepsTask).

import { z } from "zod";
import { findBlocked } from "@/lib/allergens/blocklist";
import { RECIPE_UNITS, type MealPrep, type RecipeIngredient, type RecipeStep } from "@/lib/cooking/ingredients";
import type { Preferences } from "@/lib/cooking/preferences";
import {
  aiIngredient,
  cookingSystemPrompt,
  linkIngredients,
  list,
  pantryLines,
  preferenceLines,
  type AiPantryItem,
  type FinalRecipe,
} from "@/lib/cooking/suggest";
import { formatDateDe, isWeekend } from "@/lib/dates";
import { normalizeName } from "@/lib/text";
import { formatDayShort, SLOT_LABELS, SLOTS, type Slot } from "./week";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const planMeal = z.object({
  date: isoDate,
  slot: z.enum(SLOTS).catch("abend"),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(400).catch(""),
  minutes: z.coerce.number().int().min(1).max(600).catch(30),
  servings: z.coerce.number().int().min(1).max(20).catch(2),
  difficulty: z.enum(["leicht", "mittel", "schwer"]).catch("mittel"),
  /** Meal-Prep: Titel des Gerichts, dessen Reste es hier gibt – dann ohne Zutaten */
  leftovers_of: z.string().trim().max(120).nullable().catch(null),
  ingredients: z.array(aiIngredient).max(30).catch([]),
});
export type AiPlanMeal = z.infer<typeof planMeal>;

export const planSchema = z.object({ meals: z.array(planMeal.nullable().catch(null)).max(14) });

export interface PlanPlace {
  date: string;
  slot: Slot;
}

export interface PlanContext {
  today: string;
  prefs: Preferences;
  pantry: AiPantryItem[];
  /** Freie Plätze, die die KI füllen soll */
  places: PlanPlace[];
  /** Was in der Woche schon geplant ist (Rezepte), damit es abwechslungsreich bleibt und Reste möglich sind */
  fixed: { date: string; slot: Slot; title: string; recipeId: string }[];
  likedTitles: string[];
  dislikedTitles: string[];
  /** Diesmal nicht (z. B. beim Neu-Würfeln die bisherigen Gerichte) */
  avoidTitles: string[];
}

/** Höchste Kochzeit für einen Tag: Wochenende länger */
function baseMinutes(prefs: Preferences, date: string): number {
  return isWeekend(date) ? prefs.max_minutes_weekend : prefs.max_minutes_weekday;
}

const placeLabel = (place: { date: string; slot: Slot }) => `${formatDayShort(place.date)} ${SLOT_LABELS[place.slot]}`;

export function buildPlanTask(ctx: PlanContext): { system: string; prompt: string } {
  const { prefs } = ctx;
  const lines = [
    `Heute ist der ${formatDateDe(ctx.today)}. Plane Hauptgerichte für genau diese Termine:`,
    ...ctx.places.map((place) => `- ${place.date} (${placeLabel(place)}), ${place.slot}: höchstens ${baseMinutes(prefs, place.date)} Minuten`),
    "",
    ...(ctx.fixed.length > 0
      ? ["SCHON GEPLANT (nicht ändern, aber für Abwechslung und Reste beachten):", ...ctx.fixed.map((f) => `- ${f.date} ${f.slot}: ${f.title}`), ""]
      : []),
    "VORRAT (Nummer, Name, Menge, Haltbarkeit). Was bald abläuft, kommt in die ersten Tage:",
    ...pantryLines(ctx.pantry),
    "",
    `GRUNDVORRAT (immer da): ${list(prefs.staples)}`,
    "",
    "VORLIEBEN:",
    ...preferenceLines(prefs, ctx.likedTitles),
    `- Portionen pro Mahlzeit: ${prefs.servings}`,
    "",
    "MEAL-PREP AUSDRÜCKLICH ERWÜNSCHT:",
    "- Koche an einem Tag für zwei (höchstens drei) Mahlzeiten. Dann darf es doppelt so lange dauern, und servings deckt alle Mahlzeiten ab.",
    "- Am Folgetermin trägst du leftovers_of = genau der Titel des vorgekochten Gerichts ein und lässt ingredients leer.",
    "- Abwechslung: nicht zweimal hintereinander dieselbe Hauptzutat (außer Reste).",
    "- Insgesamt soll die Woche ins Budget passen: Zutaten mehrfach nutzen, wenig Reste wegwerfen.",
    ...(ctx.dislikedTitles.length + ctx.avoidTitles.length > 0
      ? ["", `NICHT EINPLANEN: ${[...ctx.dislikedTitles, ...ctx.avoidTitles].join(", ")}`]
      : []),
    "",
    "SO FÜLLST DU DIE ANTWORT (meals, ein Eintrag pro Termin):",
    "- date und slot genau wie oben. title, summary (ein Satz), minutes (Gesamtzeit), servings, difficulty (leicht/mittel/schwer).",
    "- ingredients: alle Zutaten mit amount und unit für alle servings. pantry_ref = Nummer aus dem Vorrat oder null; bei Vorrat die Einheit des Vorrats verwenden.",
    `- unit ist eine von: ${RECIPE_UNITS.join(", ")}.`,
    "- Keine Zubereitungsschritte – die kommen später.",
  ];
  return { system: cookingSystemPrompt(prefs), prompt: lines.join("\n") };
}

export type PlannedMeal =
  | { date: string; slot: Slot; kind: "rezept"; recipe: FinalRecipe }
  | { date: string; slot: Slot; kind: "reste"; title: string; leftoversOf: { recipeId: string } | { title: string } };

export interface PlanResult {
  meals: PlannedMeal[];
  blocked: number;
  filtered: number;
}

const placeKey = (date: string, slot: string) => `${date}|${slot}`;

/**
 * Prüft den KI-Plan – unser Code entscheidet:
 * nur angefragte Termine, Sperrliste, schlecht Bewertetes raus, Zeitgrenze (bei Meal-Prep doppelt),
 * Reste nur von Gerichten, die vorher gekocht werden.
 */
export function finalizePlan(raw: (AiPlanMeal | null)[], ctx: PlanContext): PlanResult {
  const { prefs } = ctx;
  const customTerms = [...prefs.allergies, ...prefs.dislikes];
  const wanted = new Set(ctx.places.map((place) => placeKey(place.date, place.slot)));
  const disliked = new Set(ctx.dislikedTitles.map(normalizeName));
  const meals = raw.filter((meal): meal is AiPlanMeal => meal !== null).sort((a, b) => placeKey(a.date, a.slot).localeCompare(placeKey(b.date, b.slot)));
  // Gerichte, deren Reste später gegessen werden, dürfen länger dauern
  const prepped = new Set(meals.map((meal) => meal.leftovers_of).filter((t): t is string => Boolean(t)).map(normalizeName));

  let blocked = 0;
  let filtered = 0;
  const result: PlannedMeal[] = [];
  const used = new Set<string>();
  // Wovon kann es Reste geben? Bereits geplante Rezepte und neue Gerichte (jeweils mit Datum)
  const cookedBefore: { date: string; title: string; recipeId?: string }[] = ctx.fixed.map((f) => ({ date: f.date, title: f.title, recipeId: f.recipeId }));

  for (const meal of meals) {
    const key = placeKey(meal.date, meal.slot);
    if (!wanted.has(key) || used.has(key)) continue;

    const hit = findBlocked([meal.title, meal.summary, meal.leftovers_of, ...meal.ingredients.map((i) => i.name)], customTerms);
    if (hit) {
      console.warn(`Plan: „${meal.title}“ verworfen (Sperrliste: ${hit.term})`);
      blocked++;
      continue;
    }
    if (disliked.has(normalizeName(meal.title))) {
      filtered++;
      continue;
    }

    if (meal.leftovers_of) {
      const source = cookedBefore.find((c) => c.date < meal.date && normalizeName(c.title) === normalizeName(meal.leftovers_of!));
      if (!source) {
        filtered++;
        continue;
      }
      used.add(key);
      result.push({
        date: meal.date,
        slot: meal.slot,
        kind: "reste",
        title: source.title,
        leftoversOf: source.recipeId ? { recipeId: source.recipeId } : { title: source.title },
      });
      continue;
    }

    const base = baseMinutes(prefs, meal.date);
    const allowed = (prepped.has(normalizeName(meal.title)) ? base * 2 : base) + 10;
    if (meal.minutes > allowed || meal.ingredients.length === 0) {
      filtered++;
      continue;
    }

    used.add(key);
    cookedBefore.push({ date: meal.date, title: meal.title });
    result.push({
      date: meal.date,
      slot: meal.slot,
      kind: "rezept",
      recipe: {
        title: meal.title,
        summary: meal.summary,
        servings: meal.servings,
        minutes: meal.minutes,
        difficulty: meal.difficulty,
        ingredients: linkIngredients(meal.ingredients, ctx.pantry, prefs.staples),
        steps: [],
        mealPrep: null,
      },
    });
  }

  return { meals: result, blocked, filtered };
}

// ---------- Zubereitung nachträglich erstellen ----------

export const stepsSchema = z.object({
  steps: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(1000),
        timer_minutes: z.coerce.number().int().min(1).max(600).nullable().catch(null),
      }),
    )
    .min(1)
    .max(25),
  meal_prep: z
    .object({
      days: z.coerce.number().int().min(1).max(7),
      storage: z.string().trim().max(300),
      reheat: z.string().trim().max(300),
    })
    .nullable()
    .catch(null),
});

export function buildStepsTask(
  recipe: { title: string; servings: number; minutes: number; ingredients: RecipeIngredient[] },
  prefs: Preferences,
  mealPrep: boolean,
): { system: string; prompt: string } {
  const ingredients = recipe.ingredients.map((i) => `- ${i.amount ?? ""} ${i.unit ?? ""} ${i.name}`.replace(/\s+/g, " "));
  const prompt = [
    `Schreibe die Zubereitung für „${recipe.title}“ (${recipe.servings} Portionen, etwa ${recipe.minutes} Minuten).`,
    "Verwende genau diese Zutaten, keine weiteren außer Wasser:",
    ...ingredients,
    "",
    `Küchengeräte (nur diese): ${list(prefs.appliances)}`,
    "- steps: kurze, klare Schritte. timer_minutes nur bei Wartezeiten (backen, köcheln, ruhen lassen), sonst null.",
    mealPrep
      ? "- meal_prep: Das Gericht reicht für mehrere Tage. days (Tage im Kühlschrank), storage (lagern/einfrieren), reheat (aufwärmen, z. B. Mikrowelle oder Airfryer)."
      : "- meal_prep: null.",
  ].join("\n");
  return { system: cookingSystemPrompt(prefs), prompt };
}

/** Zubereitung prüfen: Sperrliste auch hier. Bei Treffer null (dann nicht speichern). */
export function finalizeSteps(
  answer: z.infer<typeof stepsSchema>,
  prefs: Preferences,
): { steps: RecipeStep[]; mealPrep: MealPrep | null } | null {
  const hit = findBlocked([...answer.steps.map((s) => s.text), answer.meal_prep?.storage, answer.meal_prep?.reheat], [...prefs.allergies, ...prefs.dislikes]);
  if (hit) {
    console.warn(`Zubereitung verworfen (Sperrliste: ${hit.term})`);
    return null;
  }
  return { steps: answer.steps.map((s) => ({ text: s.text, timerMinutes: s.timer_minutes })), mealPrep: answer.meal_prep };
}
