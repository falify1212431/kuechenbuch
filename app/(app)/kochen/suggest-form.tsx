"use client";

import { useActionState, useState } from "react";
import { buttonPrimary, errorBox, input, levelDot } from "@/components/styles";
import { suggestRecipes, type SuggestState } from "./actions";

export interface MustUseOption {
  id: string;
  name: string;
  label: string;
  level: "rot" | "gelb" | "gruen" | "grau";
}

const chip =
  "flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-sm has-checked:border-emerald-700 has-checked:bg-emerald-50 has-checked:font-medium dark:border-stone-600 dark:has-checked:bg-emerald-950";

/** Filter und Wunsch, dann „Vorschläge holen“ */
export function SuggestForm({ options }: { options: MustUseOption[] }) {
  const [state, formAction, pending] = useActionState<SuggestState, FormData>(suggestRecipes, {});
  // Alles als Zustand, damit die Auswahl nach „Vorschläge holen“ stehen bleibt (für „nochmal“)
  const [mustUse, setMustUse] = useState<string[]>([]);
  const [flags, setFlags] = useState({ nur_vorrat: false, schnell: false, meal_prep: false });
  const [wish, setWish] = useState("");

  const toggle = (id: string, checked: boolean) =>
    setMustUse((current) => (checked ? [...current, id] : current.filter((entry) => entry !== id)));

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className={chip}>
          <input type="checkbox" name="nur_vorrat" checked={flags.nur_vorrat} onChange={(e) => setFlags({ ...flags, nur_vorrat: e.target.checked })} className="sr-only" />
          🏠 Nur was da ist
        </label>
        <label className={chip}>
          <input type="checkbox" name="schnell" checked={flags.schnell} onChange={(e) => setFlags({ ...flags, schnell: e.target.checked })} className="sr-only" />
          ⚡ Schnell (≤ 20 Min.)
        </label>
        <label className={chip}>
          <input type="checkbox" name="meal_prep" checked={flags.meal_prep} onChange={(e) => setFlags({ ...flags, meal_prep: e.target.checked })} className="sr-only" />
          🥡 Meal-Prep (2–4 Tage)
        </label>
      </div>

      {options.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            🗑️ Das muss weg {mustUse.length > 0 ? `(${mustUse.length} gewählt)` : "(bis zu 3 wählen)"}
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((option) => {
              const checked = mustUse.includes(option.id);
              return (
                <label key={option.id} className={`${chip} ${!checked && mustUse.length >= 3 ? "opacity-40" : ""}`}>
                  <input
                    type="checkbox"
                    name="muss_weg"
                    value={option.id}
                    checked={checked}
                    disabled={!checked && mustUse.length >= 3}
                    onChange={(event) => toggle(option.id, event.target.checked)}
                    className="sr-only"
                  />
                  <span className={`size-2 rounded-full ${levelDot[option.level]}`} aria-hidden />
                  {option.name}
                  <span className="text-xs text-stone-500">{option.label}</span>
                </label>
              );
            })}
          </div>
        </details>
      )}

      <input name="wunsch" value={wish} onChange={(e) => setWish(e.target.value)} maxLength={200} placeholder="Wunsch, z. B. „was Warmes“ oder „Pasta“" aria-label="Wunsch" className={input} />

      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Die KI überlegt … (10–20 Sekunden)" : state.run ? "🔄 Andere Vorschläge" : "🍳 Vorschläge holen"}
      </button>

      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
      {state.notice && !pending && <p className="text-sm text-stone-500">{state.notice}</p>}
    </form>
  );
}
