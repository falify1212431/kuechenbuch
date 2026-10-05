"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mentionsPeanut } from "@/lib/allergens/peanut";
import { UNITS } from "@/lib/pantry/quantity";
import { createClient } from "@/lib/supabase/server";

const nullableId = z.uuid().nullable();
const candidateSchema = z.object({
  barcode: z
    .string()
    .regex(/^\d{8,14}$/)
    .nullable(),
  name: z.string().trim().min(1).max(100),
  brand: z.string().trim().max(100).nullable(),
  quantity: z.number().positive().max(100000),
  unit: z.enum(UNITS),
  categoryId: nullableId,
  locationId: nullableId,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  dateType: z.enum(["mhd", "verbrauch"]),
  dateEstimated: z.boolean(),
  peanut: z.enum(["erdnuss", "spuren", "ungeprueft", "frei"]).nullable(),
});

export type SaveInput = z.input<typeof candidateSchema>;

/**
 * Bestätigte Scan-Ergebnisse in den Vorrat übernehmen.
 * Beim Kassenbon werden passende Zeilen der Einkaufsliste als erledigt entfernt.
 */
export async function saveScanned(
  candidates: SaveInput[],
  removeShoppingIds: string[] = [],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const parsed = z.array(candidateSchema).min(1).max(60).safeParse(candidates);
  if (!parsed.success) return { ok: false, error: "Bitte prüf die Angaben (Name und Menge müssen ausgefüllt sein)." };
  const shoppingIds = z.array(z.uuid()).max(100).safeParse(removeShoppingIds);

  const rows = parsed.data.map((c) => ({
    barcode: c.barcode,
    name: c.name,
    brand: c.brand,
    quantity: c.quantity,
    unit: c.unit,
    category_id: c.categoryId,
    location_id: c.locationId,
    date: c.date,
    date_type: c.dateType,
    date_estimated: c.dateEstimated && c.date !== null,
    // Auch wenn ich den Namen geändert habe: Erdnuss im Namen ist immer eine Warnung
    allergen_warning: mentionsPeanut(c.name) ? "erdnuss" : c.peanut === "frei" ? null : c.peanut,
  }));

  const supabase = await createClient();
  const { error } = await supabase.from("pantry_items").insert(rows);
  if (error) return { ok: false, error: `Speichern hat nicht geklappt: ${error.message}` };

  if (shoppingIds.success && shoppingIds.data.length > 0) {
    await supabase.from("shopping_items").delete().in("id", shoppingIds.data);
    revalidatePath("/einkauf");
  }
  revalidatePath("/vorrat");
  return { ok: true, count: rows.length };
}
