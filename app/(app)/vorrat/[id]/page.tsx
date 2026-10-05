import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonPrimary, buttonSecondary, card, levelDot, levelText } from "@/components/styles";
import { loadBasics } from "@/lib/data/basics";
import { formatDateDe, todayInBerlin } from "@/lib/dates";
import { toPantryEntry } from "@/lib/pantry/entry";
import { formatQuantity } from "@/lib/pantry/quantity";
import { createClient } from "@/lib/supabase/server";
import { rebuy, setOpened, setRemaining, setStatus } from "../actions";
import { ItemForm } from "../item-form";
import { RemainingSlider } from "./remaining-slider";

export const metadata: Metadata = { title: "Eintrag" };

export default async function ItemPage({ params, searchParams }: PageProps<"/vorrat/[id]">) {
  const { id } = await params;
  const { hinweis } = await searchParams;

  const supabase = await createClient();
  const { data: row } = await supabase.from("pantry_items").select("*").eq("id", id).eq("status", "da").maybeSingle();
  if (!row) notFound();

  const { categories, locations, rules } = await loadBasics(supabase);
  const entry = toPantryEntry(row, rules, todayInBerlin());
  const category = categories.find((c) => c.id === entry.categoryId);
  const location = locations.find((l) => l.id === entry.locationId);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/vorrat" className="text-stone-600 dark:text-stone-400">
        ← Vorrat
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{entry.name}</h1>
        {entry.brand && <p className="text-stone-500">{entry.brand}</p>}
      </div>

      {hinweis === "nachkaufen" && (
        <p className="rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Steht jetzt auf der <Link href="/einkauf" className="underline">Einkaufsliste</Link>.
        </p>
      )}

      <div className={`${card} flex flex-col gap-1`}>
        <p className={`flex items-center gap-2 font-semibold ${levelText[entry.level]}`}>
          <span className={`size-3 rounded-full ${levelDot[entry.level]}`} aria-hidden />
          {entry.label}
        </p>
        {entry.hint && <p className={levelText[entry.level]}>{entry.hint}</p>}
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {entry.date ? (
            <>
              {entry.dateType === "verbrauch" ? "Zu verbrauchen bis" : "Mindestens haltbar bis"} {formatDateDe(entry.date)}
              {entry.estimated && " (geschätzt)"}
            </>
          ) : (
            "Kein Datum bekannt"
          )}
        </p>
        {entry.openedAt && (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Geöffnet am {formatDateDe(entry.openedAt)}
            {entry.effective && entry.effective !== entry.date && `, deshalb nur noch bis ${formatDateDe(entry.effective)}`}
          </p>
        )}
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {formatQuantity(entry.quantity, entry.unit)}
          {category && ` · ${category.icon ?? ""} ${category.name}`}
          {location && ` · ${location.icon ?? ""} ${location.name}`}
        </p>
      </div>

      {/* Die wichtigsten Aktionen, groß und mit dem Daumen erreichbar */}
      <div className="grid grid-cols-2 gap-2">
        <form action={setStatus.bind(null, entry.id, "verbraucht")}>
          <button type="submit" className={`${buttonPrimary} w-full`}>
            ✓ Verbraucht
          </button>
        </form>
        <form action={setStatus.bind(null, entry.id, "weggeworfen")}>
          <button type="submit" className={`${buttonSecondary} w-full`}>
            🗑 Weggeworfen
          </button>
        </form>
        <form action={setOpened.bind(null, entry.id, !entry.openedAt)}>
          <button type="submit" className={`${buttonSecondary} w-full`}>
            {entry.openedAt ? "Doch nicht geöffnet" : "📂 Geöffnet"}
          </button>
        </form>
        <form action={rebuy.bind(null, entry.id)}>
          <button type="submit" className={`${buttonSecondary} w-full`}>
            🛒 Nachkaufen
          </button>
        </form>
      </div>

      <section className={card}>
        <h2 className="mb-2 font-semibold">Teilweise verbraucht</h2>
        {/* key: Nach dem Speichern startet der Regler neu mit der neuen Menge */}
        <RemainingSlider key={entry.quantity} action={setRemaining.bind(null, entry.id)} quantity={entry.quantity} unit={entry.unit} />
      </section>

      <details className={card}>
        <summary className="cursor-pointer font-semibold">Bearbeiten</summary>
        <div className="mt-4">
          <ItemForm categories={categories} locations={locations} defaults={row} />
        </div>
      </details>
    </div>
  );
}
