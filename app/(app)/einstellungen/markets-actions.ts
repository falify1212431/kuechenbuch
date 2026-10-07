"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const storeSchema = z.object({
  name: z.string().trim().min(1).max(40),
  // Leer = kein Link; sonst nur https-Adressen
  flyer_url: z
    .string()
    .trim()
    .max(300)
    .transform((value) => value || null)
    .refine((value) => value === null || /^https:\/\/[^\s]+$/.test(value)),
});

function done(error?: string) {
  revalidatePath("/einstellungen");
  revalidatePath("/einkauf/angebote");
  redirect(error ? `/einstellungen?fehler=${error}` : "/einstellungen");
}

/** Markt anlegen */
export async function addStore(formData: FormData) {
  const parsed = storeSchema.safeParse({ name: formData.get("name"), flyer_url: formData.get("flyer_url") ?? "" });
  if (!parsed.success) done("markt");
  const supabase = await createClient();
  const { count } = await supabase.from("stores").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("stores").insert({ ...parsed.data!, sort_order: (count ?? 0) + 1 });
  done(error ? (error.code === "23505" ? "doppelt" : "speichern") : undefined);
}

/** Markt umbenennen oder Prospekt-Link ändern */
export async function updateStore(id: string, formData: FormData) {
  const parsed = storeSchema.safeParse({ name: formData.get("name"), flyer_url: formData.get("flyer_url") ?? "" });
  if (!parsed.success) done("markt");
  const supabase = await createClient();
  const { error } = await supabase.from("stores").update(parsed.data!).eq("id", id);
  done(error ? (error.code === "23505" ? "doppelt" : "speichern") : undefined);
}

/** Markt löschen – seine Angebote verschwinden mit */
export async function deleteStore(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stores").delete().eq("id", id);
  done(error ? "speichern" : undefined);
}

/** PLZ oder Ort speichern */
export async function savePlz(formData: FormData) {
  const plz = String(formData.get("plz") ?? "").trim().slice(0, 40) || null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const { error } = await supabase.from("preferences").update({ plz }).eq("user_id", auth.claims.sub);
  done(error ? "speichern" : undefined);
}
