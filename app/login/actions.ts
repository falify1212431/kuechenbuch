"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

// Was die Login-Seite gerade anzeigt: Schritt 1 (E-Mail eingeben) oder Schritt 2 (Mail ist unterwegs)
export type LoginState =
  | { step: "email"; email?: string; error?: string }
  | { step: "sent"; email: string };

/**
 * Wird von den Login-Formularen aufgerufen. Das versteckte Feld „intent“ sagt, was zu tun ist:
 * - "send": Mail mit Login-Link verschicken
 * - "restart": zurück zu Schritt 1
 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const intent = String(formData.get("intent") ?? "send");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeRedirectPath(String(formData.get("next") ?? "/"));

  if (intent === "restart") return { step: "email", email };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { step: "email", email, error: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }

  // Supabase schickt eine Mail mit Link. Der Link führt zu /auth/confirm auf genau
  // der Adresse, auf der die App gerade läuft (lokal oder online bei Vercel).
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) return { step: "email", email, error: errorMessage(error) };
  return { step: "sent", email };
}

// Übersetzt die Fehler von Supabase in verständliche Sätze
function errorMessage(error: AuthError): string {
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "Es wurden gerade zu viele Login-Mails verschickt. Bitte warte ein paar Minuten (im schlimmsten Fall eine Stunde) und versuch es dann noch einmal.";
    case "over_request_rate_limit":
      return "Zu viele Versuche hintereinander. Bitte warte eine Minute.";
    case "email_address_not_authorized":
      return "An diese Adresse darf Supabase keine Mails schicken. Nimm die E-Mail-Adresse deines Supabase-Kontos.";
    case "signup_disabled":
    case "otp_disabled":
      return "Für diese E-Mail-Adresse gibt es kein Konto.";
    case "email_address_invalid":
      return "Diese E-Mail-Adresse wird nicht akzeptiert.";
    default:
      console.error("Login-Fehler von Supabase:", error.code, error.message);
      return "Das hat nicht geklappt. Bitte versuch es gleich noch einmal.";
  }
}

// Abmelden: Sitzung bei Supabase beenden, Cookies löschen, zurück zur Login-Seite
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
