// Verschieben im Wochenplan: Ist das Ziel frei, wandert der Eintrag dorthin.
// Ist es belegt, tauschen die beiden Einträge ihren Inhalt.

export interface PlanContent {
  recipe_id: string | null;
  free_text: string | null;
  leftovers_recipe_id: string | null;
  skip: boolean;
  cooked: boolean;
}

export interface PlanEntry extends PlanContent {
  id: string;
  date: string;
  slot: string;
}

export type PlanUpdate = { id: string } & ({ date: string; slot: string } | PlanContent);

function contentOf(entry: PlanEntry): PlanContent {
  return {
    recipe_id: entry.recipe_id,
    free_text: entry.free_text,
    leftovers_recipe_id: entry.leftovers_recipe_id,
    skip: entry.skip,
    cooked: entry.cooked,
  };
}

/**
 * Was muss sich in der Datenbank ändern?
 * - Ziel frei: nur Datum/Mahlzeit des Eintrags ändern.
 * - Ziel belegt: Inhalte tauschen (die Plätze bleiben, so gibt es keinen Konflikt mit
 *   „pro Tag und Mahlzeit nur ein Eintrag“).
 * - Ziel = Quelle: nichts tun.
 */
export function planMove(entries: PlanEntry[], id: string, target: { date: string; slot: string }): PlanUpdate[] {
  const source = entries.find((entry) => entry.id === id);
  if (!source) return [];
  if (source.date === target.date && source.slot === target.slot) return [];

  const occupant = entries.find((entry) => entry.date === target.date && entry.slot === target.slot);
  if (!occupant) return [{ id: source.id, date: target.date, slot: target.slot }];
  return [
    { id: source.id, ...contentOf(occupant) },
    { id: occupant.id, ...contentOf(source) },
  ];
}
