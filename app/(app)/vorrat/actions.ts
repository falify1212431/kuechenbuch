"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mentionsPeanut } from "@/lib/allergens/peanut";
import { addToShoppingList } from "@/lib/data/shopping";
import { todayInBerlin } from "@/lib/dates";
import { applyRemaining, UNITS } from "@/lib/pantry/quantity";
import { estimateDate, matchShelfLife } from "@/lib/pantry/shelf-life";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string };

// Leeres Formularfeld → null
const optionalText = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => value || null);
const optionalId = z
  .string()
  .optional()
  .transform((value) => value || null)
  .refine((value) => value === null || z.uuid().safeParse(value).success, "Ungültige Auswahl.");
const optionalDate = z
  .string()
  .optional()
  .transform((value) => value || null)
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), "Ungültiges Datum.");

// So muss ein Vorrats-Eintrag aus dem Formular aussehen, sonst wird er abgelehnt
const itemSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1, "Bitte gib einen Namen ein.").max(100, "Der Name ist zu lang."),
  brand: optionalText,
  quantity: z.coerce.number("Bitte gib eine Menge ein.").positive("Die Menge muss größer als 0 sein.").max(100000),
  unit: z.enum(UNITS),
  category_id: optionalId,
  location_id: optionalId,
  date: optionalDate,
  date_type: z.enum(["mhd", "verbrauch"]),
  // Das bisherige Datum, falls es geschätzt war (beim Bearbeiten)
  estimated_date: optionalDate,
});

/** Neuen Eintrag anlegen oder bestehenden ändern */
export async function savePantryItem(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, estimated_date, ...values } = parsed.data;

  const supabase = await createClient();

  // Kein Datum eingegeben? Dann nach Faustregel schätzen.
  let date = values.date;
  let estimated = date !== null && date === estimated_date;
  if (!date) {
    const { data: rules } = await supabase.from("shelf_life_rules").select("*");
    const shelfLife = matchShelfLife(
      { name: values.name, categoryId: values.category_id, locationId: values.location_id },
      rules ?? [],
    );
    date = estimateDate(todayInBerlin(), shelfLife);
    estimated = date !== null;
  }

  const row = {
    ...values,
    date,
    date_estimated: estimated,
    // Erdnuss im Namen? Dann immer rot warnen, auch bei Einträgen von Hand
    ...(mentionsPeanut(values.name) ? { allergen_warning: "erdnuss" } : {}),
  };
  const { error } = id
    ? await supabase.from("pantry_items").update(row).eq("id", id)
    : await supabase.from("pantry_items").insert(row);
  if (error) return { error: `Speichern hat nicht geklappt: ${error.message}` };

  revalidatePath("/vorrat");
  redirect("/vorrat");
}

/** Verbraucht oder weggeworfen: Eintrag verschwindet aus dem Vorrat (bleibt für die Statistik gespeichert) */
export async function setStatus(id: string, status: "verbraucht" | "weggeworfen") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pantry_items")
    .update({ status, status_changed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Ändern hat nicht geklappt: ${error.message}`);
  revalidatePath("/vorrat");
  redirect(`/vorrat?hinweis=${status}`);
}

/** „Geöffnet“ setzen oder zurücknehmen */
export async function setOpened(id: string, opened: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pantry_items")
    .update({ opened_at: opened ? todayInBerlin() : null })
    .eq("id", id);
  if (error) throw new Error(`Ändern hat nicht geklappt: ${error.message}`);
  revalidatePath("/vorrat");
  revalidatePath(`/vorrat/${id}`);
}

/** „Teilweise verbraucht“: neue Restmenge aus dem Schieberegler */
export async function setRemaining(id: string, formData: FormData) {
  const remaining = Number(formData.get("remaining"));
  const supabase = await createClient();
  const { data: item, error } = await supabase.from("pantry_items").select("quantity").eq("id", id).single();
  if (error) throw new Error(`Laden hat nicht geklappt: ${error.message}`);

  const result = applyRemaining(Number(item.quantity), remaining);
  if (result.usedUp) return setStatus(id, "verbraucht");

  const { error: updateError } = await supabase
    .from("pantry_items")
    .update({ quantity: result.quantity })
    .eq("id", id);
  if (updateError) throw new Error(`Ändern hat nicht geklappt: ${updateError.message}`);
  revalidatePath("/vorrat");
  revalidatePath(`/vorrat/${id}`);
}

/** „Nachkaufen“: setzt den Eintrag auf die Einkaufsliste */
export async function rebuy(id: string) {
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("pantry_items")
    .select("name, unit, category_id")
    .eq("id", id)
    .single();
  if (error) throw new Error(`Laden hat nicht geklappt: ${error.message}`);

  // Eine Packung bzw. ein Stück – Gramm-Angaben vom alten Eintrag passen selten
  const result = await addToShoppingList(supabase, {
    name: item.name,
    quantity: 1,
    unit: item.unit === "Stück" ? "Stück" : "Packung",
    category_id: item.category_id,
    source: "nachkaufen",
  });
  if (result.error) throw new Error(`Nachkaufen hat nicht geklappt: ${result.error}`);
  revalidatePath("/einkauf");
  redirect(`/vorrat/${id}?hinweis=nachkaufen`);
}
