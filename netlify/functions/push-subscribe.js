const {
  json,
  readSubscriptions,
  writeSubscriptions,
  subscriptionId,
  safeLocation,
  defaultPreferences
} = require("./push-utils");

exports.handler = async event => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    if (!body.subscription?.endpoint || !body.subscription?.keys?.p256dh || !body.subscription?.keys?.auth) {
      return json(400, { error: "Ongeldig push-abonnement." });
    }
    const subscriptions = await readSubscriptions();
    const id = body.installationId || subscriptionId(body.subscription);
    const prefs = defaultPreferences(body.preferences, body.thresholds);
    const entry = {
      id,
      endpointHash: subscriptionId(body.subscription),
      subscription: body.subscription,
      location: safeLocation(body.location),
      preferences: prefs.preferences,
      thresholds: prefs.thresholds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const next = subscriptions.filter(item => item.id !== id && item.subscription?.endpoint !== body.subscription.endpoint);
    next.push(entry);
    await writeSubscriptions(next);
    return json(200, { ok: true, id, count: next.length });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
