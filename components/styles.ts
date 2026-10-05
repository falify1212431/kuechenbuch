// Einheitliche Stile für Knöpfe, Felder und Karten.
// Große Flächen und Schrift, damit alles mit dem Daumen gut bedienbar ist.

export const input =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base dark:border-stone-600 dark:bg-stone-800";

export const buttonPrimary =
  "inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60";

export const buttonSecondary =
  "inline-flex items-center justify-center rounded-xl border border-stone-300 px-4 py-2.5 font-medium hover:bg-stone-100 disabled:opacity-60 dark:border-stone-600 dark:hover:bg-stone-800";

export const buttonDanger =
  "inline-flex items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 font-semibold text-white hover:bg-red-800 disabled:opacity-60";

export const card = "rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900";

export const label = "text-sm font-medium text-stone-700 dark:text-stone-300";

export const errorBox = "rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200";

// Farbpunkte für den Ablauf-Status
export const levelDot: Record<"rot" | "gelb" | "gruen" | "grau", string> = {
  rot: "bg-red-500",
  gelb: "bg-amber-400",
  gruen: "bg-emerald-500",
  grau: "bg-stone-400",
};

export const levelText: Record<"rot" | "gelb" | "gruen" | "grau", string> = {
  rot: "text-red-700 dark:text-red-400",
  gelb: "text-amber-700 dark:text-amber-400",
  gruen: "text-emerald-700 dark:text-emerald-400",
  grau: "text-stone-500",
};
