"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addToShoppingList, guessCategoryId } from "@/lib/data/shopping";
import { todayInBerlin } from "@/lib/dates";
import { UNITS } from "@/lib/pantry/quantity";
import { estimateDate, matchShelfLife } from "@/lib/pantry/shelf-life";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: number };

const isUuid = (value: string) => z.uuid().safeParse(value).success;
const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const addSchema = z.object({
  name: z.string().trim().min(1, "Was soll auf die Liste?").max(100, "Der Name ist zu lang."),
  quantity: z.coerce.number().positive("Die Menge muss größer als 0 sein.").max(100000),
  unit: z.enum(UNITS),
  category_id: z
    .string()
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || isUuid(value), "Ungültige Kategorie."),
});

/** Etwas von Hand auf die Liste setzen. Doppelte werden zusammengeführt. */
export async function addShoppingItem(previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = addSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const values = parsed.data;

  const supabase = await createClient();

  // Keine Kategorie gewählt? Dann die vom letzten gleichnamigen Vorrats-Eintrag nehmen.
  const categoryId = values.category_id ?? (await guessCategoryId(supabase, values.name));

  const result = await addToShoppingList(supabase, { ...values, category_id: categoryId, source: "hand" });
  if (result.error) return { error: `Speichern hat nicht geklappt: ${result.error}` };

  revalidatePath("/einkauf");
  // „ok“ zählt hoch, damit das Formular weiß: geklappt, Felder leeren
  return { ok: (previous.ok ?? 0) + 1 };
}

/** Abhaken oder wieder zurücknehmen */
export async function toggleChecked(id: string, checked: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("shopping_items").update({ checked }).eq("id", id);
  if (error) throw new Error(`Ändern hat nicht geklappt: ${error.message}`);
  revalidatePath("/einkauf");
}

/** Zeile löschen */
export async function removeShoppingItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("shopping_items").delete().eq("id", id);
  if (error) throw new Error(`Löschen hat nicht geklappt: ${error.message}`);
  revalidatePath("/einkauf");
}

/**
 * „Einräumen“: Abgehakte Sachen wandern in den Vorrat. Datum, Datumsart und Lagerort
 * kommen aus dem Formular. Ohne Datum wird geschätzt.
 */
export async function stockCheckedItems(formData: FormData) {
  const ids = formData.getAll("id").map(String).filter(isUuid);
  if (ids.length === 0) redirect("/einkauf");

  const supabase = await createClient();
  const [{ data: items, error }, { data: rules }] = await Promise.all([
    supabase.from("shopping_items").select("*").in("id", ids).eq("checked", true),
    supabase.from("shelf_life_rules").select("*"),
  ]);
  if (error) throw new Error(`Laden hat nicht geklappt: ${error.message}`);

  const today = todayInBerlin();
  const rows = items.map((item) => {
    const field = (name: string) => String(formData.get(`${name}:${item.id}`) ?? "");
    const locationId = isUuid(field("location")) ? field("location") : null;
    const dateType: "mhd" | "verbrauch" = field("type") === "verbrauch" ? "verbrauch" : "mhd";

    let date: string | null = isIsoDate(field("date")) ? field("date") : null;
    let estimated = false;
    // Leer oder unveränderter Vorschlag: neu schätzen, und zwar mit dem gewählten Lagerort
    // (Hack im Tiefkühler hält länger als im Kühlschrank)
    if (!date || date === field("estimated")) {
      const shelfLife = matchShelfLife(
        { name: item.name, categoryId: item.category_id, locationId },
        rules ?? [],
      );
      date = estimateDate(today, shelfLife);
      estimated = date !== null;
    }

    return {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category_id: item.category_id,
      location_id: locationId,
      date,
      date_type: dateType,
      date_estimated: estimated,
    };
  });

  const { error: insertError } = await supabase.from("pantry_items").insert(rows);
  if (insertError) throw new Error(`Einräumen hat nicht geklappt: ${insertError.message}`);

  const { error: deleteError } = await supabase.from("shopping_items").delete().in("id", items.map((item) => item.id));
  if (deleteError) throw new Error(`Aufräumen der Liste hat nicht geklappt: ${deleteError.message}`);

  revalidatePath("/einkauf");
  revalidatePath("/vorrat");
  redirect(`/vorrat?hinweis=eingeraeumt`);
}
