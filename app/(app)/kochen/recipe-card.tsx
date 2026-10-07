import Link from "next/link";
import { card, levelDot } from "@/components/styles";
import { ingredientStatus } from "@/lib/cooking/ingredients";
import type { Recipe } from "@/lib/data/cooking";
import type { PantryEntry } from "@/lib/pantry/entry";

/** Kurzinfo zu Zeit, Schwierigkeit und Meal-Prep */
export function RecipeMeta({ recipe }: { recipe: Pick<Recipe, "minutes" | "difficulty" | "mealPrep" | "servings"> }) {
  return (
    <p className="text-sm text-stone-500">
      ⏱ {recipe.minutes} Min. · {recipe.difficulty} · {recipe.servings} {recipe.servings === 1 ? "Portion" : "Portionen"}
      {recipe.mealPrep && ` · 🥡 hält ${recipe.mealPrep.days} ${recipe.mealPrep.days === 1 ? "Tag" : "Tage"}`}
    </p>
  );
}

/** Ein Vorschlag in der Liste: was aus dem Vorrat genutzt wird (grün) und was fehlt (gelb) */
export function RecipeCard({ recipe, pantry }: { recipe: Recipe; pantry: PantryEntry[] }) {
  const byId = new Map(pantry.map((entry) => [entry.id, entry]));
  const uses: { name: string; level: PantryEntry["level"] }[] = [];
  const missing: string[] = [];
  for (const ingredient of recipe.ingredients) {
    const status = ingredientStatus(ingredient, pantry);
    if (status === "vorrat") uses.push({ name: ingredient.name, level: byId.get(ingredient.pantryItemId ?? "")?.level ?? "gruen" });
    if (status === "fehlt") missing.push(ingredient.name);
  }
  // Bald Ablaufendes zuerst zeigen
  const order = { rot: 0, gelb: 1, gruen: 2, grau: 3 };
  uses.sort((a, b) => order[a.level] - order[b.level]);

  return (
    <Link href={`/kochen/${recipe.id}`} className={`${card} flex flex-col gap-2 active:bg-stone-50 dark:active:bg-stone-800`}>
      <div>
        <h3 className="text-lg font-semibold">
          {recipe.favorite && "★ "}
          {recipe.title}
        </h3>
        <RecipeMeta recipe={recipe} />
      </div>
      {recipe.summary && <p className="text-sm">{recipe.summary}</p>}
      {uses.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-sm">
          <span className="text-emerald-700 dark:text-emerald-400">Nutzt:</span>
          {uses.map((use, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              <span className={`size-2 rounded-full ${levelDot[use.level]}`} aria-hidden />
              {use.name}
            </span>
          ))}
        </div>
      )}
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-sm">
          <span className="text-amber-700 dark:text-amber-400">Fehlt:</span>
          {missing.map((name, i) => (
            <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {name}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
