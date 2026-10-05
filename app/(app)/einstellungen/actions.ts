"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { moveInList } from "@/lib/order";
import { createClient } from "@/lib/supabase/server";

type Table = "categories" | "locations";

const entrySchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z
    .string()
    .trim()
    .max(8)
    .optional()
    .transform((value) => value || null),
});

const optionalId = z
  .string()
  .optional()
  .transform((value) => value || null)
  .refine((value) => value === null || z.uuid().safeParse(value).success);

// Kategorien und Lagerorte haben dieselben Grundspalten (id, name, icon, sort_order).
// Für TypeScript behandeln wir deshalb beide wie „categories“.
async function tableQuery(table: Table) {
  const supabase = await createClient();
  return () => supabase.from(table as "categories");
}

// Nach jeder Änderung: alle Seiten neu laden, die Kategorien oder Lagerorte anzeigen
function refreshPages() {
  revalidatePath("/einstellungen");
  revalidatePath("/vorrat", "layout");
  revalidatePath("/einkauf", "layout");
}

// Fehler „Name gibt es schon“ (Datenbank-Code 23505) verständlich melden
function failed(error: { code?: string; message: string }): never {
  redirect(`/einstellungen?fehler=${error.code === "23505" ? "doppelt" : "speichern"}`);
}

/** Name, Symbol und (bei Kategorien) typischen Lagerort ändern */
export async function updateEntry(table: Table, id: string, formData: FormData) {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/einstellungen?fehler=name");

  const changes: { name: string; icon: string | null; default_location_id?: string | null } = parsed.data;
  if (table === "categories") {
    const location = optionalId.safeParse(formData.get("default_location_id") ?? "");
    changes.default_location_id = location.success ? location.data : null;
  }

  const query = await tableQuery(table);
  const { error } = await query().update(changes).eq("id", id);
  if (error) failed(error);
  refreshPages();
}

/** Neue Kategorie bzw. neuen Lagerort ans Ende anhängen */
export async function addEntry(table: Table, formData: FormData) {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/einstellungen?fehler=name");

  const query = await tableQuery(table);
  const { count } = await query().select("id", { count: "exact", head: true });
  const position = (count ?? 0) + 1;
  const row =
    table === "categories"
      ? { ...parsed.data, sort_order: position, aisle_order: position }
      : { ...parsed.data, sort_order: position };

  const { error } = await query().insert(row);
  if (error) failed(error);
  refreshPages();
}

/** Löschen. Einträge im Vorrat bleiben erhalten und landen in „Ohne Kategorie/Lagerort“. */
export async function deleteEntry(table: Table, id: string) {
  const query = await tableQuery(table);
  const { error } = await query().delete().eq("id", id);
  if (error) failed(error);
  refreshPages();
}

/** Eine Stelle nach oben oder unten schieben – in der Vorrats- oder der Laden-Reihenfolge */
export async function moveEntry(table: Table, field: "sort_order" | "aisle_order", id: string, direction: -1 | 1) {
  if (table === "locations" && field === "aisle_order") return;

  const query = await tableQuery(table);
  const { data, error } = await query().select("id").order(field).order("name");
  if (error) failed(error);

  const order = moveInList(
    data.map((row) => row.id),
    id,
    direction,
  );
  if (!order) return;

  // Alle neu durchnummerieren (1, 2, 3 …), damit es keine doppelten Plätze gibt
  const results = await Promise.all(
    order.map((rowId, index) => {
      const change = field === "sort_order" ? { sort_order: index + 1 } : { aisle_order: index + 1 };
      return query().update(change).eq("id", rowId);
    }),
  );
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) failed(firstError);
  refreshPages();
}
