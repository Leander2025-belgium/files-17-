const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const THUNDER_CODES = new Set([95, 96, 99]);
const HEAVY_CODES = new Set([65, 82, 95, 96, 99]);

export const RAIN_ETA_SCHEMA_VERSION = 1;

function asDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" || /^\d{10}$/.test(String(value))) {
    const epoch = new Date(Number(value) * 1000);
    return Number.isFinite(epoch.getTime()) ? epoch : null;
  }
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}:00`;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

function closestIndex(values, targetMs) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  values.forEach((value, index) => {
    const date = asDate(value);
    if (!date) return;
    const distance = Math.abs(date.getTime() - targetMs);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function intensityFor(maxRain) {
  if (maxRain >= 3) return { id: "heavy", label: "Zware regen" };
  if (maxRain >= 1) return { id: "moderate", label: "Regen" };
  if (maxRain >= 0.1) return { id: "light", label: "Lichte regen" };
  return { id: "none", label: "Droog" };
}

function confidenceFor(slots, maxRain) {
  const coverage = Math.min(1, slots.length / 8);
  const variability = slots.reduce(
    (sum, slot, index) => index ? sum + Math.abs(slot.precipitation - slots[index - 1].precipitation) : 0,
    0
  );
  const variabilityPenalty = Math.min(0.22, variability / 18);
  const weakSignalPenalty = maxRain > 0 && maxRain < 0.18 ? 0.12 : 0;
  return Math.max(0.35, Math.min(0.92, 0.58 + coverage * 0.26 - variabilityPenalty - weakSignalPenalty));
}

function minuteRange(minutes, confidence) {
  if (minutes == null) return "onbekend";
  if (confidence >= 0.78) return `±${Math.max(1, Math.round(minutes))} min`;
  return `${Math.max(0, Math.round(minutes - 10))}-${Math.round(minutes + 10)} min`;
}

function shortTime(value, timeZone) {
  const date = asDate(value);
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timeZone || "Europe/Brussels"
  }).format(date);
}

function unavailable(location, now, summary = "Er is nu geen bruikbare korte-termijn neerslagdata.") {
  return {
    schemaVersion: RAIN_ETA_SCHEMA_VERSION,
    location,
    status: "unavailable",
    title: "Nowcast tijdelijk niet beschikbaar",
    summary,
    startsInMinutes: null,
    startTime: null,
    endTime: null,
    endsInMinutes: null,
    intensity: "unknown",
    intensityLabel: "Onbekend",
    dryWindowMinutes: null,
    confidence: 0,
    heavyShower: false,
    thunderPossible: false,
    source: "Geen actuele nowcast",
    slots: [],
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString()
  };
}

export function computeRainETA(forecast, { now = new Date(), name = "Mijn locatie", latitude, longitude } = {}) {
  const minutely = forecast?.minutely_15;
  const location = {
    name,
    latitude: Number(latitude ?? forecast?.latitude),
    longitude: Number(longitude ?? forecast?.longitude),
    timezone: forecast?.timezone || "Europe/Brussels"
  };
  if (!minutely?.time?.length || !Array.isArray(minutely.precipitation)) {
    return unavailable(location, now);
  }

  const nowMs = now.getTime();
  const index = closestIndex(minutely.time, nowMs);
  const frame = asDate(minutely.time[index]);
  if (!frame || Math.abs(frame.getTime() - nowMs) > 45 * 60_000) {
    const result = unavailable(location, now, "De korte-termijn neerslagdata is te oud of ontbreekt.");
    result.source = "Nowcast verouderd";
    return result;
  }

  const slots = [];
  const endIndex = Math.min(minutely.time.length, index + 12);
  for (let i = index; i < endIndex; i += 1) {
    const time = asDate(minutely.time[i]);
    if (!time) continue;
    const precipitation = Math.max(0, Number(minutely.precipitation[i]) || 0);
    const rawCode = Number(minutely.weather_code?.[i]);
    const weatherCode = Number.isFinite(rawCode) ? rawCode : null;
    slots.push({
      time: time.toISOString(),
      minutes: Math.max(0, Math.round((time.getTime() - nowMs) / 60_000)),
      precipitation,
      weatherCode,
      wet: precipitation >= 0.1 || RAIN_CODES.has(weatherCode)
    });
  }
  if (!slots.length) return unavailable(location, now);

  const rainingNow = slots[0].wet;
  const firstWetIndex = slots.findIndex(slot => slot.wet);
  const firstWet = firstWetIndex >= 0 ? slots[firstWetIndex] : null;
  const firstDryAfterWetIndex = firstWetIndex >= 0
    ? slots.findIndex((slot, slotIndex) => slotIndex > firstWetIndex && !slot.wet)
    : -1;
  const firstDryAfterWet = firstDryAfterWetIndex >= 0 ? slots[firstDryAfterWetIndex] : null;
  const maxRain = Math.max(0, ...slots.map(slot => slot.precipitation));
  const hourly = forecast?.hourly || {};
  const hourlyIndex = Array.isArray(hourly.time) && hourly.time.length
    ? closestIndex(hourly.time, nowMs)
    : 0;
  const hourlyCodes = hourly.weather_code || [];
  const thunderPossible = slots.some(slot => THUNDER_CODES.has(slot.weatherCode))
    || hourlyCodes.slice(hourlyIndex, hourlyIndex + 6).some(code => THUNDER_CODES.has(Number(code)));
  const heavyShower = maxRain >= 3 || slots.some(slot => HEAVY_CODES.has(slot.weatherCode));
  const intensity = intensityFor(maxRain);
  const confidence = confidenceFor(slots, maxRain);
  const status = rainingNow ? "raining" : firstWet ? "rain_soon" : "dry";
  const startTime = firstWet?.time ?? null;
  const endTime = firstDryAfterWet?.time ?? null;
  const startsInMinutes = firstWet?.minutes ?? null;
  const endsInMinutes = firstDryAfterWet?.minutes ?? null;
  const dryWindowMinutes = rainingNow ? 0 : (firstWet?.minutes ?? 120);

  let title;
  let summary;
  if (status === "raining") {
    title = heavyShower ? "Zware bui nu" : `${intensity.label} nu`;
    summary = `Regen nu - waarschijnlijk ${endTime ? `droger rond ${shortTime(endTime, location.timezone)}` : "geen betrouwbaar droog venster"}.`;
  } else if (status === "rain_soon") {
    const range = minuteRange(startsInMinutes, confidence);
    title = heavyShower ? `Zware bui over ${range}` : `Regen over ${range}`;
    summary = `${intensity.label}. Verwacht ${shortTime(startTime, location.timezone)}${endTime ? `-${shortTime(endTime, location.timezone)}` : " en daarna onzeker"}.`;
  } else {
    title = "Droog";
    summary = `Minstens ${dryWindowMinutes} minuten geen regen verwacht.`;
  }
  if (thunderPossible) summary += " Onweer mogelijk.";

  return {
    schemaVersion: RAIN_ETA_SCHEMA_VERSION,
    location,
    status,
    title,
    summary,
    startsInMinutes,
    startTime,
    endTime,
    endsInMinutes,
    intensity: intensity.id,
    intensityLabel: intensity.label,
    dryWindowMinutes,
    confidence,
    heavyShower,
    thunderPossible,
    source: "Open-Meteo minutely_15 + Wheaterflow Intelligence",
    slots,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString()
  };
}

function forecastURL(latitude, longitude, model) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("minutely_15", "precipitation,weather_code");
  url.searchParams.set("hourly", "weather_code");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("timeformat", "unixtime");
  url.searchParams.set("forecast_days", "2");
  if (model && model !== "best_match") url.searchParams.set("models", model);
  return url;
}

async function requestForecast(latitude, longitude, model, signal) {
  const response = await fetch(forecastURL(latitude, longitude, model), {
    signal,
    headers: { accept: "application/json", "user-agent": "Wheaterflow-API/1.0" }
  });
  let body = null;
  try { body = await response.json(); } catch { /* handled below */ }
  if (!response.ok || body?.error || !body?.minutely_15) {
    throw new Error(body?.reason || body?.error || `Open-Meteo HTTP ${response.status}`);
  }
  return body;
}

export async function fetchRainETA({ latitude, longitude, name = "Mijn locatie", model = "knmi_seamless", signal } = {}) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new TypeError("latitude is ongeldig");
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new TypeError("longitude is ongeldig");
  let forecast;
  try {
    forecast = await requestForecast(lat, lon, model, signal);
  } catch (error) {
    if (!model || model === "best_match" || error?.name === "AbortError") throw error;
    forecast = await requestForecast(lat, lon, "best_match", signal);
  }
  return computeRainETA(forecast, { name, latitude: lat, longitude: lon });
}
