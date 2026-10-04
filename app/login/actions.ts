"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

// Was die Login-Seite gerade anzeigt: Schritt 1 (E-Mail eingeben) oder Schritt 2 (Code eingeben)
export type LoginState =
  | { step: "email"; email?: string; error?: string }
  | { step: "code"; email: string; error?: string };

/**
 * Wird von beiden Login-Formularen aufgerufen. Das versteckte Feld „intent“ sagt, was zu tun ist:
 * - "send": Mail mit Code und Link verschicken
 * - "verify": eingegebenen Code prüfen und anmelden
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

  const supabase = await createClient();

  if (intent === "verify") {
    const code = String(formData.get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(code)) {
      return { step: "code", email, error: "Der Code besteht nur aus Ziffern, meistens sechs." };
    }
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) return { step: "code", email, error: errorMessage(error) };
    redirect(next);
  }

  // Schritt 1: Supabase schickt eine Mail mit Code und Link.
  // Der Link führt zu /auth/confirm, egal ob die App lokal oder online läuft.
  const origin = (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) return { step: "email", email, error: errorMessage(error) };
  return { step: "code", email };
}

// Übersetzt die Fehler von Supabase in verständliche Sätze
function errorMessage(error: AuthError): string {
  switch (error.code) {
    case "otp_expired":
      return "Der Code stimmt nicht oder ist abgelaufen. Tippe unten auf „Neuen Code anfordern“.";
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
