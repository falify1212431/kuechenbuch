import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonPrimary, card, input } from "@/components/styles";
import { planConsumption } from "@/lib/cooking/consume";
import { check } from "@/lib/data/basics";
import { toRecipe } from "@/lib/data/cooking";
import { formatQuantity, UNITS, type Unit } from "@/lib/pantry/quantity";
import { createClient } from "@/lib/supabase/server";
import { markCooked } from "../../actions";

export const metadata: Metadata = { title: "Gekocht" };

/** Vorschau für „Gekocht“: Was wird vom Vorrat abgezogen? Jede Menge lässt sich ändern. */
export default async function CookedPage({ params, searchParams }: PageProps<"/kochen/[id]/gekocht">) {
  const { id } = await params;
  const { portionen } = await searchParams;

  const supabase = await createClient();
  const { data: row } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const recipe = toRecipe(row);

  const requested = Number(portionen);
  const servings = Number.isInteger(requested) && requested >= 1 && requested <= 20 ? requested : recipe.servings;
  const stock = check(await supabase.from("pantry_items").select("id, name, quantity, unit").eq("status", "da"), "Vorrat laden").map(
    (item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unit: (UNITS.find((u) => u === item.unit) ?? "Stück") as Unit,
    }),
  );
  const lines = planConsumption(recipe.ingredients, servings / recipe.servings, stock);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/kochen/${id}`} className="text-stone-600 dark:text-stone-400">
        ← {recipe.title}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Gekocht?</h1>
        <p className="text-stone-600 dark:text-stone-400">
          Für {servings} {servings === 1 ? "Portion" : "Portionen"}. Prüf kurz, was vom Vorrat abgezogen wird. 0 = nichts abziehen.
        </p>
      </div>

      <form action={markCooked.bind(null, id)} className="flex flex-col gap-4">
        {lines.length > 0 ? (
          <ul className={`${card} flex flex-col divide-y divide-stone-200 dark:divide-stone-700`}>
            {lines.map((line) => (
              <li key={line.pantryItemId} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{line.name}</p>
                  <p className="text-sm text-stone-500">da: {formatQuantity(line.have, line.unit)}</p>
                </div>
                <label className="flex items-center gap-2">
                  <span className="sr-only">Verbraucht von {line.name}</span>
                  <input
                    name={`use_${line.pantryItemId}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={line.have}
                    step="any"
                    defaultValue={line.use}
                    className={`${input} w-24 text-right`}
                  />
                  <span className="w-14 text-sm">{line.unit}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className={card}>Aus dem Vorrat wird nichts abgezogen (nur Grundvorrat oder alles war gekauft).</p>
        )}
        <p className="text-sm text-stone-500">Was dabei leer wird, gilt als verbraucht und verschwindet aus dem Vorrat.</p>
        <button type="submit" className={buttonPrimary}>
          ✅ Bestätigen
        </button>
      </form>
    </div>
  );
}
