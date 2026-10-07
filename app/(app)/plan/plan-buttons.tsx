"use client";

import { useActionState } from "react";
import { buttonPrimary, errorBox } from "@/components/styles";
import type { PlanState } from "./actions";

type Action = (previous: PlanState, formData: FormData) => Promise<PlanState>;

/** „Woche planen“: großer Knopf mit Warte-Anzeige und Ergebnis */
export function PlanWeekButton({ action, open }: { action: Action; open: number }) {
  const [state, formAction, pending] = useActionState<PlanState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button type="submit" disabled={pending || open === 0} className={`${buttonPrimary} w-full`}>
        {pending ? "Die KI plant … (bis zu 30 Sekunden)" : open === 0 ? "Alle Abende sind geplant" : `✨ Woche planen (${open} frei)`}
      </button>
      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
      {state.notice && !pending && <p className="text-sm text-stone-600 dark:text-stone-400">{state.notice}</p>}
    </form>
  );
}

/** 🎲 Einen Tag neu würfeln */
export function RerollButton({ action, label }: { action: Action; label: string }) {
  const [state, formAction, pending] = useActionState<PlanState, FormData>(action, {});
  return (
    <form action={formAction} className="flex items-center gap-2">
      {state.error && !pending && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {state.error}
        </span>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-label={`${label} neu planen`}
        className="rounded-full border border-stone-300 px-2.5 py-1 text-sm disabled:opacity-50 dark:border-stone-600"
      >
        {pending ? "…" : "🎲"}
      </button>
    </form>
  );
}
