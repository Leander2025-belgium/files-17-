import { json } from "./push-utils.js";

const MODEL = process.env.WEERSCOOP_ASSISTANT_MODEL || "gpt-4.1-mini";

export async function handler() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.WEERSCOOP_AI_API_KEY || "";
  if (!apiKey) {
    return json(200, {
      configured: false,
      reachable: false,
      model: MODEL,
      status: "OPENAI_API_KEY ontbreekt in Netlify Environment variables."
    });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      return json(200, {
        configured: true,
        reachable: false,
        model: MODEL,
        status: `OpenAI antwoordde met status ${res.status}. Controleer key, billing en projectrechten.`
      });
    }
    return json(200, {
      configured: true,
      reachable: true,
      model: MODEL,
      status: "OpenAI-key is zichtbaar voor Netlify Functions."
    });
  } catch {
    return json(200, {
      configured: true,
      reachable: false,
      model: MODEL,
      status: "OpenAI kon niet bereikt worden vanuit Netlify."
    });
  }
}
