"use client";

import { useActionState, useEffect, useRef } from "react";
import { buttonPrimary, errorBox, input } from "@/components/styles";
import type { Category } from "@/lib/data/basics";
import { UNITS } from "@/lib/pantry/quantity";
import { addShoppingItem, type FormState } from "./actions";

/** Schnell etwas auf die Liste setzen: Name tippen, Enter, fertig */
export function AddShoppingForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addShoppingItem, {});
  const nameRef = useRef<HTMLInputElement>(null);

  // Nach dem Speichern wieder ins Namensfeld springen, damit man direkt weitertippen kann
  useEffect(() => {
    if (state.ok) nameRef.current?.focus();
  }, [state.ok]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          ref={nameRef}
          name="name"
          required
          maxLength={100}
          placeholder="Was brauchst du?"
          aria-label="Was brauchst du?"
          autoComplete="off"
          className={input}
        />
        <button type="submit" disabled={pending} className={buttonPrimary} aria-label="Hinzufügen">
          +
        </button>
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-stone-600 dark:text-stone-400">Menge und Kategorie</summary>
        <div className="mt-2 flex gap-2">
          <input
            name="quantity"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="any"
            defaultValue={1}
            aria-label="Menge"
            className={`${input} w-20`}
          />
          <select name="unit" defaultValue="Stück" aria-label="Einheit" className={`${input} w-28`}>
            {UNITS.map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
          <select name="category_id" defaultValue="" aria-label="Kategorie" className={input}>
            <option value="">Kategorie automatisch</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
        </div>
      </details>
      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
    </form>
  );
}
