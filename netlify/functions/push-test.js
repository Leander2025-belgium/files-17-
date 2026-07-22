import { json, readSubscriptions, sendPush } from "./push-utils.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    const subscriptions = await readSubscriptions();
    const target =
      subscriptions.find(item => item.id === body.installationId) ||
      subscriptions.find(item => item.subscription?.endpoint === body.endpoint);

    if (!target) return json(404, { error: "Geen abonnement gevonden." });

    const result = await sendPush(target, {
      title: "Weerscoop testmelding",
      body: "Testmelding verzonden. Sluit Weerscoop om te controleren of meldingen buiten de app aankomen.",
      icon: "./icons/icon-192.png",
      badge: "./icons/badge-96.png",
      tag: "weerscoop-test",
      renotify: true,
      url: "./",
      type: "test"
    });

    return json(result.ok ? 200 : 500, result.ok ? { ok: true } : {
      error: "Testmelding kon niet worden verzonden. Probeer het later opnieuw."
    });
  } catch (error) {
    console.error("push-test failed", error);
    return json(500, { error: "Testmelding kon niet worden verzonden. Probeer het later opnieuw." });
  }
}
