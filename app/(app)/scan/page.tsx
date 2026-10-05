import type { Metadata } from "next";
import { loadBasics } from "@/lib/data/basics";
import { createClient } from "@/lib/supabase/server";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Scannen" };

export default async function ScanPage() {
  const supabase = await createClient();
  const { categories, locations } = await loadBasics(supabase);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Scannen</h1>
      <Scanner categories={categories} locations={locations} />
    </div>
  );
}
