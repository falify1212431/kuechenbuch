// Meine Vorlieben: Startwerte („Meine Angaben“ aus der SPEC) und Prüfung des Formulars.

import { z } from "zod";
import { SLOTS, type Slot } from "@/lib/plan/week";

export const DIETS = ["alles", "vegetarisch", "vegan", "pescetarisch", "flexitarisch"] as const;
export type Diet = (typeof DIETS)[number];

/** Diese Allergie steht immer drin und lässt sich nicht löschen */
export const FIXED_ALLERGY = "Erdnuss";

/** Vorschläge zum Ankreuzen; eigene Einträge gehen zusätzlich */
export const GOAL_OPTIONS = ["naturbelassen", "Meal-Prep für mehrere Tage", "proteinreich", "günstig", "viel Gemüse", "leicht"];
export const APPLIANCE_OPTIONS = ["Herd", "Backofen", "Mikrowelle", "Airfryer (Ninja Double Stack)", "Mixer"];
export const CUISINE_OPTIONS = ["Hausmannskost", "italienisch", "asiatisch", "mediterran", "mexikanisch", "orientalisch"];

export interface Preferences {
  diet: Diet;
  diet_notes: string;
  allergies: string[];
  dislikes: string[];
  cuisines: string[];
  goals: string[];
  servings: number;
  max_minutes_weekday: number;
  max_minutes_weekend: number;
  budget_week: number | null;
  appliances: string[];
  staples: string[];
  /** Welche Mahlzeiten der Wochenplan füllt */
  meal_slots: Slot[];
  /** PLZ oder Ort für regionale Angebote */
  plz: string | null;
}

/** Startwerte aus der SPEC, abgesprochen am 07.10.2026 */
export const DEFAULT_PREFERENCES: Preferences = {
  diet: "alles",
  diet_notes:
    "Ausgewogen und gesund, möglichst naturbelassen. Bio und naturbelassene Produkte bevorzugen, gern die Reihe „Nur Nur Natur“ von Aldi. Wenig Fertigprodukte.",
  allergies: [FIXED_ALLERGY],
  dislikes: ["Kokos", "saurer Fisch", "eingelegter Fisch", "Rollmops", "Bismarckhering", "Matjes", "Sardellen"],
  cuisines: [],
  goals: ["naturbelassen", "Meal-Prep für mehrere Tage"],
  servings: 2,
  max_minutes_weekday: 30,
  max_minutes_weekend: 60,
  budget_week: 80,
  appliances: [...APPLIANCE_OPTIONS],
  staples: ["Salz", "Pfeffer", "Öl", "Zucker", "Mehl", "Essig", "Gemüsebrühe", "Paprikapulver", "getrocknete Kräuter"],
  // Absprache 07.10.2026: jeden Tag nur das Abendessen als Hauptgericht planen
  meal_slots: ["abend"],
  plz: "Kaiserslautern",
};

/**
 * Liste aus dem Formular: angekreuzte Felder plus Textfeld (ein Eintrag pro Zeile oder mit Komma).
 * Leere und doppelte Einträge fallen weg, jeder Eintrag höchstens 60 Zeichen, höchstens 40 Einträge.
 */
export function parseList(checked: string[], text = ""): string[] {
  const all = [...checked, ...text.split(/[\n,;]/)].map((entry) => entry.trim().slice(0, 60)).filter(Boolean);
  const seen = new Set<string>();
  return all
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
}

/** Mahlzeiten aus dem Formular; mindestens eine, sonst Abend */
export function parseSlots(values: string[]): Slot[] {
  const slots = SLOTS.filter((slot) => values.includes(slot));
  return slots.length > 0 ? slots : ["abend"];
}

/** Erdnuss muss immer in den Allergien stehen – egal was im Formular ankommt */
export function withFixedAllergy(allergies: string[]): string[] {
  const has = allergies.some((entry) => entry.toLowerCase().includes("erdnuss"));
  return has ? allergies : [FIXED_ALLERGY, ...allergies];
}

const minutes = z.coerce.number("Bitte eine Zahl eingeben.").int().min(5, "Mindestens 5 Minuten.").max(300, "Höchstens 300 Minuten.");

/** Prüft die Zahlen- und Auswahlfelder des Formulars (Listen kommen über parseList) */
export const preferencesFormSchema = z.object({
  diet: z.enum(DIETS),
  diet_notes: z.string().trim().max(500, "Die Notiz ist zu lang (höchstens 500 Zeichen)."),
  servings: z.coerce.number("Bitte eine Zahl eingeben.").int().min(1, "Mindestens 1 Portion.").max(12, "Höchstens 12 Portionen."),
  max_minutes_weekday: minutes,
  max_minutes_weekend: minutes,
  budget_week: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value.replace(",", "."))))
    .refine((value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 10000), "Bitte ein gültiges Budget in Euro."),
});
