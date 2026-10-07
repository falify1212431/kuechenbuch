"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonPrimary, buttonSecondary, card } from "@/components/styles";
import { formatAmount, scaleAmount, type IngredientStatus, type RecipeUnit } from "@/lib/cooking/ingredients";

export interface PanelIngredient {
  name: string;
  amount: number | null;
  unit: RecipeUnit | null;
  status: IngredientStatus;
  /** Passendes Angebot, z. B. „Lidl: 0,99 € bis Sa“ */
  offer: string | null;
}

const STATUS_STYLE: Record<IngredientStatus, string> = {
  vorrat: "bg-emerald-500",
  grundvorrat: "bg-stone-400",
  fehlt: "bg-amber-400",
};

/**
 * Zutaten mit Portionen-Umschalter. Die Mengen rechnen sich sofort um; Koch-Modus,
 * „Gekocht“ und „Fehlendes auf die Einkaufsliste“ bekommen die gewählte Portionszahl mit.
 */
export function IngredientsPanel({
  recipeId,
  baseServings,
  ingredients,
  addMissing,
  hasSteps,
}: {
  recipeId: string;
  baseServings: number;
  ingredients: PanelIngredient[];
  addMissing: (formData: FormData) => Promise<void>;
  /** Ohne Schritte gibt es noch keinen Koch-Modus */
  hasSteps: boolean;
}) {
  const [servings, setServings] = useState(baseServings);
  const factor = servings / baseServings;
  const missing = ingredients.filter((i) => i.status === "fehlt").length;
  const stepper = "size-10 rounded-full border border-stone-300 text-xl dark:border-stone-600";

  return (
    <>
      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Zutaten</h2>
          <div className="flex items-center gap-2">
            <button type="button" className={stepper} onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Eine Portion weniger">
              −
            </button>
            <span className="w-24 text-center" aria-live="polite">
              {servings} {servings === 1 ? "Portion" : "Portionen"}
            </span>
            <button type="button" className={stepper} onClick={() => setServings(Math.min(20, servings + 1))} aria-label="Eine Portion mehr">
              +
            </button>
          </div>
        </div>

        <ul className="flex flex-col gap-1.5">
          {ingredients.map((ingredient, index) => (
            <li key={index} className="flex items-baseline gap-2">
              <span className={`size-2.5 shrink-0 translate-y-[-1px] rounded-full ${STATUS_STYLE[ingredient.status]}`} aria-hidden />
              <span className="w-20 shrink-0 text-right tabular-nums text-stone-600 dark:text-stone-400">
                {formatAmount(scaleAmount(ingredient.amount, ingredient.unit, factor), ingredient.unit)}
              </span>
              <span>
                {ingredient.name}
                {ingredient.status === "fehlt" && <span className="text-sm text-amber-700 dark:text-amber-400"> · fehlt</span>}
                {ingredient.offer && <span className="block text-xs text-emerald-700 dark:text-emerald-400">🏷️ {ingredient.offer}</span>}
                {ingredient.status === "grundvorrat" && <span className="text-sm text-stone-500"> · Grundvorrat</span>}
              </span>
            </li>
          ))}
        </ul>

        {missing > 0 && (
          <form action={addMissing}>
            <input type="hidden" name="servings" value={servings} />
            <button type="submit" className={`${buttonSecondary} w-full`}>
              🛒 Fehlendes auf die Einkaufsliste ({missing})
            </button>
          </form>
        )}
      </section>

      <div className="flex gap-2">
        {hasSteps ? (
          <Link href={`/kochen/${recipeId}/kochmodus?portionen=${servings}`} className={`${buttonPrimary} flex-1`}>
            👩‍🍳 Koch-Modus
          </Link>
        ) : (
          <span className={`${buttonPrimary} flex-1 opacity-50`} aria-disabled>
            👩‍🍳 Koch-Modus
          </span>
        )}
        <Link href={`/kochen/${recipeId}/gekocht?portionen=${servings}`} className={`${buttonSecondary} flex-1`}>
          ✅ Gekocht
        </Link>
      </div>
    </>
  );
}
