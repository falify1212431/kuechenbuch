"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg dark:border-stone-600 dark:bg-stone-800";
const buttonClass =
  "w-full rounded-xl bg-emerald-700 px-4 py-3 text-lg font-semibold text-white hover:bg-emerald-800 disabled:opacity-60";
const errorClass = "rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200";

/**
 * Das Login-Formular in zwei Schritten: erst E-Mail, dann Code aus der Mail.
 * „use client“ oben heißt: Diese Datei läuft im Browser, weil sie auf Eingaben reagiert.
 */
export function LoginForm({ next }: { next: string }) {
  // state = was die Server-Aktion zuletzt zurückgegeben hat, pending = läuft gerade
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, { step: "email" });

  if (state.step === "code") {
    return (
      <div className="flex flex-col gap-4">
        <p>
          Wir haben dir eine Mail an <strong>{state.email}</strong> geschickt. Gib den Code daraus ein
          oder tippe in der Mail auf den Link.
        </p>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="intent" value="verify" />
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="next" value={next} />
          <label htmlFor="code" className="font-medium">
            Code aus der Mail
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={12}
            required
            autoFocus
            className={`${inputClass} tracking-[0.3em]`}
          />
          {state.error && (
            <p role="alert" className={errorClass}>
              {state.error}
            </p>
          )}
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Prüfe …" : "Anmelden"}
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="intent" value="restart" />
          <input type="hidden" name="email" value={state.email} />
          <button type="submit" className="text-stone-600 underline dark:text-stone-400">
            Andere Adresse oder neuen Code anfordern
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
        {pending ? "Sende …" : "Code per Mail senden"}
      </button>
    </form>
  );
}
