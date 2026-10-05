"use client";

import { useActionState, useState } from "react";
import { buttonPrimary, errorBox, input, label } from "@/components/styles";
import type { Category, Location } from "@/lib/data/basics";
import { UNITS } from "@/lib/pantry/quantity";
import { savePantryItem, type FormState } from "./actions";

export interface ItemDefaults {
  id: string;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  category_id: string | null;
  location_id: string | null;
  date: string | null;
  date_type: string;
  date_estimated: boolean;
}

/** Formular für einen Vorrats-Eintrag: leer zum Anlegen, vorausgefüllt zum Bearbeiten */
export function ItemForm({
  categories,
  locations,
  defaults,
}: {
  categories: Category[];
  locations: Location[];
  defaults?: ItemDefaults;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(savePantryItem, {});
  // Lagerort merken wir uns selbst, damit die Kategorie ihn vorschlagen kann
  const [locationId, setLocationId] = useState(defaults?.location_id ?? "");

  function onCategoryChange(categoryId: string) {
    const suggested = categories.find((category) => category.id === categoryId)?.default_location_id;
    if (suggested) setLocationId(suggested);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      {defaults?.date_estimated && defaults.date && (
        <input type="hidden" name="estimated_date" value={defaults.date} />
      )}

      <label className="flex flex-col gap-1">
        <span className={label}>Name</span>
        <input name="name" required maxLength={100} defaultValue={defaults?.name} className={input} autoComplete="off" />
      </label>

      <label className="flex flex-col gap-1">
        <span className={label}>Marke (optional)</span>
        <input name="brand" maxLength={100} defaultValue={defaults?.brand ?? ""} className={input} autoComplete="off" />
      </label>

      <div className="flex gap-2">
        <label className="flex w-1/2 flex-col gap-1">
          <span className={label}>Menge</span>
          <input
            name="quantity"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="any"
            required
            defaultValue={defaults?.quantity ?? 1}
            className={input}
          />
        </label>
        <label className="flex w-1/2 flex-col gap-1">
          <span className={label}>Einheit</span>
          <select name="unit" defaultValue={defaults?.unit ?? "Stück"} className={input}>
            {UNITS.map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={label}>Kategorie</span>
        <select
          name="category_id"
          defaultValue={defaults?.category_id ?? ""}
          onChange={(event) => onCategoryChange(event.target.value)}
          className={input}
        >
          <option value="">– keine –</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon} {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={label}>Lagerort</span>
        <select
          name="location_id"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          className={input}
        >
          <option value="">– keiner –</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.icon} {location.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className={label}>Datum</legend>
        <input name="date" type="date" defaultValue={defaults?.date ?? ""} className={input} />
        <p className="text-sm text-stone-500">
          {defaults?.date_estimated
            ? "Dieses Datum ist geschätzt. Trag das aufgedruckte ein, wenn du es kennst."
            : "Leer lassen, dann schätzt die App nach Faustregel."}
        </p>
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-stone-300 p-2.5 has-checked:border-emerald-600 has-checked:bg-emerald-50 dark:border-stone-600 dark:has-checked:bg-emerald-950">
            <input type="radio" name="date_type" value="mhd" defaultChecked={defaults?.date_type !== "verbrauch"} />
            <span className="text-sm">
              <strong>MHD</strong>
              <br />
              mindestens haltbar bis
            </span>
          </label>
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-stone-300 p-2.5 has-checked:border-emerald-600 has-checked:bg-emerald-50 dark:border-stone-600 dark:has-checked:bg-emerald-950">
            <input type="radio" name="date_type" value="verbrauch" defaultChecked={defaults?.date_type === "verbrauch"} />
            <span className="text-sm">
              <strong>Verbrauchsdatum</strong>
              <br />
              zu verbrauchen bis
            </span>
          </label>
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Speichere …" : "Speichern"}
      </button>
    </form>
  );
}
