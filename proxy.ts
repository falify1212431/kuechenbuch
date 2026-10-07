import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js führt diese Funktion vor jeder passenden Anfrage aus (früher hieß das „Middleware“)
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Alle Pfade außer Next.js-Dateien, Bildern und dem Manifest. Manifest und Icons
    // ruft das Handy ohne Login ab, wenn es die App installiert.
    // Dazu der pdf.js-Worker (.mjs) zum Einlesen von Prospekt-PDFs.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs)$).*)",
  ],
};
