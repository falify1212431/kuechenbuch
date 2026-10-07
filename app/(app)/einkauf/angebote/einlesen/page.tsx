import type { Metadata } from "next";
import Link from "next/link";
import { loadStores } from "@/lib/data/offers";
import { createClient } from "@/lib/supabase/server";
import { FlyerImport } from "./flyer-import";

export const metadata: Metadata = { title: "Prospekt einlesen" };

export default async function FlyerImportPage() {
  const supabase = await createClient();
  const stores = await loadStores(supabase);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/einkauf/angebote" className="text-stone-600 dark:text-stone-400">
        ← Angebote
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Prospekt einlesen</h1>
        <p className="text-stone-600 dark:text-stone-400">
          Fotos von Prospektseiten oder ein PDF. Die Dateien bleiben auf deinem Handy, nur die gewählten Seiten gehen einmal zur KI.
        </p>
      </div>
      <FlyerImport stores={stores.map((store) => ({ id: store.id, name: store.name }))} />
    </div>
  );
}
