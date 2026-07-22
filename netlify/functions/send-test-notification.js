const { json, readSubscriptions, sendPush } = require("./push-utils");

exports.handler = async event => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    const subscriptions = await readSubscriptions();
    const target = subscriptions.find(item => item.id === body.installationId) || subscriptions.find(item => item.subscription?.endpoint === body.endpoint);
    if (!target) return json(404, { error: "Geen abonnement gevonden." });
    const result = await sendPush(target, {
      title: "Weerscoop testmelding",
      body: "Testmelding verzonden. Sluit Weerscoop om te controleren of meldingen buiten de app aankomen.",
      tag: "weerscoop-test",
      renotify: true,
      url: "./",
      type: "test"
    });
    return json(result.ok ? 200 : 500, result.ok ? { ok: true } : { error: result.error });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
