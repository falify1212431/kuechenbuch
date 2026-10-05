import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiRateLimitError, askJson, MESSAGES, type AiProvider } from "./core";

const schema = z.object({ date: z.string().nullable() });
const request = { model: "vision" as const, system: "Lies das Datum.", prompt: "Welches Datum?" };

// Eine Attrappe statt der echten KI: antwortet der Reihe nach mit den vorgegebenen Texten
function fakeProvider(...answers: (string | Error)[]): AiProvider & { calls: number } {
  const provider = {
    calls: 0,
    async completeJson() {
      const answer = answers[provider.calls++];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  return provider;
}

const quotaOk = async () => true;

describe("askJson", () => {
  it("liefert die geprüfte Antwort", async () => {
    const provider = fakeProvider('{"date":"2026-10-12"}');
    expect(await askJson(schema, request, { provider, consumeQuota: quotaOk })).toEqual({
      ok: true,
      data: { date: "2026-10-12" },
    });
  });

  it("fragt bei kaputter Antwort genau einmal neu", async () => {
    const provider = fakeProvider("kein JSON", '{"date":null}');
    expect(await askJson(schema, request, { provider, consumeQuota: quotaOk })).toEqual({ ok: true, data: { date: null } });
    expect(provider.calls).toBe(2);
  });

  it("gibt nach zwei falschen Antworten eine freundliche Meldung", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = fakeProvider('{"datum":"falsches Feld"}', '{"date":5}');
    expect(await askJson(schema, request, { provider, consumeQuota: quotaOk })).toEqual({ ok: false, error: MESSAGES.failed });
    expect(provider.calls).toBe(2);
  });

  it("fragt die KI gar nicht erst, wenn das Tageslimit erreicht ist", async () => {
    const provider = fakeProvider('{"date":null}');
    expect(await askJson(schema, request, { provider, consumeQuota: async () => false })).toEqual({
      ok: false,
      error: MESSAGES.quota,
    });
    expect(provider.calls).toBe(0);
  });

  it("meldet das Gratis-Limit des Anbieters verständlich", async () => {
    const provider = fakeProvider(new AiRateLimitError("429"));
    expect(await askJson(schema, request, { provider, consumeQuota: quotaOk })).toEqual({
      ok: false,
      error: MESSAGES.rateLimit,
    });
  });

  it("schickt der KI das Schema mit", async () => {
    let seenSystem = "";
    const provider: AiProvider = {
      async completeJson(req) {
        seenSystem = req.system;
        return '{"date":null}';
      },
    };
    await askJson(schema, request, { provider, consumeQuota: quotaOk });
    expect(seenSystem).toContain("Lies das Datum.");
    expect(seenSystem).toContain('"date"');
  });
});
