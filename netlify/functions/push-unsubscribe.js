const { json, removeSubscription } = require("./push-utils");

exports.handler = async event => {
  if (event.httpMethod !== "DELETE" && event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    if (!body.endpoint) return json(400, { error: "Endpoint ontbreekt." });
    const removed = await removeSubscription(body.endpoint);
    return json(200, { ok: true, removed });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
