"use client";

import { useActionState } from "react";
import { buttonPrimary, errorBox } from "@/components/styles";
import type { StepsState } from "../actions";

/** Für Gerichte aus dem Wochenplan: Zubereitung per KI nachholen */
export function StepsButton({ action }: { action: (previous: StepsState, formData: FormData) => Promise<StepsState> }) {
  const [state, formAction, pending] = useActionState<StepsState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <p className="text-sm text-stone-600 dark:text-stone-400">
        Für dieses Gericht aus dem Wochenplan gibt es bisher nur die Zutaten. Die Zubereitung kostet 1 KI-Aufruf.
      </p>
      <button type="submit" disabled={pending} className={buttonPrimary}>
        {pending ? "Die KI schreibt die Schritte …" : "📝 Zubereitung erstellen"}
      </button>
      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
    </form>
  );
}
