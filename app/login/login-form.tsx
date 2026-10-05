"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg dark:border-stone-600 dark:bg-stone-800";
const buttonClass =
  "w-full rounded-xl bg-emerald-700 px-4 py-3 text-lg font-semibold text-white hover:bg-emerald-800 disabled:opacity-60";
const errorClass = "rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200";

/**
 * Das Login-Formular in zwei Schritten: erst E-Mail eingeben, dann auf den Link in der Mail tippen.
 * „use client“ oben heißt: Diese Datei läuft im Browser, weil sie auf Eingaben reagiert.
 */
export function LoginForm({ next }: { next: string }) {
  // state = was die Server-Aktion zuletzt zurückgegeben hat, pending = läuft gerade
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, { step: "email" });

  if (state.step === "sent") {
    return (
      <div className="flex flex-col gap-4">
        <p>
          Wir haben dir eine Mail an <strong>{state.email}</strong> geschickt. Öffne sie auf diesem Gerät
          und tippe auf den Link darin. Danach bist du angemeldet.
        </p>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Wichtig: Der Link funktioniert nur im selben Browser, in dem du ihn angefordert hast.
        </p>
        {/* Falls sich der Link in einem neuen Tab geöffnet hat: diese Seite einfach weiterschicken */}
        <a href={next} className={`${buttonClass} text-center`}>
          Ich habe auf den Link getippt
        </a>
        <form action={formAction}>
          <input type="hidden" name="intent" value="restart" />
          <input type="hidden" name="email" value={state.email} />
          <button type="submit" className="text-stone-600 underline dark:text-stone-400">
            Andere Adresse oder neue Mail anfordern
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="intent" value="send" />
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="font-medium">
        E-Mail-Adresse
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        required
        autoFocus
        className={inputClass}
      />
      {state.error && (
        <p role="alert" className={errorClass}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sende …" : "Login-Link per Mail senden"}
      </button>
    </form>
  );
}
