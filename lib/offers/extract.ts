// Prospektseite → Angebote: Aufgabe für die KI und Prüfung der Antwort.

import { z } from "zod";
import { addDays, formatDateDe } from "@/lib/dates";

/** „1,99“, „1.99 €“, „-.99“ → 1.99. Alles andere → null */
export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
  if (typeof value !== "string") return null;
  let text = value.replace(/[€\s]/g, "").replace(/^-\./, "0.").replace(/^\.-?/, "0.");
  // Deutsches Komma; Tausenderpunkte („1.299,00“) entfernen
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  text = text.replace(/-$/, "");
  const number = Number(text);
  return Number.isFinite(number) && number > 0 && number < 10000 ? Math.round(number * 100) / 100 : null;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const offerSchema = z.object({
  product: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80).nullable().catch(null),
  // Preise kommen als Zahl oder Text („1,99“) – geprüft wird später mit parsePrice
  price: z.union([z.number(), z.string()]).nullable().catch(null),
  unit_price: z.string().trim().max(60).nullable().catch(null),
  discount: z.string().trim().max(40).nullable().catch(null),
  is_food: z.boolean().catch(true),
});

export const offerPageSchema = z.object({
  valid_from: isoDate.nullable().catch(null),
  valid_to: isoDate.nullable().catch(null),
  offers: z.array(offerSchema.nullable().catch(null)).max(80),
});
export type OfferPage = z.infer<typeof offerPageSchema>;

export function offerPageTask(storeName: string, today: string) {
  return {
    system: "Du liest Supermarkt-Prospekte in Deutschland. Antworte auf Deutsch. Erfinde nichts: Was du nicht sicher lesen kannst, ist null.",
    prompt: [
      `Das Foto ist eine Seite aus dem Prospekt von ${storeName}. Heute ist der ${formatDateDe(today)}.`,
      "Liste jedes Angebot mit Preis auf dieser Seite:",
      "- product: Produktname, wie er im Prospekt steht (ohne Marke). brand: Marke oder null.",
      "- price: der große Aktionspreis in Euro als Zahl (z. B. 1.99) – NICHT der kleine Grundpreis pro kg/l. Schreibweisen: „-.89“ oder „.89“ = 0.89, „2.-“ = 2.00. Steht kein Preis dabei, null.",
      "- unit_price: Grundpreis wie gedruckt (z. B. „1 kg = 3,98 €“), sonst null. discount: Rabatt wie gedruckt (z. B. „-30 %“), sonst null.",
      "- is_food: true bei Lebensmitteln und Getränken, false bei allem anderen (Kleidung, Werkzeug, Deko …).",
      "- valid_from / valid_to: Gültigkeit der Angebote als JJJJ-MM-TT, wenn auf der Seite steht (z. B. „gültig ab Montag, 13.10.“). Fehlt das Jahr, nimm das aktuelle. Sonst null.",
    ].join("\n"),
  };
}

export interface OfferDraft {
  product: string;
  brand: string | null;
  price: number;
  unitPrice: string | null;
  discount: string | null;
  validFrom: string | null;
  validTo: string;
}

/**
 * KI-Antwort → Entwürfe zum Durchsehen. Nur Lebensmittel mit gültigem Preis.
 * Ohne erkanntes Enddatum gilt ein Angebot bis 6 Tage nach Beginn bzw. nach heute (Prospekte gelten meist eine Woche).
 * Unplausible Daten (mehr als 60 Tage weg) werden verworfen.
 */
export function offerDrafts(page: OfferPage, today: string): OfferDraft[] {
  const plausible = (date: string | null) => (date && date >= addDays(today, -14) && date <= addDays(today, 60) ? date : null);
  const validFrom = plausible(page.valid_from);
  let validTo = plausible(page.valid_to) ?? addDays(validFrom ?? today, 6);
  if (validFrom && validTo < validFrom) validTo = addDays(validFrom, 6);

  return page.offers.flatMap((offer) => {
    if (!offer || !offer.is_food) return [];
    const price = parsePrice(offer.price);
    if (price === null) return [];
    return [{ product: offer.product, brand: offer.brand || null, price, unitPrice: offer.unit_price || null, discount: offer.discount || null, validFrom, validTo }];
  });
}
