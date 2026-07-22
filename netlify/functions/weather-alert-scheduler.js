import { json, readSubscriptions, sendPush, wasSentRecently } from "./push-utils.js";

export const config = { schedule: "*/30 * * * *" };

export async function handler() {
  const subscriptions = await readSubscriptions();
  let sent = 0;
  for (const item of subscriptions) {
    const alert = await buildWeatherAlert(item);
    if (!alert) continue;
    const eventId = `${item.id}:${alert.type}:${alert.period}`;
    if (await wasSentRecently(eventId, 6 * 60 * 60 * 1000)) continue;
    const result = await sendPush(item, {
      title: alert.title,
      body: alert.body,
      tag: eventId,
      renotify: false,
      requireInteraction: alert.urgent,
      url: "./",
      type: alert.type
    });
    if (result.ok) sent++;
  }
  return json(200, { ok: true, checked: subscriptions.length, sent });
}

async function buildWeatherAlert(item) {
  const loc = item.location || {};
  if (loc.lat == null || loc.lon == null) return null;
  const p = item.preferences || {};
  const t = item.thresholds || {};
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", loc.lat);
  url.searchParams.set("longitude", loc.lon);
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("hourly", "precipitation_probability,precipitation,weather_code,wind_gusts_10m,uv_index,temperature_2m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max,uv_index_max");
  url.searchParams.set("models", "knmi_seamless");
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const now = Date.now();
  const h = data.hourly || {};
  const next6 = (h.time || []).map((time, i) => ({ time, i })).filter(x => {
    const ms = new Date(x.time).getTime();
    return ms >= now && ms <= now + 6 * 60 * 60 * 1000;
  });
  const maxPop = Math.max(0, ...next6.map(x => h.precipitation_probability?.[x.i] || 0));
  const maxRain = Math.max(0, ...next6.map(x => h.precipitation?.[x.i] || 0));
  const maxGust = Math.max(0, ...(h.wind_gusts_10m || []).slice(0, 24));
  const maxTemp = Math.max(...(h.temperature_2m || []).slice(0, 24));
  const minTemp = Math.min(...(h.temperature_2m || []).slice(0, 24));
  const maxUv = Math.max(0, ...(h.uv_index || []).slice(0, 24));
  const thunder = next6.some(x => [95, 96, 99].includes(h.weather_code?.[x.i]));
  const snow = next6.some(x => [71, 73, 75, 77, 85, 86].includes(h.weather_code?.[x.i]));
  const icy = minTemp <= (t.frost ?? 0) && maxPop >= 40;
  const place = loc.name || "je locatie";
  const period = new Date().toISOString().slice(0, 13);

  if (p.thunder && thunder) return { type: "thunder", period, urgent: true, title: "Onweer mogelijk", body: `Er is onweer mogelijk rond ${place}.` };
  if (p.heavyRain && (maxPop >= (t.rainProbability ?? 70) || maxRain >= 8)) return { type: "heavy-rain", period, urgent: false, title: "Regenwaarschuwing", body: `Hoge kans op regen rond ${place}: tot ${Math.round(maxPop)}%.` };
  if (p.wind && maxGust >= (t.windGust ?? 70)) return { type: "wind", period, urgent: true, title: "Sterke windstoten", body: `Windstoten tot ${Math.round(maxGust)} km/u rond ${place}.` };
  if (p.heat && maxTemp >= (t.heat ?? 30)) return { type: "heat", period, urgent: false, title: "Hitte", body: `Temperatuur kan oplopen tot ${Math.round(maxTemp)} graden rond ${place}.` };
  if (p.frost && minTemp <= (t.frost ?? 0)) return { type: "frost", period, urgent: false, title: "Vorst", body: `Temperatuur kan dalen tot ${Math.round(minTemp)} graden rond ${place}.` };
  if (p.uv && maxUv >= 6) return { type: "uv", period, urgent: false, title: "Sterke UV", body: `UV-index wordt ${Math.round(maxUv)} rond ${place}. Bescherm je huid.` };
  if (p.snow && snow) return { type: "snow", period, urgent: false, title: "Sneeuw mogelijk", body: `Er is kans op sneeuw rond ${place}.` };
  if (p.ice && icy) return { type: "ice", period, urgent: false, title: "Kans op gladheid", body: `Kans op gladheid rond ${place}.` };
  return null;
}
