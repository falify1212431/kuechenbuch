import { todayInBerlin } from "@/lib/dates";
import type { Offer } from "@/lib/offers/offers";
import type { Tables } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";
import { check } from "./basics";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type Store = Tables<"stores">;

/** Startwerte (abgesprochen am 07.10.2026). Die Links führen zu den Seiten der Märkte – herunterladen tust du selbst. */
export const DEFAULT_STORES = [
  { name: "Aldi Süd", flyer_url: "https://www.aldi-sued.de/", sort_order: 1 },
  { name: "Lidl", flyer_url: "https://www.lidl.de/prospekte", sort_order: 2 },
  { name: "Wasgau", flyer_url: "https://www.wasgau-ag.de/", sort_order: 3 },
];

/** Meine Märkte; beim ersten Mal werden die Startwerte angelegt */
export async function loadStores(supabase: Supabase): Promise<Store[]> {
  const fetchStores = async () => check(await supabase.from("stores").select("*").order("sort_order").order("name"), "Märkte laden");
  const stores = await fetchStores();
  if (stores.length > 0) return stores;
  const { error } = await supabase.from("stores").upsert(DEFAULT_STORES, { onConflict: "user_id,name", ignoreDuplicates: true });
  if (error) throw new Error(`Märkte anlegen fehlgeschlagen: ${error.message}`);
  return fetchStores();
}

/**
 * Aktuelle Angebote (heute oder später gültig) mit Marktnamen.
 * Abgelaufene werden dabei gleich gelöscht – so verschwinden sie automatisch.
 */
export async function loadOffers(supabase: Supabase): Promise<Offer[]> {
  const today = todayInBerlin();
  const { error: cleanupError } = await supabase.from("offers").delete().lt("valid_to", today);
  if (cleanupError) console.error("Alte Angebote löschen fehlgeschlagen:", cleanupError.message);

  const rows = check(
    await supabase.from("offers").select("*, store:stores(name)").gte("valid_to", today).order("valid_to"),
    "Angebote laden",
  );
  return rows.map((row) => ({
    id: row.id,
    storeName: row.store?.name ?? "Markt",
    product: row.product,
    brand: row.brand,
    price: Number(row.price),
    unitPrice: row.unit_price,
    discount: row.discount,
    validFrom: row.valid_from,
    validTo: row.valid_to,
  }));
}
