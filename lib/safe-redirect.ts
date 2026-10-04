/**
 * Gibt einen sicheren Pfad zurück, auf den wir nach dem Login weiterleiten dürfen.
 *
 * Warum? Die Login-Seite bekommt das Ziel als Parameter, z. B. /login?next=/vorrat.
 * Ohne Prüfung könnte jemand einen Trick-Link bauen (/login?next=https://boese.example),
 * der dich nach dem Einloggen auf eine fremde Seite schickt. Deshalb erlauben wir
 * nur Pfade innerhalb unserer eigenen App. Alles andere führt zum Ersatzziel.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  // Leer oder kein Pfad mit "/" am Anfang (z. B. "https://…" oder "javascript:…")
  if (!next || !next.startsWith("/")) return fallback;

  // Wir lassen den eingebauten URL-Baustein entscheiden, wohin der Pfad wirklich führt.
  // So fallen auch Tricks wie "//boese.example" oder "/\boese.example" auf,
  // die Browser als fremde Adresse verstehen.
  const base = "https://kuechenbuch.invalid";
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
