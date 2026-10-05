// KI-Anbieter Groq (kostenloser Tarif). Schnittstelle ist kompatibel zu OpenAI.
// Doku: https://console.groq.com/docs

import { AiRateLimitError, type AiProvider, type AiRequest } from "./core";

const URL = "https://api.groq.com/openai/v1/chat/completions";

// Welche Modelle genutzt werden, steht in den Umgebungsvariablen (austauschbar ohne Code-Änderung)
function modelFor(kind: AiRequest["model"]): string {
  const model = kind === "vision" ? process.env.AI_MODEL_VISION : process.env.AI_MODEL_SMALL;
  if (!model) throw new Error(`Umgebungsvariable ${kind === "vision" ? "AI_MODEL_VISION" : "AI_MODEL_SMALL"} fehlt`);
  return model;
}

export const groqProvider: AiProvider = {
  async completeJson(request) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("Umgebungsvariable GROQ_API_KEY fehlt");

    const content = [
      { type: "text", text: request.prompt },
      ...(request.images ?? []).map((image) => ({
        type: "image_url",
        image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
      })),
    ];

    const response = await fetch(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelFor(request.model),
        messages: [
          { role: "system", content: request.system },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (response.status === 429) throw new AiRateLimitError("Groq: zu viele Anfragen");
    if (!response.ok) throw new Error(`Groq antwortet mit ${response.status}: ${(await response.text()).slice(0, 300)}`);

    const body = await response.json();
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("Groq: Antwort ohne Text");
    return text;
  },
};
