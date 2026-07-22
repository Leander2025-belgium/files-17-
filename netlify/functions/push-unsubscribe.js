import { json, removeSubscription } from "./push-utils.js";
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
  if (event.httpMethod !== "DELETE" && event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = JSON.parse(event.body || "{}");
    if (!body.endpoint) return json(400, { error: "Endpoint ontbreekt." });
    const removed = await removeSubscription(body.endpoint);
    const supabase = supabaseAdminClient();
    if (supabase) await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
    return json(200, { ok: true, removed });
  } catch (error) {
    console.error("push-unsubscribe failed", error);
    return json(500, { error: "Meldingen konden niet worden uitgeschakeld. Probeer het later opnieuw." });
  }
}
