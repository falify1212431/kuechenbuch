// Die KI-Schnittstelle der App. Hier steckt nichts Anbieter-Spezifisches drin:
// Groq, Gemini oder später Claude sind nur verschiedene „Provider“.

import { z } from "zod";

/** "small" für Kleinkram (Text), "vision" für alles mit Bildern */
export type AiModel = "small" | "vision";

export interface AiImage {
  mimeType: string;
  base64: string;
}

export interface AiRequest {
  model: AiModel;
  /** Feste Regeln für die KI (Rolle, Sprache, Format) */
  system: string;
  /** Die eigentliche Aufgabe */
  prompt: string;
  images?: AiImage[];
}

/** Ein KI-Anbieter muss nur eins können: auf eine Anfrage mit JSON-Text antworten */
export interface AiProvider {
  completeJson(request: AiRequest): Promise<string>;
}

/** Der Anbieter meldet „zu viele Anfragen“ (sein Gratis-Limit) */
export class AiRateLimitError extends Error {}

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const MESSAGES = {
  quota: "KI-Kontingent für heute aufgebraucht, morgen wieder.",
  rateLimit: "Die KI ist gerade ausgelastet. Bitte versuch es in einer Minute noch einmal.",
  failed: "Die KI hat gerade keine brauchbare Antwort geliefert. Bitte versuch es noch einmal.",
};

/**
 * Fragt die KI und verlangt eine Antwort, die genau zum zod-Schema passt.
 * - Erst wird das eigene Tageslimit geprüft (consumeQuota).
 * - Ungültige Antworten werden einmal neu angefragt, dann gibt es eine freundliche Fehlermeldung.
 */
export async function askJson<T>(
  schema: z.ZodType<T>,
  request: AiRequest,
  deps: { provider: AiProvider; consumeQuota: () => Promise<boolean> },
): Promise<AiResult<T>> {
  if (!(await deps.consumeQuota())) return { ok: false, error: MESSAGES.quota };

  const system =
    `${request.system}\n\nAntworte ausschließlich mit einem JSON-Objekt nach diesem JSON-Schema, ohne weiteren Text:\n` +
    JSON.stringify(z.toJSONSchema(schema));

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await deps.provider.completeJson({ ...request, system });
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return { ok: true, data: parsed.data };
      console.error(`KI-Antwort passt nicht zum Schema (Versuch ${attempt}):`, parsed.error.issues.slice(0, 3));
    } catch (error) {
      if (error instanceof AiRateLimitError) return { ok: false, error: MESSAGES.rateLimit };
      console.error(`KI-Aufruf fehlgeschlagen (Versuch ${attempt}):`, error);
    }
  }
  return { ok: false, error: MESSAGES.failed };
}
