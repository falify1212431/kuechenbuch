/**
 * Verschiebt einen Eintrag in einer sortierten Liste um eine Stelle nach oben (-1) oder unten (+1).
 * Gibt die neue Reihenfolge zurück, oder null, wenn es nicht weitergeht (schon ganz oben/unten).
 */
export function moveInList(ids: string[], id: string, direction: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  const result = [...ids];
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}
