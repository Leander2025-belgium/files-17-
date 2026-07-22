import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import { json, userIdFromAuthorization } from "./push-utils.js";

function safeText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function validDate(value, maxDays = 7) {
  const time = new Date(value).getTime();
  const now = Date.now();
  if (!Number.isFinite(time) || time < now || time > now + maxDays * 24 * 60 * 60 * 1000) return null;
  return new Date(time).toISOString();
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    const reminder = body.reminder || {};
    const triggerAt = validDate(reminder.triggerAt);
    const expiresAt = validDate(reminder.expiresAt || reminder.triggerAt, 8);
    if (!triggerAt || !body.endpoint) return json(400, { error: "Herinnering is ongeldig." });
    const userId = await userIdFromAuthorization(event.headers);
    const id = crypto.randomUUID();
    const entry = {
      id,
      userId,
      installationId: safeText(body.installationId, 120),
      endpoint: String(body.endpoint),
      title: safeText(reminder.title, 90) || "Weerscoop herinnering",
      body: safeText(reminder.body, 180) || "Je gekozen weersmoment begint binnenkort.",
      triggerAt,
      expiresAt,
      location: {
        name: safeText(body.location?.name, 90),
        lat: Number.isFinite(+body.location?.lat) ? Math.round(+body.location.lat * 100) / 100 : null,
        lon: Number.isFinite(+body.location?.lon) ? Math.round(+body.location.lon * 100) / 100 : null
      },
      sentAt: null,
      createdAt: new Date().toISOString()
    };
    const store = getStore("assistant-reminders");
    const list = (await store.get("items", { type: "json" }).catch(() => [])) || [];
    const active = list.filter(item => !item.sentAt && new Date(item.expiresAt).getTime() > Date.now()).slice(-200);
    active.push(entry);
    await store.setJSON("items", active);
    return json(200, { ok: true, id });
  } catch (error) {
    console.error("assistant-reminder failed", error);
    return json(500, { error: "Herinnering kon niet worden opgeslagen." });
  }
}
