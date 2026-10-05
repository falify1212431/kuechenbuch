"use client";

import Link from "next/link";
import { useState } from "react";
import { input, levelDot, levelText } from "@/components/styles";
import type { Category, Location } from "@/lib/data/basics";
import { formatDateDe } from "@/lib/dates";
import type { PantryEntry } from "@/lib/pantry/entry";
import { groupPantry, type PantryView } from "@/lib/pantry/grouping";
import { formatQuantity } from "@/lib/pantry/quantity";
import { normalizeName } from "@/lib/text";

/**
 * Die gruppierte Vorrats-Liste mit Suche. Läuft im Browser, damit die Suche
 * sofort beim Tippen filtert, ohne den Server zu fragen.
 */
export function PantryList({
  entries,
  view,
  categories,
  locations,
}: {
  entries: PantryEntry[];
  view: PantryView;
  categories: Category[];
  locations: Location[];
}) {
  const [search, setSearch] = useState("");
  const query = normalizeName(search);
  const visible = query
    ? entries.filter((entry) => normalizeName(`${entry.name} ${entry.brand ?? ""}`).includes(query))
    : entries;
  const groups = groupPantry(visible, view, categories, locations);
  const locationName = new Map(locations.map((location) => [location.id, location.name]));

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Im Vorrat suchen …"
        aria-label="Im Vorrat suchen"
        className={input}
      />

      {groups.length === 0 && <p className="text-center text-stone-500">Nichts gefunden.</p>}

      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
            {group.icon && <span aria-hidden>{group.icon} </span>}
            {group.title}
          </h2>
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-900">
            {group.items.map((entry) => (
              <li key={entry.id}>
                <Link href={`/vorrat/${entry.id}`} className="flex items-center gap-3 px-3 py-2.5 active:bg-stone-100 dark:active:bg-stone-800">
                  <span className={`size-3 shrink-0 rounded-full ${levelDot[entry.level]}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {entry.name}
                      {entry.brand && <span className="font-normal text-stone-500"> · {entry.brand}</span>}
                    </span>
                    <span className="block text-sm text-stone-500">
                      {formatQuantity(entry.quantity, entry.unit)}
                      {view !== "lagerort" && entry.locationId && ` · ${locationName.get(entry.locationId) ?? ""}`}
                      {entry.openedAt && " · geöffnet"}
                    </span>
                    {entry.hint && <span className={`block text-sm ${levelText[entry.level]}`}>{entry.hint}</span>}
                  </span>
                  <span className={`shrink-0 text-right text-sm ${levelText[entry.level]}`}>
                    {entry.label}
                    {entry.effective && (
                      <span className="block text-xs text-stone-500">
                        {entry.estimated && "≈ "}
                        {formatDateDe(entry.effective)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
