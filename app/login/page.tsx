import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : null);

  // Schon angemeldet? Dann direkt weiter.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(next);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Küchenbuch</h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">Melde dich mit deiner E-Mail-Adresse an.</p>
      </div>
      {params.fehler === "link" && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Der Link aus der Mail hat nicht funktioniert. Entweder ist er abgelaufen oder schon benutzt, oder er
          wurde in einem anderen Browser geöffnet als dem, in dem du ihn angefordert hast. Fordere einfach eine
          neue Mail an.
        </p>
      )}
      <LoginForm next={next} />
    </main>
  );
}
