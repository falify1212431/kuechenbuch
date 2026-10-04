import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

// Hierher führt der Link aus der Login-Mail
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const next = safeRedirectPath(params.get("next"));

  const supabase = await createClient();

  if (tokenHash && type) {
    // Link aus unserer eigenen Mail-Vorlage: funktioniert in jedem Browser
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  } else if (code) {
    // Link aus der Standard-Vorlage von Supabase: klappt nur im selben Browser,
    // in dem der Code angefordert wurde
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  redirect("/login?fehler=link");
}
