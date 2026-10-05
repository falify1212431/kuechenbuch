import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Supabase-Verbindung für den Server (Seiten, Server-Aktionen, Routen).
 * Wichtig: Für jede Anfrage neu erzeugen und nie in einer globalen Variable speichern,
 * sonst könnten sich Anfragen verschiedener Nutzer die Sitzung teilen.
 */
export async function createClient() {
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();

  // <Database> sorgt dafür, dass TypeScript alle Tabellen und Spalten kennt
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Wird aus einer Seite (Server Component) aufgerufen, die keine Cookies setzen darf.
          // Das ist in Ordnung: Der Proxy (proxy.ts) frischt die Sitzung ohnehin auf.
        }
      },
    },
  });
}
