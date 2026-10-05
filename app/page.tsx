import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InstallButton } from "./install-button";
import { logout } from "./login/actions";

export default async function Home() {
  // Der Proxy lässt nur Angemeldete hierher. Wir prüfen trotzdem selbst nach,
  // denn eine Seite sollte sich nie allein auf den Proxy verlassen.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold">Küchenbuch</h1>
      <p className="text-lg">
        Hallo! Du bist angemeldet als <strong>{data.claims.email}</strong>.
      </p>
      <p className="text-stone-600 dark:text-stone-400">
        Hier entsteht deine Küchen-App: Vorrat, Kochideen und Einkaufsliste an einem Ort.
      </p>
      <InstallButton />
      <form action={logout}>
        <button
          type="submit"
          className="rounded-xl border border-stone-300 px-4 py-2 font-medium dark:border-stone-600"
        >
          Abmelden
        </button>
      </form>
    </main>
  );
}
