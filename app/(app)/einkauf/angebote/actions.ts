"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addToShoppingList, guessCategoryId } from "@/lib/data/shopping";
import { addDays, todayInBerlin } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const draftSchema = z
  .object({
    product: z.string().trim().min(1).max(120),
    brand: z.string().trim().max(80).nullable(),
    price: z.number().positive().max(10000),
    unitPrice: z.string().trim().max(60).nullable(),
    discount: z.string().trim().max(40).nullable(),
    validFrom: isoDate.nullable(),
    validTo: isoDate,
  })
  .refine((draft) => !draft.validFrom || draft.validFrom <= draft.validTo, "„Gültig ab“ liegt nach „gültig bis“.");

/** Durchgesehene Angebote speichern (nach dem Einlesen eines Prospekts) */
export async function saveOffers(storeId: string, pages: number, drafts: unknown): Promise<{ error?: string; saved?: number }> {
  const parsed = z
    .object({ storeId: z.uuid(), pages: z.number().int().min(1).max(100), drafts: z.array(draftSchema).min(1, "Nichts ausgewählt.").max(500) })
    .safeParse({ storeId, pages, drafts });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const today = todayInBerlin();
  if (parsed.data.drafts.some((d) => d.validTo < today || d.validTo > addDays(today, 90))) {
    return { error: "Bitte prüf die Daten: „gültig bis“ muss zwischen heute und in 90 Tagen liegen." };
  }

  const supabase = await createClient();
  const { data: upload, error } = await supabase.from("flyer_uploads").insert({ store_id: storeId, pages }).select("id").single();
  if (error) return { error: `Speichern hat nicht geklappt: ${error.message}` };

  const { error: offersError } = await supabase.from("offers").insert(
    parsed.data.drafts.map((d) => ({
      store_id: storeId,
      flyer_upload_id: upload.id,
      product: d.product,
      brand: d.brand || null,
      price: d.price,
      unit_price: d.unitPrice || null,
      discount: d.discount || null,
      valid_from: d.validFrom,
      valid_to: d.validTo,
    })),
  );
  if (offersError) return { error: `Speichern hat nicht geklappt: ${offersError.message}` };

  revalidatePath("/einkauf");
  revalidatePath("/einkauf/angebote");
  return { saved: parsed.data.drafts.length };
}

/** Angebot auf die Einkaufsliste (Quelle „angebot“, mit Verweis aufs Angebot) */
export async function addOfferToShopping(offerId: string) {
  const supabase = await createClient();
  const { data: offer } = await supabase.from("offers").select("id, product").eq("id", offerId).maybeSingle();
  if (!offer) throw new Error("Angebot nicht gefunden – vielleicht schon abgelaufen.");
  const result = await addToShoppingList(supabase, {
    name: offer.product,
    quantity: 1,
    unit: "Packung",
    category_id: await guessCategoryId(supabase, offer.product),
    source: "angebot",
    offer_id: offer.id,
  });
  if (result.error) throw new Error(`Einkaufsliste: ${result.error}`);
  revalidatePath("/einkauf");
  revalidatePath("/einkauf/angebote");
}

/** Angebot löschen (z. B. falsch erkannt) */
export async function deleteOffer(offerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("offers").delete().eq("id", offerId);
  if (error) throw new Error(`Löschen hat nicht geklappt: ${error.message}`);
  revalidatePath("/einkauf");
  revalidatePath("/einkauf/angebote");
}
