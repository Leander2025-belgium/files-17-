const { getStore } = require("@netlify/blobs");
const webpush = require("web-push");
const crypto = require("crypto");

const SUBSCRIPTIONS_KEY = "subscriptions";
const DEDUPE_PREFIX = "sent:";

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:beheer@weerscoop.be";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY en VAPID_PRIVATE_KEY ontbreken.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function store() {
  return getStore("weerscoop-push");
}

async function readSubscriptions() {
  return (await store().get(SUBSCRIPTIONS_KEY, { type: "json" })) || [];
}

async function writeSubscriptions(items) {
  await store().setJSON(SUBSCRIPTIONS_KEY, items);
}

function subscriptionId(subscription) {
  return crypto.createHash("sha256").update(subscription.endpoint || "").digest("hex");
}

function safeLocation(loc = {}) {
  return {
    name: String(loc.name || "Onbekende locatie").slice(0, 80),
    admin: String(loc.admin || "").slice(0, 120),
    lat: Number.isFinite(+loc.lat) ? Math.round(+loc.lat * 100) / 100 : null,
    lon: Number.isFinite(+loc.lon) ? Math.round(+loc.lon * 100) / 100 : null
  };
}

function defaultPreferences(prefs = {}, thresholds = {}) {
  return {
    preferences: {
      codeYellow: prefs.codeYellow !== false,
      codeOrange: prefs.codeOrange !== false,
      codeRed: prefs.codeRed !== false,
      thunder: prefs.thunder !== false,
      heavyRain: prefs.heavyRain !== false,
      snow: prefs.snow !== false,
      ice: prefs.ice !== false,
      wind: prefs.wind !== false,
      heat: prefs.heat !== false,
      frost: prefs.frost !== false,
      uv: prefs.uv !== false,
      rainSoon: prefs.rainSoon !== false,
      dailyMorning: prefs.dailyMorning === true,
      coast: prefs.coast !== false
    },
    thresholds: {
      rainProbability: clampNumber(thresholds.rainProbability, 0, 100, 70),
      windGust: clampNumber(thresholds.windGust, 0, 180, 70),
      heat: clampNumber(thresholds.heat, 20, 50, 30),
      frost: clampNumber(thresholds.frost, -30, 10, 0)
    }
  };
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function removeSubscription(endpoint) {
  const items = await readSubscriptions();
  const next = items.filter(item => item.subscription?.endpoint !== endpoint);
  await writeSubscriptions(next);
  return items.length - next.length;
}

async function sendPush(item, payload) {
  configureWebPush();
  try {
    await webpush.sendNotification(item.subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await removeSubscription(item.subscription.endpoint);
    }
    return { ok: false, error: error.message };
  }
}

async function wasSentRecently(eventId, ttlMs) {
  const key = DEDUPE_PREFIX + eventId;
  const existing = await store().get(key, { type: "json" });
  if (existing?.sentAt && Date.now() - existing.sentAt < ttlMs) return true;
  await store().setJSON(key, { sentAt: Date.now() });
  return false;
}

module.exports = {
  json,
  readSubscriptions,
  writeSubscriptions,
  subscriptionId,
  safeLocation,
  defaultPreferences,
  sendPush,
  removeSubscription,
  wasSentRecently
};
