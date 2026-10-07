// „Was kann ich heute kochen?“: Aufgabe für die KI (Prompt + Antwort-Schema) und die
// Nachbearbeitung auf dem Server (Sperrliste, Filter, Sortierung nach Ablaufdatum).

import { z } from "zod";
import { FIXED_EXCLUSIONS, findBlocked } from "@/lib/allergens/blocklist";
import { formatDateDe, isWeekend } from "@/lib/dates";
import type { PantryEntry } from "@/lib/pantry/entry";
import { formatQuantity } from "@/lib/pantry/quantity";
import { normalizeName } from "@/lib/text";
import { findPantryMatch, isStaple, RECIPE_UNITS, type MealPrep, type RecipeIngredient, type RecipeStep } from "./ingredients";
import type { Preferences } from "./preferences";

/** So viele Vorschläge pro Anfrage (wegen des Gratis-Limits der KI pro Minute) */
export const SUGGESTION_COUNT = 3;
/** „Schnell“ heißt höchstens so viele Minuten */
export const QUICK_MINUTES = 20;

export interface SuggestFilters {
  /** Nur mit dem, was da ist: nichts darf fehlen (außer Grundvorrat) */
  onlyPantry: boolean;
  quick: boolean;
  mealPrep: boolean;
  /** „Das muss weg“: Vorrats-IDs, um die herum gekocht werden soll (höchstens 3) */
  mustUse: string[];
  /** Freier Wunsch, z. B. „was Warmes“ */
  wish: string;
}

/** Vorrats-Eintrag in der kurzen Form, die die KI bekommt. ref = Nummer in der Liste. */
export interface AiPantryItem {
  ref: number;
  id: string;
  name: string;
  quantity: number;
  unit: PantryEntry["unit"];
  daysLeft: number | null;
  dateType: PantryEntry["dateType"];
  opened: boolean;
}

/**
 * Was vom Vorrat darf die KI überhaupt sehen? Alles mit Erdnuss-Warnung (auch Spuren) und
 * alles, was auf der Sperrliste steht, bleibt draußen. Bald Ablaufendes kommt nach oben.
 */
export function pantryForAi(entries: PantryEntry[], customTerms: string[], limit = 80): AiPantryItem[] {
  return entries
    .filter((entry) => entry.allergenWarning !== "erdnuss" && entry.allergenWarning !== "spuren")
    .filter((entry) => !findBlocked([entry.name, entry.brand], customTerms))
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
    .slice(0, limit)
    .map((entry, index) => ({
      ref: index + 1,
      id: entry.id,
      name: entry.name,
      quantity: entry.quantity,
      unit: entry.unit,
      daysLeft: entry.daysLeft,
      dateType: entry.dateType,
      opened: entry.openedAt !== null,
    }));
}

/** Höchste Kochzeit: schnell = 20 Min., sonst laut Vorlieben (Wochenende länger), Meal-Prep doppelt */
export function maxMinutesFor(prefs: Pick<Preferences, "max_minutes_weekday" | "max_minutes_weekend">, filters: SuggestFilters, today: string): number {
  if (filters.quick) return QUICK_MINUTES;
  const base = isWeekend(today) ? prefs.max_minutes_weekend : prefs.max_minutes_weekday;
  return filters.mealPrep ? base * 2 : base;
}

// ---------- Antwort der KI ----------

const aiIngredient = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.coerce.number().positive().max(100000).nullable().catch(null),
  unit: z.enum(RECIPE_UNITS).nullable().catch(null),
  pantry_ref: z.coerce.number().int().positive().nullable().catch(null),
});

const aiRecipe = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(400).catch(""),
  servings: z.coerce.number().int().min(1).max(20).catch(2),
  minutes: z.coerce.number().int().min(1).max(600),
  difficulty: z.enum(["leicht", "mittel", "schwer"]).catch("mittel"),
  ingredients: z.array(aiIngredient).min(1).max(30),
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
export type AiRecipe = z.infer<typeof aiRecipe>;

// Ein kaputtes Rezept soll nicht die ganze Antwort ungültig machen: es wird zu null und fällt weg
export const suggestionSchema = z.object({ recipes: z.array(aiRecipe.nullable().catch(null)).max(6) });

