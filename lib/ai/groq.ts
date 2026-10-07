// KI-Anbieter Groq (kostenloser Tarif). Schnittstelle ist kompatibel zu OpenAI.
// Doku: https://console.groq.com/docs

import { AiRateLimitError, type AiProvider, type AiRequest } from "./core";

const URL = "https://api.groq.com/openai/v1/chat/completions";

// Welche Modelle genutzt werden, steht in den Umgebungsvariablen (austauschbar ohne Code-Änderung)
const MODEL_VARIABLES = { small: "AI_MODEL_SMALL", text: "AI_MODEL_TEXT", vision: "AI_MODEL_VISION" } as const;

function modelFor(kind: AiRequest["model"]): string {
  // Ohne eigenes Text-Modell wird das kleine genommen
  const model = process.env[MODEL_VARIABLES[kind]] ?? (kind === "text" ? process.env.AI_MODEL_SMALL : undefined);
  if (!model) throw new Error(`Umgebungsvariable ${MODEL_VARIABLES[kind]} fehlt`);
  return model;
}

export const groqProvider: AiProvider = {
  async completeJson(request) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("Umgebungsvariable GROQ_API_KEY fehlt");

    // Nur-Text-Modelle wollen einfachen Text, Bild-Modelle eine Liste aus Text und Bildern
    const images = request.images ?? [];
    const content =
      images.length === 0
        ? request.prompt
        : [
            { type: "text", text: request.prompt },
            ...images.map((image) => ({
              type: "image_url",
              image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
            })),
          ];

    const model = modelFor(request.model);
    const response = await fetch(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        temperature: request.temperature ?? 0.1,
        // Die gpt-oss-Modelle „denken“ vor der Antwort; wenig Denken = schneller und spart Gratis-Kontingent
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (response.status === 429) throw new AiRateLimitError("Groq: zu viele Anfragen");
    if (!response.ok) throw new Error(`Groq antwortet mit ${response.status}: ${(await response.text()).slice(0, 300)}`);

    const body = await response.json();
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("Groq: Antwort ohne Text");
    return text;
  },
};
