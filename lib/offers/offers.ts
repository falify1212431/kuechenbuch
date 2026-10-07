// Angebote nutzen: gültig?, passt zu einem Eintrag?, kurze Liste für die KI.

import { findBlocked } from "@/lib/allergens/blocklist";
import { nameKey } from "@/lib/cooking/ingredients";
import { addDays, daysBetween, formatDateDe } from "@/lib/dates";
import { formatDayShort } from "@/lib/plan/week";
import { normalizeName } from "@/lib/text";

export interface Offer {
  id: string;
  storeName: string;
  product: string;
  brand: string | null;
  price: number;
  unitPrice: string | null;
  discount: string | null;
  validFrom: string | null;
  validTo: string;
}

/** Gilt das Angebot heute noch (oder fängt es in den nächsten Tagen an)? */
export function isCurrent(offer: Pick<Offer, "validTo">, today: string): boolean {
  return offer.validTo >= today;
}

/** „0,99 €“ */
export function formatPrice(price: number): string {
  return price.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/** „bis Sa“, „bis Sa 18.10.“ oder „ab Mo 13.10.“ */
export function validityLabel(offer: Pick<Offer, "validFrom" | "validTo">, today: string): string {
  if (offer.validFrom && offer.validFrom > today) return `ab ${formatDayShort(offer.validFrom)}`;
  if (offer.validTo === today) return "nur noch heute";
  const day = formatDayShort(offer.validTo);
  return daysBetween(today, offer.validTo) <= 6 ? `bis ${day.slice(0, 2)}` : `bis ${day}`;
}

/** „Aldi: 0,99 € bis Sa“ */
export function offerShortLabel(offer: Offer, today: string): string {
  return `${offer.storeName}: ${formatPrice(offer.price)} ${validityLabel(offer, today)}`;
}

/** Wörter im Produktnamen, grob auf die Grundform gebracht */
function words(text: string): string[] {
  return normalizeName(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3)
    .map((word) => nameKey(word));
}

/**
 * Passt das Angebot zu einem Eintrag (z. B. auf der Einkaufsliste)?
 * „Haferflocken“ ↔ „Bio Haferflocken zart“, „Zwiebel“ ↔ „Gemüsezwiebeln“.
 * Kurze Namen (< 4 Buchstaben) passen nur als ganzes Wort.
 */
export function offerMatches(itemName: string, offer: Pick<Offer, "product">): boolean {
  const item = nameKey(itemName);
  if (item.length < 3) return false;
  const productWords = words(offer.product);
  if (item.length < 4) return productWords.includes(item);
  const itemWords = words(itemName);
  // Alle wichtigen Wörter des Eintrags müssen im Produkt vorkommen (auch als Wortteil)
  return itemWords.length > 0 && itemWords.every((w) => productWords.some((p) => p.includes(w)));
}

/** Das günstigste aktuelle Angebot zu einem Eintrag */
export function bestOffer(itemName: string, offers: Offer[], today: string): Offer | null {
  return (
    offers
      .filter((offer) => isCurrent(offer, today) && offerMatches(itemName, offer))
      .sort((a, b) => a.price - b.price)[0] ?? null
  );
}

/**
 * Angebote für die KI (Kochvorschläge, Wochenplan): nur aktuelle, nichts von der Sperrliste,
 * höchstens `limit` Stück, die bald endenden zuerst.
 */
export function offersForAi(offers: Offer[], today: string, customTerms: string[], limit = 40): string[] {
  return offers
    .filter((offer) => isCurrent(offer, today) && (!offer.validFrom || offer.validFrom <= addDays(today, 6)))
    .filter((offer) => !findBlocked([offer.product, offer.brand], customTerms))
    .sort((a, b) => a.validTo.localeCompare(b.validTo))
    .slice(0, limit)
    .map((offer) => `${offer.storeName}: ${offer.product}${offer.brand ? ` (${offer.brand})` : ""} ${formatPrice(offer.price)}${offer.unitPrice ? `, ${offer.unitPrice}` : ""} – ${offer.validFrom && offer.validFrom > today ? `ab ${formatDateDe(offer.validFrom)}, ` : ""}bis ${formatDateDe(offer.validTo)}`);
}
