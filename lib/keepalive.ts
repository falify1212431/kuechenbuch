import { timingSafeEqual } from "node:crypto";

/**
 * Kommt der Aufruf wirklich von Vercel Cron? Vercel schickt automatisch
 * „Authorization: Bearer <CRON_SECRET>“ mit, wenn die Variable CRON_SECRET gesetzt ist.
 * Ohne (oder mit zu kurzem) Geheimnis wird immer abgelehnt.
 */
export function isCronRequest(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  // Vergleich mit gleicher Laufzeit, damit man das Geheimnis nicht Zeichen für Zeichen erraten kann
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
