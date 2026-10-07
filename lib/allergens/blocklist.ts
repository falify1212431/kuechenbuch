/**
 * Sperrliste für Kochvorschläge. Doppelte Sicherung: Die KI bekommt die Ausschlüsse schon im
 * Prompt, und der Server prüft hier JEDEN Vorschlag noch einmal. Ein Treffer wird verworfen.
 *
 * Bewusst streng: Auch „Pad Thai ohne Erdnüsse“ fliegt raus. Lieber ein Vorschlag weniger.
 * Jede Änderung hier braucht Tests (blocklist.test.ts).
 */

import { mentionsPeanut, normalizeForAllergens } from "./peanut";

export type BlockReason = "erdnuss" | "kokos" | "fisch" | "eigene";

export interface BlockHit {
  reason: BlockReason;
  /** Der Begriff, der getroffen hat (für Logs und Tests) */
  term: string;
}

interface FixedRule {
  reason: BlockReason;
  term: string;
  pattern: RegExp;
}

// Alle Muster arbeiten auf normalisiertem Text: klein, ä→ae, ö→oe, ü→ue, ß→ss, ohne Akzente.
// \b am Anfang = Wortanfang, damit z. B. „sate“ nicht mitten in einem Wort trifft.
const FIXED_RULES: FixedRule[] = [
  // Erdnuss: Gerichte und Produkte, die (fast) immer Erdnuss enthalten.
  // Die Erdnuss-Wörter selbst (erdnuss, peanut, arachis …) prüft mentionsPeanut.
  { reason: "erdnuss", term: "Saté/Satay", pattern: /\b(sate|satay|sateh)/ },
  { reason: "erdnuss", term: "Gado-Gado", pattern: /gado[\s-]?gado/ },
  { reason: "erdnuss", term: "Kung Pao", pattern: /kung[\s-]?pao/ },
  { reason: "erdnuss", term: "Pad Thai", pattern: /pad[\s-]?thai/ },
  { reason: "erdnuss", term: "Mafé", pattern: /\bma+fe\b/ },
  { reason: "erdnuss", term: "Erdnussflips/Bamba", pattern: /\bbamba\b|\bflips\b/ },
  { reason: "erdnuss", term: "Snickers", pattern: /snickers/ },
  { reason: "erdnuss", term: "Reese's", pattern: /\breese/ },
  // Nussmischungen enthalten oft Erdnüsse
  { reason: "erdnuss", term: "Studentenfutter", pattern: /studentenfutter|trail[\s-]?mix/ },
  { reason: "erdnuss", term: "Nussmischung", pattern: /nussmischung|nuss-mischung|gemischte nuesse|nut mix|mixed nuts/ },

  // Kokos in jeder Form
  { reason: "kokos", term: "Kokos", pattern: /kokos|coconut|\bcocos|\bkopra\b|\bcopra\b/ },
  { reason: "kokos", term: "Piña Colada", pattern: /pina[\s-]?colada/ },
  { reason: "kokos", term: "Raffaello/Bounty", pattern: /raffaello|\bbounty\b/ },
  { reason: "kokos", term: "Laksa/Tom Kha", pattern: /\blaksa\b|tom[\s-]?kha/ },

  // Saurer/eingelegter Fisch (Absprache 07.10.2026: auch Matjes und Sardellen nie; gebeizter Lachs ist okay)
  { reason: "fisch", term: "Rollmops", pattern: /rollmops/ },
  { reason: "fisch", term: "Bismarckhering", pattern: /bismarck/ },
  { reason: "fisch", term: "Brathering", pattern: /brathering/ },
  { reason: "fisch", term: "saurer Hering", pattern: /\bsauer\w*\s+hering|\bsaure[nrs]?\s+hering/ },
  { reason: "fisch", term: "marinierter Hering", pattern: /marinierte?[nrs]?\s+hering/ },
  { reason: "fisch", term: "eingelegter Fisch", pattern: /eingelegte?[nrs]?\s+(fisch|hering)/ },
  // Umgekehrte Reihenfolge: „Hering, sauer eingelegt“, „Fisch in Essig“
  { reason: "fisch", term: "eingelegter Fisch", pattern: /hering\w*[^.\n]{0,25}(sauer|eingelegt|mariniert)/ },
  { reason: "fisch", term: "Fisch in Essig", pattern: /(fisch|hering)\w*\s+in\s+essig/ },
  { reason: "fisch", term: "Heringssalat/-stipp", pattern: /heringssalat|heringsstipp|heringshaeckerle/ },
  { reason: "fisch", term: "Sauerlappen", pattern: /sauerlappen/ },
  { reason: "fisch", term: "Kronsild", pattern: /kronsild/ },
  { reason: "fisch", term: "Matjes", pattern: /matjes/ },
  { reason: "fisch", term: "Sardellen/Anchovis", pattern: /sardelle|anchovi|anchovy|boquerones/ },
  // Worcestersauce wird mit Sardellen gemacht
  { reason: "fisch", term: "Worcestersauce", pattern: /worcester/ },
  { reason: "fisch", term: "Ceviche", pattern: /ceviche/ },
  { reason: "fisch", term: "Surströmming", pattern: /surstroemming/ },
];

/** Die festen Sperren für die Anzeige in den Einstellungen und den KI-Prompt */
export const FIXED_EXCLUSIONS = [
  "Erdnuss in jeder Form (auch Erdnussöl, Erdnussbutter, Erdnusssauce, Saté/Satay, Gado-Gado, Pad Thai, Kung Pao, Nussmischungen)",
  "Kokos in jeder Form (Kokosmilch, Kokosöl, Kokosraspeln, Kokosblütenzucker …)",
  "saurer oder eingelegter Fisch (Rollmops, Bismarckhering, Brathering, Heringssalat, Ceviche …)",
  "Matjes",
  "Sardellen/Anchovis (auch in Worcestersauce)",
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Eigene Begriffe aus den Vorlieben (Allergien, „Mag ich nicht“).
 * Ab 4 Buchstaben zählt jedes Vorkommen („Sellerie“ trifft auch „Knollensellerie“),
 * kürzere Begriffe nur am Wortanfang („Ei“ trifft „Eier“, aber nicht „Reis“).
 */
function customPattern(term: string): RegExp | null {
  const normalized = normalizeForAllergens(term).replace(/\s+/g, " ").trim();
  if (normalized.length < 2) return null;
  const escaped = escapeRegExp(normalized);
  return normalized.length >= 4 ? new RegExp(escaped) : new RegExp(`(^|[^a-z])${escaped}`);
}

/**
 * Prüft Texte (Titel, Zutaten, Schritte …) gegen die feste Sperrliste und eigene Begriffe.
 * Gibt den ersten Treffer zurück oder null, wenn alles in Ordnung ist.
 */
export function findBlocked(texts: (string | null | undefined)[], customTerms: string[] = []): BlockHit | null {
  const joined = texts.filter(Boolean).join("\n");
  if (mentionsPeanut(joined)) return { reason: "erdnuss", term: "Erdnuss" };

  const normalized = normalizeForAllergens(joined);
  for (const rule of FIXED_RULES) {
    if (rule.pattern.test(normalized)) return { reason: rule.reason, term: rule.term };
  }
  for (const term of customTerms) {
    const pattern = customPattern(term);
    if (pattern?.test(normalized)) return { reason: "eigene", term };
  }
  return null;
}
