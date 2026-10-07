"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/styles";
import type { RecipeStep } from "@/lib/cooking/ingredients";

interface Timer {
  /** Gesamtdauer in Millisekunden */
  total: number;
  /** Restzeit, solange der Timer pausiert ist */
  left: number;
  /** Zeitpunkt, an dem er klingelt (nur wenn er läuft) */
  endsAt: number | null;
  done: boolean;
}

function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Koch-Modus: ein Schritt pro Bildschirm, große Schrift, der Bildschirm bleibt an.
 * Schritte mit Wartezeit haben einen Timer; Timer laufen weiter, auch wenn man weiterblättert.
 */
export function CookMode({
  recipeId,
  title,
  servings,
  steps,
  ingredients,
}: {
  recipeId: string;
  title: string;
  servings: number;
  steps: RecipeStep[];
  ingredients: string[];
}) {
  const [index, setIndex] = useState(0);
  const [timers, setTimers] = useState<Record<number, Timer>>({});
  const [now, setNow] = useState(() => Date.now());
  const [screenOn, setScreenOn] = useState<boolean | null>(null);
  const [showIngredients, setShowIngredients] = useState(false);
  const alarms = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const audio = useRef<AudioContext | null>(null);

  // Bildschirm anlassen (Wake Lock). Nach dem Zurückkehren in den Tab neu anfordern,
  // weil der Browser die Sperre beim Wechseln automatisch aufhebt.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    async function request() {
      try {
        lock = await navigator.wakeLock.request("screen");
        setScreenOn(true);
      } catch {
        setScreenOn(false);
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  // Uhr für die Anzeige der Timer; Wecker beim Verlassen abschalten
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    const pending = alarms.current;
    return () => {
      clearInterval(interval);
      pending.forEach((handle) => clearTimeout(handle));
    };
  }, []);

  function ring(stepIndex: number) {
    navigator.vibrate?.([400, 200, 400, 200, 400]);
    const context = audio.current;
    if (context) {
      // Drei kurze Pieptöne
      for (let i = 0; i < 3; i++) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 880;
        gain.gain.value = 0.3;
        oscillator.connect(gain).connect(context.destination);
        const start = context.currentTime + i * 0.5;
        oscillator.start(start);
        oscillator.stop(start + 0.3);
      }
    }
    setTimers((current) => ({ ...current, [stepIndex]: { ...current[stepIndex], endsAt: null, left: 0, done: true } }));
  }

  function startTimer(stepIndex: number, minutes: number) {
    // Ton erst nach einem Tipp erlaubt: deshalb wird der Lautsprecher hier vorbereitet
    audio.current ??= new AudioContext();
    audio.current.resume().catch(() => {});
    const existing = timers[stepIndex];
    const left = existing && !existing.done ? existing.left : minutes * 60_000;
    const endsAt = Date.now() + left;
    alarms.current.set(stepIndex, setTimeout(() => ring(stepIndex), left));
    setTimers({ ...timers, [stepIndex]: { total: minutes * 60_000, left, endsAt, done: false } });
    setNow(Date.now());
  }

  function pauseTimer(stepIndex: number) {
    const timer = timers[stepIndex];
    if (!timer?.endsAt) return;
    clearTimeout(alarms.current.get(stepIndex));
    setTimers({ ...timers, [stepIndex]: { ...timer, left: Math.max(0, timer.endsAt - Date.now()), endsAt: null } });
  }

  function resetTimer(stepIndex: number) {
    clearTimeout(alarms.current.get(stepIndex));
    const rest = { ...timers };
    delete rest[stepIndex];
    setTimers(rest);
  }

  const step = steps[index];
  const timer = timers[index];
  const remaining = (t: Timer) => (t.endsAt ? t.endsAt - now : t.left);
  // Laufende Timer anderer Schritte oben anzeigen
  const otherTimers = Object.entries(timers)
    .map(([key, t]) => [Number(key), t] as const)
    .filter(([key, t]) => key !== index && (t.endsAt || t.done));

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-stone-200 px-4 py-3 dark:border-stone-700">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          <p className="text-xs text-stone-500">
            {servings} {servings === 1 ? "Portion" : "Portionen"}
            {screenOn === true && " · 🔆 Bildschirm bleibt an"}
            {screenOn === false && " · Bildschirm-an klappt hier nicht"}
          </p>
        </div>
        <Link href={`/kochen/${recipeId}`} className="rounded-full border border-stone-300 px-3 py-1.5 text-sm dark:border-stone-600">
          ✕ Beenden
        </Link>
      </header>

      {otherTimers.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {otherTimers.map(([key, t]) => (
            <button
              key={key}
              type="button"
              onClick={() => setIndex(key)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${t.done ? "animate-pulse bg-red-600 text-white" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50"}`}
            >
              ⏱ Schritt {key + 1}: {t.done ? "fertig!" : formatClock(remaining(t))}
            </button>
          ))}
        </div>
      )}

      <main className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Schritt {index + 1} von {steps.length}
        </p>
        <p className="text-2xl leading-relaxed">{step?.text}</p>

        {step?.timerMinutes && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200 p-4 dark:border-stone-700">
            <p className={`text-5xl font-bold tabular-nums ${timer?.done ? "animate-pulse text-red-600" : ""}`}>
              {timer ? (timer.done ? "Fertig!" : formatClock(remaining(timer))) : formatClock(step.timerMinutes * 60_000)}
            </p>
            <div className="flex gap-2">
              {timer?.endsAt ? (
                <button type="button" className={buttonSecondary} onClick={() => pauseTimer(index)}>
                  ⏸ Pause
                </button>
              ) : (
                !timer?.done && (
                  <button type="button" className={buttonPrimary} onClick={() => startTimer(index, step.timerMinutes!)}>
                    ▶ {timer ? "Weiter" : `Timer ${step.timerMinutes} Min.`}
                  </button>
                )
              )}
              {timer && (
                <button type="button" className={buttonSecondary} onClick={() => resetTimer(index)}>
                  ↺ Zurücksetzen
                </button>
              )}
            </div>
          </div>
        )}

        <details open={showIngredients} onToggle={(event) => setShowIngredients(event.currentTarget.open)}>
          <summary className="cursor-pointer text-stone-600 dark:text-stone-400">Zutaten anzeigen</summary>
          <ul className="mt-2 flex flex-col gap-1 text-lg">
            {ingredients.map((ingredient, i) => (
              <li key={i}>• {ingredient}</li>
            ))}
          </ul>
        </details>
      </main>

      <footer className="flex gap-2 border-t border-stone-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-stone-700">
        <button type="button" className={`${buttonSecondary} flex-1 py-4 text-lg`} disabled={index === 0} onClick={() => setIndex(index - 1)}>
          ← Zurück
        </button>
        {index < steps.length - 1 ? (
          <button type="button" className={`${buttonPrimary} flex-1 py-4 text-lg`} onClick={() => setIndex(index + 1)}>
            Weiter →
          </button>
        ) : (
          <Link href={`/kochen/${recipeId}/gekocht?portionen=${servings}`} className={`${buttonPrimary} flex-1 py-4 text-lg`}>
            Fertig 🎉
          </Link>
        )}
      </footer>
    </div>
  );
}
