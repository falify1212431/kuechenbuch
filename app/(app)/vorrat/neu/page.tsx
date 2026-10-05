import type { Metadata } from "next";
import Link from "next/link";
import { loadBasics } from "@/lib/data/basics";
import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Neuer Eintrag" };

export default async function NewItemPage({ searchParams }: PageProps<"/vorrat/neu">) {
  // Vom Scanner kann ein fotografiertes Datum mitkommen: ?datum=2026-10-12&art=verbrauch
  const { datum, art } = await searchParams;
  const date = typeof datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : null;
  const dateType = art === "verbrauch" ? "verbrauch" : "mhd";

  const supabase = await createClient();
  const { categories, locations } = await loadBasics(supabase);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/vorrat" className="text-stone-600 dark:text-stone-400">
        ← Vorrat
      </Link>
      <h1 className="text-2xl font-bold">Neu im Vorrat</h1>
      <ItemForm categories={categories} locations={locations} defaults={date ? { date, date_type: dateType } : undefined} />
    </div>
  );
}
