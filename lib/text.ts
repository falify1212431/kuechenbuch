/**
 * Macht Text vergleichbar: klein geschrieben, Umlaute ausgeschrieben, Leerraum bereinigt.
 * So gelten „Hähnchen“, „haehnchen“ und „ HÄHNCHEN “ als gleich.
 */
export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/\s+/g, " ")
    .trim();
}
