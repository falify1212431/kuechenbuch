// Die Aufgaben für die KI beim Scannen: Antwort-Schema (zod) und Anleitung (Prompt) je Modus.

import { z } from "zod";
import { formatDateDe } from "@/lib/dates";
import { UNITS } from "@/lib/pantry/quantity";

export const SCAN_MODES = ["datum", "produkt", "lose-ware", "kassenbon"] as const;
export type ScanMode = (typeof SCAN_MODES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const unit = z.enum(UNITS).catch("Stück");

export const dateSchema = z.object({
  date: isoDate.nullable(),
  date_type: z.enum(["mhd", "verbrauch"]).nullable(),
  read_text: z.string().max(200).nullable(),
});

export const productSchema = z.object({
  name: z.string().trim().min(1).max(100),
  brand: z.string().trim().max(100).nullable(),
  quantity: z.coerce.number().positive().nullable(),
  unit: unit.nullable(),
  category: z.string().nullable(),
});

const itemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.coerce.number().positive().catch(1),
  unit,
  category: z.string().nullable(),
  shelf_life_days: z.coerce.number().int().min(0).max(1000).nullable().catch(null),
});

export const looseSchema = z.object({ items: z.array(itemSchema).max(30) });

export const receiptSchema = z.object({
  items: z.array(itemSchema.extend({ is_food: z.boolean().catch(true) })).max(60),
});

const BASE_RULES =
  "Du hilfst einer Küchen-App in Deutschland. Antworte auf Deutsch. Erfinde nichts: Was du nicht sicher erkennst, gibst du als null an.";

const units = UNITS.join(", ");

export function taskFor(mode: ScanMode, today: string, categoryNames: string[]) {
  const categories = categoryNames.join(" | ");
  switch (mode) {
    case "datum":
      return {
        schema: dateSchema,
        system: BASE_RULES,
        prompt:
          `Auf dem Foto ist der Datumsaufdruck einer Lebensmittelpackung. Heute ist der ${formatDateDe(today)}. ` +
          "Lies das Ablaufdatum und gib es als JJJJ-MM-TT an (date). Zweistellige Jahre gehören zum 21. Jahrhundert. " +
          "Steht nur Monat und Jahr da, nimm den letzten Tag des Monats. " +
          '„Mindestens haltbar bis“ oder „MHD“ = "mhd", „Zu verbrauchen bis“ = "verbrauch", sonst null (date_type). ' +
          "read_text ist der Text, den du gelesen hast. Ist kein Datum lesbar, ist date null.",
      };
    case "produkt":
      return {
        schema: productSchema,
        system: BASE_RULES,
        prompt:
          "Auf dem Foto ist eine Lebensmittelpackung. Erkenne das Produkt: kurzer deutscher Name (name), Marke (brand), " +
          `Füllmenge (quantity) mit Einheit (unit, eine von: ${units}; kg und l in g und ml umrechnen) ` +
          `und die passende Kategorie (category, genau eine von: ${categories}).`,
      };
    case "lose-ware":
      return {
        schema: looseSchema,
        system: BASE_RULES,
        prompt:
          "Auf dem Foto sind lose Lebensmittel (z. B. Obst und Gemüse), oft mehrere verschiedene. " +
          "Liste jede Sorte einmal auf (items): deutscher Name in Mehrzahl, wenn es mehrere sind (name), " +
          `geschätzte Anzahl oder Menge (quantity, unit: ${units}), Kategorie (category, genau eine von: ${categories}) ` +
          "und wie viele Tage es ungefähr hält, ab heute (shelf_life_days).",
      };
    case "kassenbon":
      return {
        schema: receiptSchema,
        system: BASE_RULES,
        prompt:
          "Auf dem Foto ist ein deutscher Supermarkt-Kassenbon. Mach aus jeder Position einen Eintrag (items): " +
          "verständlicher deutscher Name ohne Abkürzungen (aus „H-MILCH 1,5% 1L“ wird „H-Milch 1,5 %“), " +
          `Menge (quantity) und Einheit (unit: ${units}), Kategorie (category, genau eine von: ${categories}), ` +
          "ungefähre Haltbarkeit in Tagen ab heute (shelf_life_days) und ob es ein Lebensmittel ist (is_food; " +
          "Pfand, Tüten, Drogerie und Rabatte sind false). Mengenangaben wie „2 x“ in quantity übernehmen.",
      };
  }
}
