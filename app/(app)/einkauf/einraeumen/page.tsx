import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonPrimary, card, input, label } from "@/components/styles";
import { check, loadBasics } from "@/lib/data/basics";
import { todayInBerlin } from "@/lib/dates";
import { formatQuantity, type Unit } from "@/lib/pantry/quantity";
import { estimateDate, matchShelfLife } from "@/lib/pantry/shelf-life";
import { createClient } from "@/lib/supabase/server";
import { stockCheckedItems } from "../actions";

export const metadata: Metadata = { title: "Einräumen" };

export default async function StockPage() {
  const supabase = await createClient();
  const { categories, locations, rules } = await loadBasics(supabase);
  const items = check(
    await supabase.from("shopping_items").select("*").eq("checked", true).order("created_at"),
    "Einkaufsliste laden",
  );
  if (items.length === 0) redirect("/einkauf");

  const today = todayInBerlin();
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  // Vorschläge: Lagerort aus der Kategorie, Datum nach Faustregel
  const proposals = items.map((item) => {
    const category = item.category_id ? categoryById.get(item.category_id) : undefined;
    const locationId = category?.default_location_id ?? null;
    const estimate = estimateDate(today, matchShelfLife({ name: item.name, categoryId: item.category_id, locationId }, rules));
    return { item, category, locationId, estimate };
  });

  return (
    <div className="flex flex-col gap-4">
      <Link href="/einkauf" className="text-stone-600 dark:text-stone-400">
        ← Einkauf
      </Link>
      <h1 className="text-2xl font-bold">Einräumen</h1>
      <p className="text-stone-600 dark:text-stone-400">
        Die Daten sind geschätzt. Trag das aufgedruckte Datum ein, wo du es kennst, vor allem bei Fleisch und Fisch.
      </p>

      <form action={stockCheckedItems} className="flex flex-col gap-3">
        {proposals.map(({ item, category, locationId, estimate }) => (
          <fieldset key={item.id} className={`${card} flex flex-col gap-2`}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name={`estimated:${item.id}`} value={estimate ?? ""} />
            <legend className="sr-only">{item.name}</legend>
            <p className="font-semibold">
              {category?.icon} {item.name}{" "}
              <span className="font-normal text-stone-500">{formatQuantity(Number(item.quantity), item.unit as Unit)}</span>
            </p>
            <div className="flex gap-2">
              <label className="flex w-1/2 flex-col gap-1">
                <span className={label}>Datum</span>
                <input type="date" name={`date:${item.id}`} defaultValue={estimate ?? ""} className={input} />
              </label>
              <label className="flex w-1/2 flex-col gap-1">
                <span className={label}>Art</span>
                <select name={`type:${item.id}`} defaultValue="mhd" className={input}>
                  <option value="mhd">MHD</option>
                  <option value="verbrauch">Verbrauchsdatum</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className={label}>Lagerort</span>
              <select name={`location:${item.id}`} defaultValue={locationId ?? ""} className={input}>
                <option value="">– keiner –</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.icon} {location.name}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        ))}

        <button type="submit" className={buttonPrimary}>
          Alles in den Vorrat räumen
        </button>
      </form>
    </div>
  );
}
