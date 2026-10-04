/**
 * Liest die Supabase-Zugangsdaten aus den Umgebungsvariablen.
 * Fehlen sie, gibt es eine verständliche Fehlermeldung statt eines rätselhaften Absturzes.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase-Variablen fehlen: NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "in .env.local (lokal) bzw. bei Vercel (online) eintragen. Vorlage: .env.example",
    );
  }
  return { url, key };
}
