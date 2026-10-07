import type { Metadata } from "next";
import Link from "next/link";
import { buttonDanger, buttonPrimary, buttonSecondary, card, errorBox, input, label } from "@/components/styles";
import { loadBasics, type Category, type Location } from "@/lib/data/basics";
import { createClient } from "@/lib/supabase/server";
import { InstallButton } from "../../install-button";
import { logout } from "../../login/actions";
import { addEntry, deleteEntry, moveEntry, updateEntry } from "./actions";

export const metadata: Metadata = { title: "Einstellungen" };

const ERRORS: Record<string, string> = {
  doppelt: "Diesen Namen gibt es schon.",
  name: "Bitte einen Namen eingeben (höchstens 60 Zeichen).",
  speichern: "Speichern hat nicht geklappt. Bitte versuch es noch einmal.",
};

// Kleine Pfeil-Knöpfe zum Sortieren
function MoveButtons({
  table,
  field,
  id,
  name,
}: {
  table: "categories" | "locations";
  field: "sort_order" | "aisle_order";
  id: string;
  name: string;
}) {
  const arrow = "size-9 rounded-lg border border-stone-300 text-stone-600 dark:border-stone-600 dark:text-stone-300";
  return (
    <div className="flex shrink-0 gap-1">
      <form action={moveEntry.bind(null, table, field, id, -1)}>
        <button type="submit" className={arrow} aria-label={`${name} nach oben`}>
          ↑
        </button>
      </form>
      <form action={moveEntry.bind(null, table, field, id, 1)}>
        <button type="submit" className={arrow} aria-label={`${name} nach unten`}>
          ↓
        </button>
      </form>
    </div>
  );
}

// Eine Zeile: antippen klappt die Bearbeitung auf
function EntryRow({
  table,
  entry,
  locations,
  subtitle,
}: {
  table: "categories" | "locations";
  entry: Category | Location;
  locations: Location[];
  subtitle?: string;
}) {
  const defaultLocation = "default_location_id" in entry ? entry.default_location_id : null;
  return (
    <li className="flex items-start gap-2 py-2">
      <details className="min-w-0 flex-1">
        <summary className="cursor-pointer py-1.5">
          {entry.icon} {entry.name}
          {subtitle && <span className="text-sm text-stone-500"> · {subtitle}</span>}
        </summary>
        <form action={updateEntry.bind(null, table, entry.id)} className="mt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <input name="icon" defaultValue={entry.icon ?? ""} maxLength={8} aria-label="Symbol" className={`${input} w-16 text-center`} />
            <input name="name" defaultValue={entry.name} required maxLength={60} aria-label="Name" className={input} />
          </div>
          {table === "categories" && (
            <label className="flex flex-col gap-1">
              <span className={label}>Typischer Lagerort</span>
              <select name="default_location_id" defaultValue={defaultLocation ?? ""} className={input}>
                <option value="">– keiner –</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.icon} {location.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" className={buttonSecondary}>
            Speichern
          </button>
        </form>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-red-700 dark:text-red-400">Löschen …</summary>
          <form action={deleteEntry.bind(null, table, entry.id)} className="mt-2 flex flex-col gap-2">
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Einträge im Vorrat bleiben erhalten und landen unter „Ohne {table === "categories" ? "Kategorie" : "Lagerort"}“.
              Die Faustregeln dazu werden mit gelöscht.
            </p>
            <button type="submit" className={buttonDanger}>
              „{entry.name}“ wirklich löschen
            </button>
          </form>
        </details>
      </details>
      <MoveButtons table={table} field="sort_order" id={entry.id} name={entry.name} />
    </li>
  );
}

function AddForm({ table, placeholder }: { table: "categories" | "locations"; placeholder: string }) {
  return (
    <form action={addEntry.bind(null, table)} className="mt-2 flex gap-2">
      <input name="icon" maxLength={8} placeholder="🙂" aria-label="Symbol" className={`${input} w-16 text-center`} />
      <input name="name" required maxLength={60} placeholder={placeholder} aria-label={placeholder} className={input} />
      <button type="submit" className={buttonPrimary} aria-label={placeholder}>
        +
      </button>
    </form>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/einstellungen">) {
  const { fehler } = await searchParams;
  const supabase = await createClient();
  const { categories, locations } = await loadBasics(supabase);
  const { data: claims } = await supabase.auth.getClaims();

  const locationName = new Map(locations.map((location) => [location.id, location.name]));
  const byAisle = [...categories].sort((a, b) => a.aisle_order - b.aisle_order);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Einstellungen</h1>

      {typeof fehler === "string" && ERRORS[fehler] && (
        <p role="alert" className={errorBox}>
          {ERRORS[fehler]}
        </p>
      )}

      <Link href="/einstellungen/vorlieben" className={`${card} flex items-center justify-between`}>
        <span>
          <span className="block text-lg font-semibold">🍽️ Vorlieben fürs Kochen</span>
          <span className="text-sm text-stone-500">Allergien, mag ich nicht, Geräte, Grundvorrat …</span>
        </span>
        <span aria-hidden>→</span>
      </Link>

      <section className={card}>
        <h2 className="text-lg font-semibold">Kategorien</h2>
        <p className="text-sm text-stone-500">Reihenfolge im Vorrat. Antippen zum Bearbeiten.</p>
        <ul className="divide-y divide-stone-200 dark:divide-stone-700">
          {categories.map((category) => (
            <EntryRow
              key={category.id}
              table="categories"
              entry={category}
              locations={locations}
              subtitle={category.default_location_id ? locationName.get(category.default_location_id) : undefined}
            />
          ))}
        </ul>
        <AddForm table="categories" placeholder="Neue Kategorie" />
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Laden-Reihenfolge</h2>
        <p className="text-sm text-stone-500">So sortiert sich die Einkaufsliste: in der Reihenfolge, wie du durch den Laden läufst.</p>
        <ol className="divide-y divide-stone-200 dark:divide-stone-700">
          {byAisle.map((category, index) => (
            <li key={category.id} className="flex items-center gap-2 py-2">
              <span className="w-6 text-right text-sm text-stone-500">{index + 1}.</span>
              <span className="min-w-0 flex-1 truncate">
                {category.icon} {category.name}
              </span>
              <MoveButtons table="categories" field="aisle_order" id={category.id} name={category.name} />
            </li>
          ))}
        </ol>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Lagerorte</h2>
        <ul className="divide-y divide-stone-200 dark:divide-stone-700">
          {locations.map((location) => (
            <EntryRow key={location.id} table="locations" entry={location} locations={locations} />
          ))}
        </ul>
        <AddForm table="locations" placeholder="Neuer Lagerort" />
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="text-lg font-semibold">Konto</h2>
        <p className="text-sm">
          Angemeldet als <strong>{claims?.claims.email}</strong>
        </p>
        <InstallButton />
        <form action={logout}>
          <button type="submit" className={buttonSecondary}>
            Abmelden
          </button>
        </form>
        <p className="text-xs text-stone-500">
          Achtung: Zum Wieder-Anmelden brauchst du eine neue Login-Mail (höchstens 2 pro Stunde).
        </p>
      </section>
    </div>
  );
}
