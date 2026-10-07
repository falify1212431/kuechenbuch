import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatAmount, scaleAmount } from "@/lib/cooking/ingredients";
import { toRecipe } from "@/lib/data/cooking";
import { createClient } from "@/lib/supabase/server";
import { CookMode } from "./cook-mode";

export const metadata: Metadata = { title: "Koch-Modus" };

export default async function CookModePage({ params, searchParams }: PageProps<"/kochen/[id]/kochmodus">) {
  const { id } = await params;
  const { portionen } = await searchParams;

  const supabase = await createClient();
  const { data: row } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const recipe = toRecipe(row);

  const requested = Number(portionen);
  const servings = Number.isInteger(requested) && requested >= 1 && requested <= 20 ? requested : recipe.servings;
  const factor = servings / recipe.servings;

  return (
    <CookMode
      recipeId={recipe.id}
      title={recipe.title}
      servings={servings}
      steps={recipe.steps}
      ingredients={recipe.ingredients.map((i) => `${formatAmount(scaleAmount(i.amount, i.unit, factor), i.unit)} ${i.name}`.trim())}
    />
  );
}
