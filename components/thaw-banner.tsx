import Link from "next/link";
import type { ThawReminder } from "@/lib/plan/thaw";
import { SLOT_LABELS, type Slot } from "@/lib/plan/week";

/** Auffälliger Hinweis: Etwas muss aus dem Tiefkühler (am Vorabend ab 17 Uhr und am Tag selbst) */
export function ThawBanner({ reminders }: { reminders: ThawReminder[] }) {
  if (reminders.length === 0) return null;
  return (
    <div role="status" className="rounded-xl border-2 border-sky-500 bg-sky-50 p-3 text-sky-950 dark:bg-sky-950 dark:text-sky-50">
      <p className="font-bold">❄️ Auftauen nicht vergessen</p>
      <ul className="mt-1 flex flex-col gap-1 text-sm">
        {reminders.map((reminder) => (
          <li key={`${reminder.date}-${reminder.slot}`}>
            <strong>{reminder.items.join(", ")}</strong> für {reminder.when} {SLOT_LABELS[reminder.slot as Slot] ?? ""} ({reminder.title})
            {reminder.when === "heute" && " – falls noch nicht geschehen"}
          </li>
        ))}
      </ul>
      <Link href="/plan" className="mt-1 inline-block text-sm underline">
        Zum Wochenplan
      </Link>
    </div>
  );
}