// ---------- Prompt ----------

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function describeDays(item: AiPantryItem): string {
  const kind = item.dateType === "verbrauch" ? "Verbrauchsdatum" : "MHD";
  const opened = item.opened ? ", geöffnet" : "";
  if (item.daysLeft === null) return `ohne Datum${opened}`;
  if (item.daysLeft < 0) return `seit ${-item.daysLeft} Tagen abgelaufen (${kind})${opened}`;
  if (item.daysLeft === 0) return `läuft heute ab (${kind})${opened}`;
  return `noch ${item.daysLeft} Tage (${kind})${opened}`;
}

export interface SuggestContext {
  today: string;
  prefs: Preferences;
  pantry: AiPantryItem[];
  filters: SuggestFilters;
  /** Mit 👍 bewertet oder Favorit – als Anregung */
  likedTitles: string[];
  /** Mit 👎 bewertet – nie wieder vorschlagen */
  dislikedTitles: string[];
  /** Gerade schon vorgeschlagen – diesmal etwas anderes */
  recentTitles: string[];
  /** Aktuelle Angebote als kurze Zeilen (offersForAi) */
  offers: string[];
}

export const list = (items: string[]) => (items.length > 0 ? items.join(", ") : "keine Angabe");

/** Wochentag zu einem Datum, z. B. „Mittwoch“ */
export function weekdayName(isoDate: string): string {
  return WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
}

/** Feste Regeln für jede Koch-Anfrage an die KI: Sprache und alle Ausschlüsse */
export function cookingSystemPrompt(prefs: Pick<Preferences, "allergies" | "dislikes">): string {
  const exclusions = [...FIXED_EXCLUSIONS, ...prefs.allergies, ...prefs.dislikes];
  return [
    "Du bist der Kochassistent einer Küchen-App in Deutschland. Antworte auf Deutsch, mit deutschen Zutatennamen und Einheiten.",
    "HARTE AUSSCHLÜSSE – die Person hat eine sehr starke Erdnussallergie. Folgendes darf in keinem Rezept vorkommen, auch nicht als Deko, Variante oder Tipp.",
    "Erwähne diese Dinge überhaupt nicht, auch nicht verneint (kein „ohne Erdnüsse“):",
    ...exclusions.map((entry) => `- ${entry}`),
    "Verwende keine Fertigsaucen oder Nussmischungen, die oft Erdnuss enthalten.",
  ].join("\n");
}

/** Vorrat als kurze, nummerierte Liste für die KI */
export function pantryLines(pantry: AiPantryItem[]): string[] {
  return pantry.length > 0
    ? pantry.map((item) => `#${item.ref} ${item.name} – ${formatQuantity(item.quantity, item.unit)} – ${describeDays(item)}`)
    : ["(Der Vorrat ist leer.)"];
}

/** Angebote als Abschnitt für den Prompt (leer, wenn keine da sind) */
export function offerLines(offers: string[]): string[] {
  return offers.length > 0 ? ["", "AKTUELLE ANGEBOTE (gern nutzen, wenn es passt – fehlende Zutaten möglichst daraus):", ...offers.map((o) => `- ${o}`)] : [];
}

/** Vorlieben als Zeilen für die KI (ohne Portionen und Zeit, die hängen von der Aufgabe ab) */
export function preferenceLines(prefs: Preferences, likedTitles: string[]): string[] {
  return [
    `- Ernährung: ${prefs.diet}${prefs.diet_notes ? ` – ${prefs.diet_notes}` : ""}`,
    `- Lieblingsküchen: ${list(prefs.cuisines)}`,
    `- Ziele: ${list(prefs.goals)}`,
    `- Küchengeräte (nur diese verwenden): ${list(prefs.appliances)}`,
    ...(prefs.budget_week !== null ? [`- Budget: ca. ${prefs.budget_week} € pro Woche – günstige Zutaten bevorzugen`] : []),
    ...(likedTitles.length > 0 ? [`- Mag ich besonders (als Anregung): ${likedTitles.join(", ")}`] : []),
  ];
}

