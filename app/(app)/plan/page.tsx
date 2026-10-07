import type { Metadata } from "next";
import Link from "next/link";
import { ThawBanner } from "@/components/thaw-banner";
import { buttonSecondary, card } from "@/components/styles";
import { loadPreferences } from "@/lib/data/cooking";
import { loadPlan, loadThawReminders, type PlanRow } from "@/lib/data/plan";
import { addDays, todayInBerlin } from "@/lib/dates";
import { formatDayShort, isoWeekNumber, openSlots, parseWeekParam, SLOT_LABELS, SLOTS, weekDates, type Slot } from "@/lib/plan/week";
import { createClient } from "@/lib/supabase/server";
import { CookTabs } from "../kochen/cook-tabs";
import { moveEntry, planWeek, removeEntry, rerollDay, toggleCooked } from "./actions";
import { PlanWeekButton, RerollButton } from "./plan-buttons";

export const metadata: Metadata = { title: "Wochenplan" };

const notice = "rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100";
const small = "rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm dark:border-stone-600";

/** Was in einem Platz steht: Rezept, Reste, freier Text oder „frei“ */
function EntryContent({ entry }: { entry: PlanRow }) {
  if (entry.recipe) {
    return (
      <Link href={`/kochen/${entry.recipe.id}`} className="block">
        <span className="font-medium underline-offset-2 hover:underline">{entry.recipe.title}</span>
        <span className="block text-xs text-stone-500">
          ⏱ {entry.recipe.minutes} Min. · {entry.recipe.servings} Portionen{entry.recipe.steps.length === 0 && " · Zubereitung noch offen"}
        </span>
      </Link>
    );
  }
  if (entry.leftovers) {
    return (
      <Link href={`/kochen/${entry.leftovers.id}`} className="block">
        🍱 Reste: <span className="font-medium">{entry.leftovers.title}</span>
      </Link>
    );
  }
  if (entry.skip) return <span className="text-stone-500">– frei / auswärts –</span>;
  return <span className="font-medium">{entry.freeText}</span>;
}

/** Menü zu einem Eintrag: gegessen, verschieben, entfernen */
function EntryMenu({ entry, targets }: { entry: PlanRow; targets: { value: string; label: string }[] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-stone-500" aria-label="Optionen">
        ⋯
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        {!entry.skip && (
          <form action={toggleCooked.bind(null, entry.id, !entry.cooked)}>
            <button type="submit" className={small}>
              {entry.cooked ? "↩︎ Doch nicht gegessen" : "✓ Gegessen"}
            </button>
          </form>
        )}
        <form action={moveEntry.bind(null, entry.id)} className="flex gap-2">
          <select name="target" aria-label="Verschieben nach" className={`${small} min-w-0 flex-1`} defaultValue="">
            <option value="" disabled>
              Verschieben nach …
            </option>
            {targets.map((target) => (
              <option key={target.value} value={target.value}>
                {target.label}
              </option>
            ))}
          </select>
          <button type="submit" className={small}>
            OK
          </button>
        </form>
        <form action={removeEntry.bind(null, entry.id)}>
          <button type="submit" className={`${small} text-red-700 dark:text-red-400`}>
            Entfernen
          </button>
        </form>
      </div>
    </details>
  );
}

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const params = await searchParams;
  const today = todayInBerlin();
  const monday = parseWeekParam(params.woche, today);
  const dates = weekDates(monday);

  const supabase = await createClient();
  const [prefs, entries, reminders] = await Promise.all([
    loadPreferences(supabase),
    loadPlan(supabase, dates[0], dates[6]),
    loadThawReminders(supabase, today),
  ]);

  const open = openSlots(dates, prefs.meal_slots, entries, today).length;
  const slotsFor = (date: string) => SLOTS.filter((slot) => prefs.meal_slots.includes(slot) || entries.some((e) => e.date === date && e.slot === slot));
  // Ziele zum Verschieben: alle Plätze dieser Woche (belegte werden getauscht)
  const targets = dates.flatMap((date) =>
    prefs.meal_slots.map((slot) => {
      const taken = entries.find((e) => e.date === date && e.slot === slot);
      const what = taken?.recipe?.title ?? (taken?.leftovers ? `Reste ${taken.leftovers.title}` : (taken?.freeText ?? (taken?.skip ? "frei" : null)));
      return { value: `${date}|${slot}`, label: `${formatDayShort(date)} ${SLOT_LABELS[slot]}${what ? ` (tauschen mit ${what})` : ""}` };
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Kochen</h1>
      <CookTabs current="/plan" />

      <div className="flex items-center justify-between">
        <Link href={`/plan?woche=${addDays(monday, -7)}`} className={small} aria-label="Woche davor">
          ←
        </Link>
        <div className="text-center">
          <p className="font-semibold">KW {isoWeekNumber(monday)}</p>
          <p className="text-sm text-stone-500">
            {formatDayShort(dates[0]).slice(3)} – {formatDayShort(dates[6]).slice(3)}
          </p>
        </div>
        <Link href={`/plan?woche=${addDays(monday, 7)}`} className={small} aria-label="Woche danach">
          →
        </Link>
      </div>

      {params.hinweis === "einkauf" && (
        <p className={notice}>
          {params.anzahl === "1" ? "1 Eintrag steht" : `${params.anzahl ?? 0} Einträge stehen`} jetzt auf der{" "}
          <Link href="/einkauf" className="underline">
            Einkaufsliste
          </Link>
          .
        </p>
      )}

      <ThawBanner reminders={reminders} />

      {dates[6] >= today && <PlanWeekButton action={planWeek.bind(null, monday)} open={open} />}

      <ol className="flex flex-col gap-3">
        {dates.map((date) => {
          const past = date < today;
          return (
            <li key={date} className={`${card} flex flex-col gap-2 ${date === today ? "ring-2 ring-emerald-600" : ""} ${past ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  {formatDayShort(date)}
                  {date === today && <span className="ml-2 text-sm font-normal text-emerald-700 dark:text-emerald-400">heute</span>}
                </h2>
                {!past && <RerollButton action={rerollDay.bind(null, date)} label={formatDayShort(date)} />}
              </div>
              {slotsFor(date).map((slot: Slot) => {
                const entry = entries.find((e) => e.date === date && e.slot === slot);
                return (
                  <div key={slot} className="flex items-start gap-2 border-t border-stone-100 pt-2 dark:border-stone-800">
                    <span className="w-14 shrink-0 pt-0.5 text-xs text-stone-500">{SLOT_LABELS[slot]}</span>
                    <div className={`min-w-0 flex-1 ${entry?.cooked ? "line-through decoration-stone-400" : ""}`}>
                      {entry ? (
                        <EntryContent entry={entry} />
                      ) : (
                        <Link href={`/plan/eintragen?datum=${date}&slot=${slot}`} className="text-emerald-700 dark:text-emerald-400">
                          + eintragen
                        </Link>
                      )}
                    </div>
                    {entry && <EntryMenu entry={entry} targets={targets.filter((t) => t.value !== `${date}|${slot}`)} />}
                  </div>
                );
              })}
            </li>
          );
        })}
      </ol>

      <Link href={`/plan/einkauf?woche=${monday}`} className={`${buttonSecondary} w-full`}>
        🛒 Einkaufsliste aus dem Plan
      </Link>
      <p className="text-xs text-stone-500">
        „Woche planen“ und 🎲 kosten je 1 KI-Aufruf; die Zubereitung holst du im Rezept per Knopf (1 weiterer Aufruf pro Gericht).
      </p>
    </div>
  );
}
