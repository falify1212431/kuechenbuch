import type { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { askJson, type AiProvider, type AiRequest, type AiResult } from "./core";
import { groqProvider } from "./groq";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Anbieter per Umgebungsvariable wählen. Weitere (z. B. Gemini) kommen hier dazu.
function provider(): AiProvider {
  const name = process.env.AI_PROVIDER ?? "groq";
  if (name === "groq") return groqProvider;
  throw new Error(`Unbekannter KI-Anbieter: ${name}`);
}

/** Eigenes Tageslimit der App (Standard: 50 KI-Aufrufe pro Tag) */
function dailyLimit(): number {
  const value = Number(process.env.AI_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : 50;
}

/** KI fragen – mit Tageslimit aus der Datenbank und dem eingestellten Anbieter */
export async function askAi<T>(supabase: Supabase, schema: z.ZodType<T>, request: AiRequest): Promise<AiResult<T>> {
  return askJson(schema, request, {
    provider: provider(),
    consumeQuota: async () => {
      const { data, error } = await supabase.rpc("consume_ai_quota", { day_limit: dailyLimit() });
      if (error) throw new Error(`Tageslimit prüfen fehlgeschlagen: ${error.message}`);
      return data === true;
    },
  });
}
