import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, card } from "@/components/styles";
import { check } from "@/lib/data/basics";
import { loadPreferences } from "@/lib/data/cooking";
import { loadPlan } from "@/lib/data/plan";
import { todayInBerlin } from "@/lib/dates";
import { formatQuantity, UNITS, type Unit } from "@/lib/pantry/quantity";
import { planShoppingList } from "@/lib/plan/shopping";
import { formatDayShort, parseWeekParam, weekDates } from "@/lib/plan/week";
import { createClient } from "@/lib/supabase/server";
import { addPlanToShopping } from "../actions";

export const metadata: Metadata = { title: "Einkauf aus dem Plan" };

const toUnit = (value: string): Unit => UNITS.find((u) => u === value) ?? "Stück";

/** Vorschau: Was brauche ich für die geplanten Gerichte (ab heute) und habe es noch nicht? */
export default async function PlanShoppingPage({ searchParams }: PageProps<"/plan/einkauf">) {
  const { woche } = await searchParams;
  const today = todayInBerlin();
  const monday = parseWeekParam(woche, today);
  const dates = weekDates(monday);
  const from = dates[0] > today ? dates[0] : today;

  const supabase = await createClient();
  const [prefs, entries, pantry, shopping] = await Promise.all([
    loadPreferences(supabase),
    loadPlan(supabase, from, dates[6]),
    supabase.from("pantry_items").select("name, quantity, unit").eq("status", "da"),
    supabase.from("shopping_items").select("name, quantity, unit").eq("checked", false),
  ]);
  const toStock = (rows: { name: string; quantity: number; unit: string }[]) =>
    rows.map((row) => ({ name: row.name, quantity: Number(row.quantity), unit: toUnit(row.unit) }));

  const planned = entries.filter((entry) => entry.recipe && !entry.cooked).map((entry) => entry.recipe!);
  const lines = planShoppingList(planned, toStock(check(pantry, "Vorrat laden")), toStock(check(shopping, "Einkaufsliste laden")), prefs.staples);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/plan?woche=${monday}`} className="text-stone-600 dark:text-stone-400">
        ← Wochenplan
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Einkauf aus dem Plan</h1>
        <p className="text-stone-600 dark:text-stone-400">
          {formatDayShort(from)} bis {formatDayShort(dates[6])}: {planned.length} {planned.length === 1 ? "Gericht" : "Gerichte"}. Vorrat, Grundvorrat und was schon auf der Liste steht,
          sind abgezogen.
        </p>
      </div>

      {lines.length === 0 ? (
        <p className={card}>{planned.length === 0 ? "In dieser Woche ist noch nichts geplant." : "Du hast schon alles da. 🎉"}</p>
      ) : (
        <form action={addPlanToShopping.bind(null, monday)} className="flex flex-col gap-3">
          <ul className={`${card} flex flex-col divide-y divide-stone-200 dark:divide-stone-700`}>
            {lines.map((line) => (
              <li key={`${line.name}|${line.unit}`}>
                <label className="flex cursor-pointer items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    name="line"
                    value={JSON.stringify({ name: line.name, quantity: line.quantity, unit: line.unit })}
                    defaultChecked={line.status === "kaufen"}
                    className="mt-1 size-5 accent-emerald-700"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{line.name}</span> <span className="tabular-nums">{formatQuantity(line.quantity, line.unit)}</span>
                    <span className="block text-xs text-stone-500">für {line.recipes.join(", ")}</span>
                    {line.note && (
                      <span className={`block text-xs ${line.status === "pruefen" ? "text-amber-700 dark:text-amber-400" : "text-stone-500"}`}>{line.note}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button type="submit" className={buttonPrimary}>
            🛒 Angehakte auf die Einkaufsliste
          </button>
        </form>
      )}
    </div>
  );
}
