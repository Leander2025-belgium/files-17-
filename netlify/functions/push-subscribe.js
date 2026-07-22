import {
  json,
  readSubscriptions,
  writeSubscriptions,
  subscriptionId,
  safeLocation,
  defaultPreferences,
  userIdFromAuthorization
} from "./push-utils.js";
import { createClient } from "@supabase/supabase-js";

function supabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    if (!body.subscription?.endpoint || !body.subscription?.keys?.p256dh || !body.subscription?.keys?.auth) {
      return json(400, { error: "Ongeldig push-abonnement." });
    }
    const subscriptions = await readSubscriptions();
    const id = body.installationId || subscriptionId(body.subscription);
    const prefs = defaultPreferences(body.preferences, body.thresholds);
    const userId = await userIdFromAuthorization(event.headers);
    const entry = {
      id,
      userId,
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
    const supabase = supabaseAdminClient();
    if (supabase && userId) {
      await supabase.from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: body.subscription.endpoint,
        p256dh: body.subscription.keys.p256dh,
        auth: body.subscription.keys.auth,
        location_name: entry.location.name,
        latitude: entry.location.lat,
        longitude: entry.location.lon,
        preferences: { preferences: entry.preferences, thresholds: entry.thresholds }
      }, { onConflict: "endpoint" }).throwOnError();
    }
    return json(200, { ok: true, id, count: next.length });
  } catch (error) {
    console.error("push-subscribe failed", error);
    return json(500, { error: "Meldingen konden niet worden ingesteld. Probeer het later opnieuw." });
  }
}
