export const UNITS = ["Stück", "g", "ml", "Packung"] as const;
export type Unit = (typeof UNITS)[number];

/**
 * „Teilweise verbraucht“: neue Restmenge setzen. Sie kann nicht unter 0 oder über die
 * bisherige Menge gehen. Bei 0 ist der Eintrag ganz aufgebraucht.
 */
export function applyRemaining(current: number, remaining: number): { quantity: number; usedUp: boolean } {
  const clamped = Math.min(Math.max(remaining, 0), current);
  const quantity = Math.round(clamped * 100) / 100;
  return { quantity, usedUp: quantity === 0 };
}

/** Schrittweite für den Schieberegler: Gramm/Milliliter fein, Stück/Packung in Vierteln */
export function sliderStep(unit: Unit, current: number): number {
  if (unit === "g" || unit === "ml") return current > 100 ? 10 : 1;
  return 0.25;
}

/** Menge lesbar machen: 1.5 → „1,5“, 500 g bleibt „500 g“ */
export function formatQuantity(quantity: number, unit: Unit): string {
  const number = quantity.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  return unit === "Stück" ? `${number} Stück` : `${number} ${unit}`;
}
