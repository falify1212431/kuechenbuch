import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/styles";
import { check, loadBasics } from "@/lib/data/basics";
import { formatQuantity, type Unit } from "@/lib/pantry/quantity";
import { groupForStore } from "@/lib/shopping/list";
import { createClient } from "@/lib/supabase/server";
import { removeShoppingItem, toggleChecked } from "./actions";
import { AddShoppingForm } from "./add-form";

export const metadata: Metadata = { title: "Einkauf" };

export default async function ShoppingPage() {
  const supabase = await createClient();
  const { categories } = await loadBasics(supabase);
  const rows = check(await supabase.from("shopping_items").select("*"), "Einkaufsliste laden");

  const lines = rows.map((row) => ({ ...row, quantity: Number(row.quantity) }));
  const groups = groupForStore(lines, categories);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const checkedCount = lines.filter((line) => line.checked).length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Einkauf</h1>

      <AddShoppingForm categories={categories} />

      {lines.length === 0 && <p className="py-8 text-center text-stone-500">Die Einkaufsliste ist leer.</p>}

      {groups.map((group) => {
        const category = group.categoryId ? categoryById.get(group.categoryId) : undefined;
        return (
          <section key={group.categoryId ?? "ohne"}>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
              {category ? `${category.icon ?? ""} ${category.name}` : "Sonstiges"}
            </h2>
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-900">
              {group.items.map((line) => (
                <li key={line.id} className="flex items-center">
                  {/* Die ganze Zeile ist ein Knopf zum Abhaken */}
                  <form action={toggleChecked.bind(null, line.id, !line.checked)} className="min-w-0 flex-1">
                    <button type="submit" className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-stone-100 dark:active:bg-stone-800">
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${
                          line.checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-400"
                        }`}
                        aria-hidden
                      >
                        {line.checked && "✓"}
                      </span>
                      <span className={`min-w-0 flex-1 truncate ${line.checked ? "text-stone-400 line-through" : ""}`}>
                        {line.name}
                      </span>
                      <span className="shrink-0 text-sm text-stone-500">{formatQuantity(line.quantity, line.unit as Unit)}</span>
                      <span className="sr-only">{line.checked ? "abgehakt, antippen zum Zurücknehmen" : "antippen zum Abhaken"}</span>
                    </button>
                  </form>
                  <form action={removeShoppingItem.bind(null, line.id)}>
                    <button type="submit" className="px-3 py-3 text-stone-400 hover:text-red-600" aria-label={`${line.name} löschen`}>
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {checkedCount > 0 && (
        <Link href="/einkauf/einraeumen" className={`${buttonPrimary} sticky bottom-24 shadow-lg`}>
          {checkedCount} {checkedCount === 1 ? "Sache" : "Sachen"} einräumen →
        </Link>
      )}
    </div>
  );
}
