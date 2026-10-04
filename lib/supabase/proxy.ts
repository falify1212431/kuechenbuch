import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

// Diese Bereiche darf man auch ohne Login öffnen
const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * Läuft vor jeder Anfrage (siehe proxy.ts im Hauptordner):
 * 1. frischt die Login-Sitzung auf (die Zugangs-Tokens von Supabase laufen regelmäßig ab),
 * 2. schickt alle, die nicht angemeldet sind, zur Login-Seite.
 */
export async function updateSession(request: NextRequest) {
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // Antworten mit Login-Cookies dürfen nirgends zwischengespeichert werden,
        // sonst könnte eine fremde Person eine Sitzung aus einem Zwischenspeicher bekommen
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Hinweis von Supabase: Zwischen createServerClient und getClaims() keinen weiteren Code
  // ausführen, sonst werden Nutzer manchmal scheinbar zufällig ausgeloggt.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isLoggedIn && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Merken, wohin man wollte, damit es nach dem Login dort weitergeht
    if (path !== "/") loginUrl.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Genau dieses response-Objekt zurückgeben, sonst gehen die aufgefrischten Cookies verloren
  return response;
}
