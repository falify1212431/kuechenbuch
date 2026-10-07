import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/styles";
import { ThawBanner } from "@/components/thaw-banner";
import { loadThawReminders } from "@/lib/data/plan";
import { check, loadBasics } from "@/lib/data/basics";
import { todayInBerlin } from "@/lib/dates";
import { toPantryEntry } from "@/lib/pantry/entry";
import { countDue } from "@/lib/pantry/expiry";
import { PANTRY_VIEWS, type PantryView } from "@/lib/pantry/grouping";
import { createClient } from "@/lib/supabase/server";
import { PantryList } from "./pantry-list";

export const metadata: Metadata = { title: "Vorrat" };

const VIEW_LABELS: Record<PantryView, string> = {
  kategorie: "Kategorie",
  lagerort: "Lagerort",
  ablauf: "Ablauf",
};

const NOTICES: Record<string, string> = {
  verbraucht: "Als verbraucht markiert.",
  weggeworfen: "Als weggeworfen markiert. Beim nächsten Mal klappt’s!",
  eingeraeumt: "Eingeräumt! Prüf kurz die geschätzten Daten (≈).",
};

export default async function PantryPage({ searchParams }: PageProps<"/vorrat">) {
  const params = await searchParams;
  const view: PantryView = PANTRY_VIEWS.find((v) => v === params.ansicht) ?? "kategorie";
  const notice = typeof params.hinweis === "string" ? NOTICES[params.hinweis] : undefined;

  const supabase = await createClient();
  const { categories, locations, rules } = await loadBasics(supabase);
  const rows = check(await supabase.from("pantry_items").select("*").eq("status", "da"), "Vorrat laden");

  const today = todayInBerlin();
  const entries = rows.map((row) => toPantryEntry(row, rules, today));
  const reminders = await loadThawReminders(supabase, today);
  const due = countDue(entries);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Vorrat</h1>
        <Link href="/vorrat/neu" className={buttonPrimary}>
          + Hinzufügen
        </Link>
      </header>

      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{notice}</p>}

      <ThawBanner reminders={reminders} />

      {/* Die Leiste „heute fällig / bald fällig“ */}
      {entries.length > 0 && (
        <div className="flex gap-2 text-sm">
          <span className="flex-1 rounded-xl bg-red-50 p-2 text-center text-red-800 dark:bg-red-950 dark:text-red-200">
            <strong className="text-lg">{due.dueNow}</strong> heute fällig
          </span>
          <span className="flex-1 rounded-xl bg-amber-50 p-2 text-center text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <strong className="text-lg">{due.dueSoon}</strong> in den nächsten 3 Tagen
          </span>
        </div>
      )}

      {/* Umschalten: nach Kategorie, Lagerort oder Ablauf */}
      <nav className="flex rounded-xl bg-stone-200 p-1 text-sm dark:bg-stone-800" aria-label="Ansicht">
        {PANTRY_VIEWS.map((v) => (
          <Link
            key={v}
            href={`/vorrat?ansicht=${v}`}
            aria-current={v === view ? "true" : undefined}
            className={`flex-1 rounded-lg py-1.5 text-center ${
              v === view ? "bg-white font-semibold shadow-sm dark:bg-stone-600" : "text-stone-600 dark:text-stone-300"
            }`}
          >
            {VIEW_LABELS[v]}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <p className="py-8 text-center text-stone-500">
          Noch nichts im Vorrat. Tippe oben auf „+ Hinzufügen“ oder räume deinen nächsten Einkauf ein.
        </p>
      ) : (
        <PantryList entries={entries} view={view} categories={categories} locations={locations} />
      )}
    </div>
  );
}
