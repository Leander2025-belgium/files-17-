import { json, removeSubscription } from "./push-utils.js";

export async function handler(event) {
  if (event.httpMethod !== "DELETE" && event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    if (!body.endpoint) return json(400, { error: "Endpoint ontbreekt." });
    const removed = await removeSubscription(body.endpoint);
    return json(200, { ok: true, removed });
  } catch (error) {
    console.error("push-unsubscribe failed", error);
    return json(500, { error: "Meldingen konden niet worden uitgeschakeld. Probeer het later opnieuw." });
  }
}
