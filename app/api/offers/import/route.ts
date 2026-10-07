import { z } from "zod";
import { MESSAGES } from "@/lib/ai/core";
import { askAi } from "@/lib/ai/server";
import { todayInBerlin } from "@/lib/dates";
import { offerDrafts, offerPageSchema, offerPageTask } from "@/lib/offers/extract";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Eine Prospektseite (Bild) + Markt → Angebote zum Durchsehen. Gespeichert wird hier nichts,
 * auch nicht das Bild. Bei „KI ausgelastet“ kommt Status 429, dann wartet die App kurz.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const form = await request.formData();
  const storeId = String(form.get("store_id") ?? "");
  const image = form.get("image");
  if (!z.uuid().safeParse(storeId).success) return Response.json({ error: "Bitte einen Markt wählen." }, { status: 400 });
  if (!(image instanceof File) || !image.type.startsWith("image/")) return Response.json({ error: "Bitte ein Bild schicken." }, { status: 400 });
  if (image.size > MAX_BYTES) return Response.json({ error: "Das Bild ist zu groß." }, { status: 400 });

  const { data: store } = await supabase.from("stores").select("name").eq("id", storeId).maybeSingle();
  if (!store) return Response.json({ error: "Unbekannter Markt." }, { status: 400 });

  const today = todayInBerlin();
  const task = offerPageTask(store.name, today);
  const result = await askAi(supabase, offerPageSchema, {
    model: "vision",
    ...task,
    images: [{ mimeType: image.type, base64: Buffer.from(await image.arrayBuffer()).toString("base64") }],
  });
  if (!result.ok) {
    const status = result.error === MESSAGES.rateLimit ? 429 : result.error === MESSAGES.quota ? 402 : 502;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ drafts: offerDrafts(result.data, today) });
}
