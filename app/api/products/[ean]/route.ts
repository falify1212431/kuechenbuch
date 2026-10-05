import { checkPeanut } from "@/lib/allergens/peanut";
import { loadBasics } from "@/lib/data/basics";
import { todayInBerlin } from "@/lib/dates";
import type { Unit } from "@/lib/pantry/quantity";
import { fetchOffProduct } from "@/lib/products/off";
import { buildCandidate } from "@/lib/scan/candidate";
import { categoryIdByName } from "@/lib/scan/postprocess";
import { createClient } from "@/lib/supabase/server";

/**
 * Barcode → Produkt. Erst im eigenen Produkt-Gedächtnis nachsehen (schnell, schont
 * Open Food Facts), sonst bei Open Food Facts fragen und das Ergebnis merken.
 */
export async function GET(_request: Request, context: RouteContext<"/api/products/[ean]">) {
  const { ean } = await context.params;
  if (!/^\d{8,14}$/.test(ean)) return Response.json({ error: "Ungültiger Barcode." }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const basics = await loadBasics(supabase);
  let { data: product } = await supabase.from("products").select("*").eq("barcode", ean).maybeSingle();

  if (!product) {
    let off;
    try {
      off = await fetchOffProduct(ean);
    } catch (error) {
      console.error("Open Food Facts nicht erreichbar:", error);
      return Response.json({ error: "Open Food Facts ist gerade nicht erreichbar. Versuch es gleich noch einmal." }, { status: 502 });
    }
    if (!off) return Response.json({ found: false, barcode: ean });

    const { data: saved, error } = await supabase
      .from("products")
      .insert({
        barcode: ean,
        name: off.name,
        brand: off.brand,
        quantity: off.quantity,
        unit: off.unit,
        default_category_id: categoryIdByName(off.categoryName, basics.categories),
        image_url: off.imageUrl,
        allergens: off.allergens,
        traces: off.traces,
        ingredients_text: off.ingredientsText,
        nutriments: off.nutriments ? { ...off.nutriments } : null,
        source: "off",
      })
      .select()
      .single();
    if (error) console.error("Produkt merken fehlgeschlagen:", error.message);
    product = saved;
    if (!product) return Response.json({ error: "Produkt konnte nicht gespeichert werden." }, { status: 500 });
  }

  const peanut = checkPeanut({
    name: product.name,
    allergens: product.allergens,
    traces: product.traces,
    ingredientsText: product.ingredients_text,
    source: product.source as "off" | "ki" | "manuell",
  });

  return Response.json({
    found: true,
    source: product.source,
    candidate: buildCandidate(
      {
        key: ean,
        barcode: ean,
        name: product.name,
        brand: product.brand,
        quantity: product.quantity === null ? null : Number(product.quantity),
        unit: product.unit as Unit | null,
        categoryId: product.default_category_id,
        peanut,
        nutriments: product.nutriments as Record<string, number | null> | null,
        imageUrl: product.image_url,
      },
      basics,
      todayInBerlin(),
    ),
  });
}
