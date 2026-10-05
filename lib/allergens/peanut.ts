/**
 * Erdnuss-Check für Produkte. Sehr starke Allergie: Im Zweifel wird gewarnt.
 *
 * Ergebnis:
 * - "erdnuss":    enthält Erdnuss → rote Warnung, muss aktiv weggeklickt werden
 * - "spuren":     kann Spuren von Erdnuss enthalten → gelbe Warnung
 * - "ungeprueft": keine verlässlichen Angaben (oder nur von der KI erkannt) → „Packung lesen“
 * - "frei":       laut Datenbank keine Erdnuss – die Packung trotzdem selbst prüfen
 */
export type PeanutStatus = "erdnuss" | "spuren" | "ungeprueft" | "frei";

/** Wörter für Erdnuss in den Sprachen, die auf Packungen in Deutschland vorkommen */
const PEANUT_WORDS = ["erdnuss", "erdnuess", "peanut", "arachis", "arachide", "cacahuete", "cacahuate", "groundnut", "pinda"];

/** Formulierungen vor dem Erdnuss-Wort, die „kann Spuren enthalten“ bedeuten */
const TRACE_PHRASES = ["spuren", "may contain", "traces", "peut contenir", "puo contenere", "betrieb"];

/** Kleinbuchstaben, Umlaute ausgeschrieben, Akzente entfernt (cacahuète → cacahuete) */
export function normalizeForAllergens(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Kommt irgendein Erdnuss-Wort im Text vor? */
export function mentionsPeanut(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = normalizeForAllergens(text);
  return PEANUT_WORDS.some((word) => normalized.includes(word));
}

/**
 * Findet Erdnuss im Zutatentext und unterscheidet „enthält“ von „kann Spuren enthalten“.
 * Steht ein Erdnuss-Wort irgendwo ohne Spuren-Hinweis davor, gilt es als enthalten.
 */
function checkIngredientsText(text: string): "erdnuss" | "spuren" | null {
  const normalized = normalizeForAllergens(text);
  let result: "erdnuss" | "spuren" | null = null;

  for (const word of PEANUT_WORDS) {
    let index = normalized.indexOf(word);
    while (index !== -1) {
      // Den Satz rund um den Fund ansehen: Ist es ein Spuren-Hinweis?
      const sentenceStart = Math.max(
        normalized.lastIndexOf(".", index),
        normalized.lastIndexOf(";", index),
        normalized.lastIndexOf("\n", index),
      );
      const ends = [".", ";", "\n"].map((mark) => normalized.indexOf(mark, index)).filter((i) => i !== -1);
      const sentenceEnd = ends.length > 0 ? Math.min(...ends) : normalized.length;
      const before = normalized.slice(sentenceStart + 1, index);
      const after = normalized.slice(index, sentenceEnd);
      const isTrace =
        TRACE_PHRASES.some((phrase) => before.includes(phrase)) ||
        (/\bkann\b/.test(before) && after.includes("enthalten")) ||
        after.includes("verarbeitet");
      if (!isTrace) return "erdnuss"; // Einmal sicher enthalten reicht
      result = "spuren";
      index = normalized.indexOf(word, index + word.length);
    }
  }
  return result;
}

export interface PeanutInput {
  /** Name des Produkts (z. B. „Erdnussflips“) */
  name?: string | null;
  /** Allergene laut Datenbank, z. B. ["en:peanuts"]; null = keine Angabe */
  allergens?: string[] | null;
  /** Spuren laut Datenbank, z. B. ["en:nuts"]; null = keine Angabe */
  traces?: string[] | null;
  ingredientsText?: string | null;
  /** Woher die Angaben stammen: nur Datenbank-Treffer gelten als geprüft */
  source: "off" | "ki" | "manuell";
}

const hasPeanutTag = (tags: string[] | null | undefined) =>
  (tags ?? []).some((tag) => tag.toLowerCase().endsWith(":peanuts") || mentionsPeanut(tag));

export function checkPeanut(input: PeanutInput): PeanutStatus {
  // 1. Eindeutige Treffer zuerst – egal woher die Daten stammen
  if (hasPeanutTag(input.allergens) || mentionsPeanut(input.name)) return "erdnuss";
  const fromText = input.ingredientsText ? checkIngredientsText(input.ingredientsText) : null;
  if (fromText === "erdnuss") return "erdnuss";
  if (hasPeanutTag(input.traces) || fromText === "spuren") return "spuren";

  // 2. Kein Treffer – aber sind die Angaben überhaupt verlässlich?
  if (input.source !== "off") return "ungeprueft";
  const hasAllergenData = input.allergens !== null && input.allergens !== undefined;
  const hasIngredients = Boolean(input.ingredientsText?.trim());
  if (!hasAllergenData || !hasIngredients) return "ungeprueft";
  return "frei";
}

/** Texte für die Anzeige */
export const PEANUT_MESSAGES: Record<PeanutStatus, { title: string; text: string }> = {
  erdnuss: {
    title: "Achtung: enthält Erdnuss!",
    text: "Dieses Produkt enthält laut Angaben Erdnuss. Nicht essen.",
  },
  spuren: {
    title: "Kann Spuren von Erdnuss enthalten",
    text: "Laut Angaben sind Spuren von Erdnuss möglich. Bei starker Allergie meiden.",
  },
  ungeprueft: {
    title: "Allergene nicht geprüft – Packung lesen",
    text: "Für dieses Produkt gibt es keine verlässlichen Allergen-Angaben. Bitte die Zutatenliste auf der Packung lesen.",
  },
  frei: {
    title: "Laut Datenbank keine Erdnuss",
    text: "Die App ersetzt nicht das Lesen der Zutatenliste. Bitte trotzdem kurz auf der Packung prüfen.",
  },
};
