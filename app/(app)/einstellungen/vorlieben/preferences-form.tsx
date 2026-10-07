"use client";

import { useActionState } from "react";
import { buttonPrimary, card, errorBox, input, label } from "@/components/styles";
import { APPLIANCE_OPTIONS, CUISINE_OPTIONS, DIETS, FIXED_ALLERGY, GOAL_OPTIONS, type Preferences } from "@/lib/cooking/preferences";
import { savePreferences, type PreferencesState } from "./actions";

const chip =
  "flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-sm has-checked:border-emerald-700 has-checked:bg-emerald-50 has-checked:font-medium dark:border-stone-600 dark:has-checked:bg-emerald-950";

const hint = "text-xs text-stone-500";

/** Zum Ankreuzen + Textfeld für eigene Einträge */
function Choices({ name, title, options, selected }: { name: string; title: string; options: string[]; selected: string[] }) {
  const extra = selected.filter((entry) => !options.includes(entry));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={label}>{title}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className={chip}>
            <input type="checkbox" name={name} value={option} defaultChecked={selected.includes(option)} className="sr-only" />
            {option}
          </label>
        ))}
      </div>
      <textarea name={`${name}_more`} defaultValue={extra.join("\n")} rows={2} placeholder="Weitere, eine pro Zeile" aria-label={`${title}: weitere`} className={input} />
    </fieldset>
  );
}

/** Einfache Liste: ein Eintrag pro Zeile */
function ListField({ name, title, values, help, rows = 4 }: { name: string; title: string; values: string[]; help?: string; rows?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={label}>{title}</span>
      <textarea name={name} defaultValue={values.join("\n")} rows={rows} className={input} />
      {help && <span className={hint}>{help}</span>}
    </label>
  );
}

function NumberField({ name, title, value, unit, min, max, step = 1 }: { name: string; title: string; value: number | null; unit: string; min: number; max: number; step?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={label}>{title}</span>
      <span className="flex items-center gap-2">
        <input name={name} type="number" inputMode="decimal" min={min} max={max} step={step} defaultValue={value ?? ""} className={`${input} w-24`} />
        <span className="text-sm">{unit}</span>
      </span>
    </label>
  );
}

export function PreferencesForm({ prefs, fixedExclusions }: { prefs: Preferences; fixedExclusions: string[] }) {
  const [state, formAction, pending] = useActionState<PreferencesState, FormData>(savePreferences, {});
  const otherAllergies = prefs.allergies.filter((entry) => entry.toLowerCase() !== FIXED_ALLERGY.toLowerCase());

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="text-lg font-semibold">Was nie vorkommen darf</h2>
        <div className="rounded-xl border-2 border-red-600 bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100">
          <p className="font-semibold">🔒 Fest gesperrt (lässt sich nicht abschalten)</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {fixedExclusions.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
        <ListField
          name="allergies"
          title="Weitere Allergien & Unverträglichkeiten"
          values={otherAllergies}
          rows={2}
          help="Eine pro Zeile. Werden immer hart ausgeschlossen."
        />
        <ListField
          name="dislikes"
          title="Mag ich nicht"
          values={prefs.dislikes}
          help="Eine Zutat pro Zeile. Kommt ein Begriff in einem Vorschlag vor, wird er aussortiert."
        />
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="text-lg font-semibold">Ernährung & Geschmack</h2>
        <label className="flex flex-col gap-1">
          <span className={label}>Ernährungsform</span>
          <select name="diet" defaultValue={prefs.diet} className={input}>
            {DIETS.map((diet) => (
              <option key={diet} value={diet}>
                {diet}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Was mir wichtig ist</span>
          <textarea name="diet_notes" defaultValue={prefs.diet_notes} rows={3} maxLength={500} className={input} />
        </label>
        <Choices name="cuisines" title="Lieblingsküchen" options={CUISINE_OPTIONS} selected={prefs.cuisines} />
        <Choices name="goals" title="Ziele" options={GOAL_OPTIONS} selected={prefs.goals} />
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="text-lg font-semibold">Alltag</h2>
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="servings" title="Portionen" value={prefs.servings} unit="Portionen" min={1} max={12} />
          <NumberField name="budget_week" title="Budget" value={prefs.budget_week} unit="€ / Woche" min={0} max={10000} step={0.01} />
          <NumberField name="max_minutes_weekday" title="Kochzeit Mo–Fr" value={prefs.max_minutes_weekday} unit="Min." min={5} max={300} />
          <NumberField name="max_minutes_weekend" title="Kochzeit Sa–So" value={prefs.max_minutes_weekend} unit="Min." min={5} max={300} />
        </div>
        <p className={hint}>Bei Meal-Prep darf es doppelt so lange dauern, bei „schnell“ höchstens 20 Minuten.</p>
        <Choices name="appliances" title="Küchengeräte" options={APPLIANCE_OPTIONS} selected={prefs.appliances} />
        <ListField
          name="staples"
          title="Grundvorrat"
          values={prefs.staples}
          help="Gilt immer als vorhanden und wird nicht vom Vorrat abgezogen. Eins pro Zeile."
        />
      </section>

      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
      {state.saved && !pending && !state.error && (
        <p className="rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">Gespeichert.</p>
      )}

      <button type="submit" disabled={pending} className={`${buttonPrimary} sticky bottom-24`}>
        {pending ? "Speichert …" : "Vorlieben speichern"}
      </button>
    </form>
  );
}
