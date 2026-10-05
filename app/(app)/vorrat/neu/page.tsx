import type { Metadata } from "next";
import Link from "next/link";
import { loadBasics } from "@/lib/data/basics";
import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Neuer Eintrag" };

export default async function NewItemPage() {
  const supabase = await createClient();
  const { categories, locations } = await loadBasics(supabase);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/vorrat" className="text-stone-600 dark:text-stone-400">
        ← Vorrat
      </Link>
      <h1 className="text-2xl font-bold">Neu im Vorrat</h1>
      <ItemForm categories={categories} locations={locations} />
    </div>
  );
}
