import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonPrimary, buttonSecondary, card, errorBox, input } from "@/components/styles";
import { check } from "@/lib/data/basics";
import { loadPlan } from "@/lib/data/plan";
import { addDays } from "@/lib/dates";
import { formatDayShort, SLOT_LABELS, SLOTS, weekStart } from "@/lib/plan/week";
import { createClient } from "@/lib/supabase/server";
import { setEntry } from "../actions";

export const metadata: Metadata = { title: "Eintragen" };

/** Einen Platz im Plan belegen: Freitext, frei, Rezept aus dem Rezeptbuch/Vorschlägen oder Reste */
export default async function AddEntryPage({ searchParams }: PageProps<"/plan/eintragen">) {
  const { datum, slot, fehler } = await searchParams;
  const place = SLOTS.find((s) => s === slot);
  if (typeof datum !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(datum) || !place) redirect("/plan");

  const supabase = await createClient();
  const [recipes, before] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, minutes, favorite, rating, suggested_at")
      .or("favorite.eq.true,rating.eq.1,cooked_count.gt.0,suggested_at.not.is.null")
      // 👎-Rezepte nicht anbieten (NULL zählt als „nicht bewertet“)
      .or("rating.is.null,rating.eq.1")
      .order("favorite", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    // Für „Reste von …“: was in den Tagen davor gekocht wird
    loadPlan(supabase, addDays(datum, -4), addDays(datum, -1)),
  ]);
  const options = check(recipes, "Rezepte laden");
  const leftovers = before.filter((entry) => entry.recipe).map((entry) => ({ id: entry.recipe!.id, title: entry.recipe!.title, date: entry.date }));
  const action = setEntry.bind(null, datum, place);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/plan?woche=${weekStart(datum)}`} className="text-stone-600 dark:text-stone-400">
        ← Wochenplan
      </Link>
      <h1 className="text-2xl font-bold">
        {formatDayShort(datum)} {SLOT_LABELS[place]}
      </h1>
      {fehler && (
        <p role="alert" className={errorBox}>
          Bitte etwas eintragen (höchstens 120 Zeichen).
        </p>
      )}

      <form action={action} className={`${card} flex flex-col gap-2`}>
        <input type="hidden" name="kind" value="text" />
        <label htmlFor="text" className="font-semibold">
          Selbst eintragen
        </label>
        <div className="flex gap-2">
          <input id="text" name="text" required maxLength={120} placeholder="z. B. Pizza bei Mama" className={input} />
          <button type="submit" className={buttonPrimary}>
            OK
          </button>
        </div>
      </form>

      <form action={action}>
        <input type="hidden" name="kind" value="frei" />
        <button type="submit" className={`${buttonSecondary} w-full`}>
          Frei / auswärts (KI plant hier nichts)
        </button>
      </form>

      {leftovers.length > 0 && (
        <section className={`${card} flex flex-col gap-2`}>
          <h2 className="font-semibold">🍱 Reste von …</h2>
          {leftovers.map((recipe) => (
            <form key={`${recipe.id}-${recipe.date}`} action={action}>
              <input type="hidden" name="kind" value="reste" />
              <input type="hidden" name="recipe_id" value={recipe.id} />
              <button type="submit" className="w-full rounded-lg px-2 py-2 text-left hover:bg-stone-100 dark:hover:bg-stone-800">
                {recipe.title} <span className="text-sm text-stone-500">({formatDayShort(recipe.date)})</span>
              </button>
            </form>
          ))}
        </section>
      )}

      <section className={`${card} flex flex-col gap-1`}>
        <h2 className="font-semibold">Aus Rezeptbuch und Vorschlägen</h2>
        {options.length === 0 && (
          <p className="text-sm text-stone-500">
            Noch keine Rezepte. Hol dir welche unter <Link href="/kochen" className="underline">Kochen</Link> oder nutze „Woche planen“.
          </p>
        )}
        {options.map((recipe) => (
          <form key={recipe.id} action={action}>
            <input type="hidden" name="kind" value="rezept" />
            <input type="hidden" name="recipe_id" value={recipe.id} />
            <button type="submit" className="w-full rounded-lg px-2 py-2 text-left hover:bg-stone-100 dark:hover:bg-stone-800">
              {recipe.favorite && "★ "}
              {recipe.title} <span className="text-sm text-stone-500">· {recipe.minutes} Min.</span>
            </button>
          </form>
        ))}
      </section>
    </div>
  );
}
