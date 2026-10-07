import { createClient } from "@supabase/supabase-js";
import { isCronRequest } from "@/lib/keepalive";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Täglicher Weckruf (Vercel Cron, siehe vercel.json): eine Mini-Anfrage an die Datenbank,
 * damit Supabase Free das Projekt nicht nach einer Woche ohne Nutzung schlafen legt.
 * Nur mit dem geheimen Schlüssel aus CRON_SECRET erlaubt; es werden keine Daten gelesen.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Nicht erlaubt." }, { status: 401 });
  }

  const { url, key } = supabaseEnv();
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("keepalive");
  if (error) {
    console.error("Wachhalten fehlgeschlagen:", error.message);
    return Response.json({ ok: false }, { status: 502 });
  }
  return Response.json({ ok: true, database: data });
}
