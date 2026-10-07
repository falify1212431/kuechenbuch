import type { Metadata } from "next";
import Link from "next/link";
import { FIXED_EXCLUSIONS } from "@/lib/allergens/blocklist";
import { loadPreferences } from "@/lib/data/cooking";
import { createClient } from "@/lib/supabase/server";
import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = { title: "Vorlieben" };

export default async function PreferencesPage() {
  const supabase = await createClient();
  const prefs = await loadPreferences(supabase);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/einstellungen" className="text-stone-600 dark:text-stone-400">
        ← Einstellungen
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Vorlieben</h1>
        <p className="text-stone-600 dark:text-stone-400">Fließt in alle Kochvorschläge ein.</p>
      </div>
      <PreferencesForm prefs={prefs} fixedExclusions={FIXED_EXCLUSIONS} />
    </div>
  );
}
