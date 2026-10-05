import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

// Hierher führt der Link aus der Login-Mail. Supabase hängt einen einmaligen „code“ an,
// den wir gegen eine Sitzung eintauschen. Das klappt nur im selben Browser, in dem der
// Link angefordert wurde: Dort liegt ein passendes Gegenstück als Cookie.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const next = safeRedirectPath(params.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  redirect("/login?fehler=link");
}