export function buildSuggestTask(ctx: SuggestContext): { system: string; prompt: string } {
  const { prefs, filters, today } = ctx;
  const maxMinutes = maxMinutesFor(prefs, filters, today);
  const weekday = weekdayName(today);
  const mustUse = ctx.pantry.filter((item) => filters.mustUse.includes(item.id));
  const system = cookingSystemPrompt(prefs);

  const wishes: string[] = [];
  if (filters.onlyPantry) wishes.push("Nur mit dem, was da ist: Jede Zutat muss aus dem Vorrat oder dem Grundvorrat kommen. Nichts darf fehlen.");
  if (filters.quick) wishes.push(`Schnell: höchstens ${QUICK_MINUTES} Minuten insgesamt.`);
  if (filters.mealPrep) {
    wishes.push(
      "Meal-Prep: Gerichte, die sich 2–4 Tage im Kühlschrank halten oder sich einfrieren lassen. Portionen so wählen, dass es für mehrere Tage reicht (je nachdem, wie viel im Vorrat ist).",
    );
  }
  if (mustUse.length > 0) {
    wishes.push(`Das muss weg: Jedes Gericht verwendet mindestens eins davon: ${mustUse.map((item) => `#${item.ref} ${item.name}`).join(", ")}.`);
  }
  if (filters.wish) wishes.push(`Wunsch: „${filters.wish}“`);

  const lines: string[] = [
    `Heute ist ${weekday}, der ${formatDateDe(today)}. Schlage genau ${SUGGESTION_COUNT} verschiedene Gerichte vor.`,
    "",
    "VORRAT (Nummer, Name, Menge, Haltbarkeit). Oben steht, was bald abläuft – das bitte bevorzugt verbrauchen:",
    ...pantryLines(ctx.pantry),
    "",
    `GRUNDVORRAT (immer da, steht nicht im Vorrat): ${list(prefs.staples)}`,
    ...offerLines(ctx.offers),
    "",
    "VORLIEBEN:",
    ...preferenceLines(prefs, ctx.likedTitles),
    filters.mealPrep
      ? `- Portionen: Meal-Prep, also mindestens ${Math.max(4, prefs.servings * 2)} Portionen für mehrere Tage (so viel, wie der Vorrat hergibt)`
      : `- Portionen: ${prefs.servings}`,
    `- Höchstens ${maxMinutes} Minuten insgesamt (Vorbereitung und Kochen)`,
    ...(wishes.length > 0 ? ["", "FÜR DIESMAL:", ...wishes.map((wish) => `- ${wish}`)] : []),
    ...(ctx.dislikedTitles.length + ctx.recentTitles.length > 0
      ? ["", `NICHT VORSCHLAGEN (schlecht bewertet oder gerade schon vorgeschlagen): ${[...ctx.dislikedTitles, ...ctx.recentTitles].join(", ")}`]
      : []),
    "",
    "SO FÜLLST DU DIE ANTWORT:",
    "- pantry_ref: die Nummer aus dem Vorrat, wenn die Zutat von dort kommt, sonst null. Dann die Menge in derselben Einheit wie im Vorrat angeben und nicht mehr, als da ist.",
    "- Zutaten aus dem Grundvorrat ganz normal aufführen, mit pantry_ref null.",
    `- unit ist eine von: ${RECIPE_UNITS.join(", ")}. amount ist eine Zahl (oder null bei „nach Geschmack“).`,
    "- steps: kurze, klare Schritte. timer_minutes nur bei Wartezeiten (backen, köcheln, ruhen lassen), sonst null.",
    "- minutes: Gesamtzeit. difficulty: leicht, mittel oder schwer. summary: ein Satz, warum das Gericht passt.",
    "- meal_prep nur bei Meal-Prep-Gerichten: days (Tage im Kühlschrank), storage (lagern/einfrieren), reheat (aufwärmen, z. B. Mikrowelle oder Airfryer). Sonst null.",
  ];

  return { system, prompt: lines.join("\n") };
}

// ---------- Nachbearbeitung ----------

export type AiIngredient = z.infer<typeof aiIngredient>;
export { aiIngredient };

/**
 * Zutaten der KI mit dem Vorrat verknüpfen: erst über die Nummer (pantry_ref), sonst über den
 * Namen. Grundvorrat bestimmt unsere eigene Liste, nicht die KI.
 */
export function linkIngredients(raw: AiIngredient[], pantry: AiPantryItem[], staples: string[]): RecipeIngredient[] {
  const byRef = new Map(pantry.map((item) => [item.ref, item]));
  return raw.map((ingredient) => {
    const fromRef = ingredient.pantry_ref !== null ? byRef.get(ingredient.pantry_ref) : undefined;
    const staple = isStaple(ingredient.name, staples);
    const match = fromRef ?? (staple ? null : findPantryMatch(ingredient.name, pantry));
    return {
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
      pantryItemId: match?.id ?? null,
      staple: !match && staple,
    };
  });
}

export interface FinalRecipe {
  title: string;
  summary: string;
  servings: number;
  minutes: number;
  difficulty: "leicht" | "mittel" | "schwer";
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  mealPrep: MealPrep | null;
}

export interface SuggestResult {
  recipes: FinalRecipe[];
  /** Wegen Sperrliste verworfen */
  blocked: number;
  /** Passte nicht zu den Filtern (Zeit, „nur was da ist“, schlecht bewertet) */
  filtered: number;
}

/** Wie dringend muss ein Vorrats-Eintrag weg? Abgelaufen/heute zählt am meisten. */
export function urgency(daysLeft: number | null): number {
  if (daysLeft === null) return 0.5;
  if (daysLeft <= 0) return 10;
  if (daysLeft === 1) return 6;
  if (daysLeft === 2) return 5;
  if (daysLeft === 3) return 4;
  if (daysLeft <= 7) return 2;
  return 1;
}

/**
 * Prüft und sortiert die KI-Vorschläge – unser Code entscheidet, nicht die KI:
 * 1. Sperrliste (Erdnuss, Kokos, eingelegter Fisch, eigene Allergien/Abneigungen) → verwerfen
 * 2. Schlecht bewertete Gerichte, zu lange Kochzeit, „nur was da ist“ verletzt → verwerfen
 * 3. Zutaten mit dem Vorrat verknüpfen, Grundvorrat erkennen
 * 4. Sortieren: „Das muss weg“ zuerst, dann wer am meisten Bald-Ablaufendes aufbraucht
 */
export function finalizeSuggestions(raw: (AiRecipe | null)[], ctx: SuggestContext): SuggestResult {
  const { prefs, filters, pantry } = ctx;
  const customTerms = [...prefs.allergies, ...prefs.dislikes];
  const maxMinutes = maxMinutesFor(prefs, filters, ctx.today);
  // Bei „schnell“ streng, sonst 10 Minuten Spielraum
  const allowedMinutes = filters.quick ? maxMinutes : maxMinutes + 10;
  const disliked = new Set(ctx.dislikedTitles.map(normalizeName));

  let blocked = 0;
  let filtered = 0;
  const scored: { recipe: FinalRecipe; mustUse: number; score: number; missing: number }[] = [];

  for (const recipe of raw) {
    if (!recipe) continue;

    const hit = findBlocked(
      [
        recipe.title,
        recipe.summary,
        ...recipe.ingredients.map((i) => i.name),
        ...recipe.steps.map((s) => s.text),
        recipe.meal_prep?.storage,
        recipe.meal_prep?.reheat,
      ],
      customTerms,
    );
    if (hit) {
      console.warn(`Vorschlag „${recipe.title}“ verworfen (Sperrliste: ${hit.term})`);
      blocked++;
      continue;
    }
    if (disliked.has(normalizeName(recipe.title)) || recipe.minutes > allowedMinutes) {
      filtered++;
      continue;
    }

    const ingredients = linkIngredients(recipe.ingredients, pantry, prefs.staples);

    const missing = ingredients.filter((i) => !i.pantryItemId && !i.staple).length;
    if (filters.onlyPantry && missing > 0) {
      filtered++;
      continue;
    }

    const usedIds = new Set(ingredients.map((i) => i.pantryItemId).filter((id): id is string => id !== null));
    const used = pantry.filter((item) => usedIds.has(item.id));
    scored.push({
      recipe: {
        title: recipe.title,
        summary: recipe.summary,
        servings: recipe.servings,
        minutes: recipe.minutes,
        difficulty: recipe.difficulty,
        ingredients,
        steps: recipe.steps.map((step) => ({ text: step.text, timerMinutes: step.timer_minutes })),
        mealPrep: recipe.meal_prep,
      },
      mustUse: filters.mustUse.filter((id) => usedIds.has(id)).length,
      score: used.reduce((sum, item) => sum + urgency(item.daysLeft), 0),
      missing,
    });
  }

  scored.sort((a, b) => b.mustUse - a.mustUse || b.score - a.score || a.missing - b.missing);
  return { recipes: scored.map((entry) => entry.recipe), blocked, filtered };
}
