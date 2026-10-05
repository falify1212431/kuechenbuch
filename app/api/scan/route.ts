import { askAi } from "@/lib/ai/server";
import { loadBasics } from "@/lib/data/basics";
import { todayInBerlin } from "@/lib/dates";
import { buildCandidate, peanutForAiItem } from "@/lib/scan/candidate";
import { dateSchema, looseSchema, productSchema, receiptSchema, SCAN_MODES, taskFor, type ScanMode } from "@/lib/scan/ai-tasks";
import { categoryIdByName, matchShoppingLines, plausibleDate } from "@/lib/scan/postprocess";
import { createClient } from "@/lib/supabase/server";
import type { z } from "zod";

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Foto + Modus → erkannte Einträge zum Bestätigen. Das Foto wird nirgends gespeichert:
 * Es geht nur einmal zur KI und ist danach weg.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const form = await request.formData();
  const mode = SCAN_MODES.find((m) => m === form.get("mode")) as ScanMode | undefined;
  const image = form.get("image");
  const barcode = String(form.get("barcode") ?? "");
  if (!mode) return Response.json({ error: "Unbekannter Modus." }, { status: 400 });
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return Response.json({ error: "Bitte ein Foto schicken." }, { status: 400 });
  }
  if (image.size > MAX_BYTES) return Response.json({ error: "Das Foto ist zu groß." }, { status: 400 });

  const today = todayInBerlin();
  const basics = await loadBasics(supabase);
  const task = taskFor(mode, today, basics.categories.map((c) => c.name));
  const result = await askAi(supabase, task.schema as z.ZodType<unknown>, {
    model: "vision",
    system: task.system,
    prompt: task.prompt,
    images: [{ mimeType: image.type, base64: Buffer.from(await image.arrayBuffer()).toString("base64") }],
  });
  if (!result.ok) return Response.json({ error: result.error });

  switch (mode) {
    case "datum": {
      const data = result.data as z.infer<typeof dateSchema>;
      return Response.json({ date: plausibleDate(data.date, today), dateType: data.date_type, readText: data.read_text });
    }

    case "produkt": {
      const data = result.data as z.infer<typeof productSchema>;
      const categoryId = categoryIdByName(data.category, basics.categories);
      // Unbekannten Barcode mit dem erkannten Produkt merken, damit der nächste Scan sofort klappt
      if (/^\d{8,14}$/.test(barcode)) {
        const { error } = await supabase.from("products").upsert(
          {
            barcode,
            name: data.name,
            brand: data.brand,
            quantity: data.quantity,
            unit: data.unit,
            default_category_id: categoryId,
            source: "ki",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,barcode" },
        );
        if (error) console.error("Produkt merken fehlgeschlagen:", error.message);
      }
      return Response.json({
        candidates: [
          buildCandidate(
            {
              key: "produkt",
              barcode: barcode || null,
              name: data.name,
              brand: data.brand,
              quantity: data.quantity,
              unit: data.unit,
              categoryId,
              // Nur von der KI erkannt: Allergene gelten als ungeprüft (außer Erdnuss steht im Namen)
              peanut: peanutForAiItem(data.name, null),
            },
            basics,
            today,
          ),
        ],
      });
    }

    case "lose-ware":
    case "kassenbon": {
      const data = result.data as z.infer<typeof looseSchema> | z.infer<typeof receiptSchema>;
      const items = data.items.filter((item) => !("is_food" in item) || item.is_food);
      const candidates = items.map((item, index) =>
        buildCandidate(
          {
            key: `${mode}-${index}`,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            categoryId: categoryIdByName(item.category, basics.categories),
            shelfLifeDays: item.shelf_life_days,
            peanut: peanutForAiItem(item.name, item.category),
          },
          basics,
          today,
        ),
      );

      // Kassenbon: Was davon stand auf der Einkaufsliste?
      let shoppingMatches: { id: string; name: string }[] = [];
      if (mode === "kassenbon") {
        const { data: lines } = await supabase.from("shopping_items").select("id, name, checked");
        const ids = matchShoppingLines(
          items.map((item) => item.name),
          lines ?? [],
        );
        shoppingMatches = (lines ?? []).filter((line) => ids.includes(line.id)).map(({ id, name }) => ({ id, name }));
      }
      return Response.json({ candidates, shoppingMatches });
    }
  }
}
