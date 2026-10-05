import { PEANUT_MESSAGES, type PeanutStatus } from "@/lib/allergens/peanut";

const STYLES: Record<PeanutStatus, string> = {
  erdnuss: "border-red-600 bg-red-600 text-white",
  spuren: "border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-50",
  ungeprueft: "border-sky-400 bg-sky-50 text-sky-950 dark:bg-sky-950 dark:text-sky-100",
  frei: "border-stone-300 bg-stone-50 text-stone-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200",
};

/** Hinweis zum Erdnuss-Check: rot, gelb, „ungeprüft“ oder „laut Datenbank frei“ */
export function PeanutBanner({ status, compact = false }: { status: PeanutStatus; compact?: boolean }) {
  const message = PEANUT_MESSAGES[status];
  return (
    <div role={status === "erdnuss" ? "alert" : undefined} className={`rounded-xl border-2 p-3 ${STYLES[status]}`}>
      <p className="font-bold">
        {status === "erdnuss" || status === "spuren" ? "⚠️ " : "ℹ️ "}
        {message.title}
      </p>
      {!compact && <p className="text-sm">{message.text}</p>}
    </div>
  );
}
