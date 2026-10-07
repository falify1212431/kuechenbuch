"use server";

import { revalidatePath } from "next/cache";
import { parseList, preferencesFormSchema, withFixedAllergy } from "@/lib/cooking/preferences";
import { createClient } from "@/lib/supabase/server";

export type PreferencesState = { error?: string; saved?: number };

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const checked = (formData: FormData, name: string) => formData.getAll(name).map(String);

/** Vorlieben speichern. Erdnuss bleibt dabei immer in den Allergien. */
export async function savePreferences(previous: PreferencesState, formData: FormData): Promise<PreferencesState> {
  const parsed = preferencesFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { error: "Bitte neu anmelden." };

  const { error } = await supabase
    .from("preferences")
    .update({
      ...parsed.data,
      allergies: withFixedAllergy(parseList([], text(formData, "allergies"))),
      dislikes: parseList([], text(formData, "dislikes")),
      cuisines: parseList(checked(formData, "cuisines"), text(formData, "cuisines_more")),
      goals: parseList(checked(formData, "goals"), text(formData, "goals_more")),
      appliances: parseList(checked(formData, "appliances"), text(formData, "appliances_more")),
      staples: parseList([], text(formData, "staples")),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", auth.claims.sub);
  if (error) return { error: `Speichern hat nicht geklappt: ${error.message}` };

  revalidatePath("/einstellungen/vorlieben");
  revalidatePath("/kochen");
  return { saved: (previous.saved ?? 0) + 1 };
}
