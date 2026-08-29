const { Pool } = require('pg');
const webpush = require('web-push');

const DB = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: 5432,
  database: process.env.POSTGRES_DB || 'wheaterflow',
  user: process.env.POSTGRES_USER || 'wheaterflow',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD
});

const PUBLIC_APP_URL =
  process.env.PUBLIC_APP_URL || 'https://wheaterflow.be';

if (
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@wheaterflow.be',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const COOLDOWN_HOURS = 3;

function json(v, fallback = {}) {
  if (!v) return fallback;

  if (typeof v === 'object') {
    return v;
  }

  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

async function init() {
  await DB.query(`
    CREATE TABLE IF NOT EXISTS push_alert_log (
      id BIGSERIAL PRIMARY KEY,
      installation_id TEXT,
      endpoint TEXT,
      alert_type TEXT NOT NULL,
      signature TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await DB.query(`
    CREATE INDEX IF NOT EXISTS idx_push_alert_log_lookup
    ON push_alert_log(endpoint, alert_type, sent_at DESC)
  `);
}

async function maySend(sub, type, signature) {
  const r = await DB.query(
    `
      SELECT 1
      FROM push_alert_log
      WHERE
        (endpoint = $1 OR installation_id = $2)
        AND alert_type = $3
        AND signature = $4
        AND sent_at > now() - ($5 || ' hours')::interval
      LIMIT 1
    `,
    [
      sub.endpoint,
      sub.installation_id,
      type,
      signature,
      String(COOLDOWN_HOURS)
    ]
  );

  return r.rows.length === 0;
}

async function markSent(sub, type, signature) {
  await DB.query(
    `
      INSERT INTO push_alert_log
        (installation_id, endpoint, alert_type, signature)
      VALUES ($1, $2, $3, $4)
    `,
    [
      sub.installation_id,
      sub.endpoint,
      type,
      signature
    ]
  );
}

async function push(
  sub,
  type,
  signature,
  title,
  body
) {
  if (!(await maySend(sub, type, signature))) {
    return;
  }

  try {
    await webpush.sendNotification(
      sub.subscription,
      JSON.stringify({
        title,
        body,
        url: PUBLIC_APP_URL,
        type
      })
    );

    await markSent(
      sub,
      type,
      signature
    );

    console.log(
      `✅ ${type}: ${title}`
    );
  } catch (e) {
    console.error(
      `❌ Push ${type}:`,
      e.statusCode || e.message
    );

    if (
      e.statusCode === 404 ||
      e.statusCode === 410
    ) {
      await DB.query(
        'DELETE FROM push_subscriptions WHERE endpoint=$1',
        [sub.endpoint]
      );
    }
  }
}

async function weather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    forecast_hours: '8',
    current:
      'temperature_2m,weather_code,wind_gusts_10m',
    hourly:
      'temperature_2m,precipitation_probability,precipitation,rain,snowfall,weather_code,wind_gusts_10m,uv_index'
  });

  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`
  );

  if (!r.ok) {
    throw new Error(
      `Open-Meteo ${r.status}`
    );
  }

  return r.json();
}

function max(arr = []) {
  const values =
    arr.filter(Number.isFinite);

  return values.length
    ? Math.max(...values)
    : null;
}

function min(arr = []) {
  const values =
    arr.filter(Number.isFinite);

  return values.length
    ? Math.min(...values)
    : null;
}

async function checkBelgianWarnings(
  sub,
  prefs,
  location,
  maxGust,
  maxRain,
  maxPrecip
) {
  const country = String(
    location.country || ''
  ).toLowerCase();

  if (!country.includes('belg')) {
    return;
  }

  const rainAmount = Math.max(
    maxRain || 0,
    maxPrecip || 0
  );

  let level = null;
  let phenomenon = null;
  let detail = null;

  /*
   * WIND
   */

  if (maxGust !== null) {
    if (maxGust > 130) {
      level = 'red';
      phenomenon = 'wind';

      detail =
        `Extreme rukwinden tot ongeveer ` +
        `${Math.round(maxGust)} km/u verwacht.`;
    } else if (maxGust >= 101) {
      level = 'orange';
      phenomenon = 'wind';

      detail =
        `Zeer zware rukwinden tot ongeveer ` +
        `${Math.round(maxGust)} km/u verwacht.`;
    } else if (maxGust >= 80) {
      level = 'yellow';
      phenomenon = 'wind';

      detail =
        `Zware rukwinden tot ongeveer ` +
        `${Math.round(maxGust)} km/u verwacht.`;
    }
  }

  /*
   * REGEN
   */

  if (rainAmount > 50) {
    level = 'red';
    phenomenon = 'rain';

    detail =
      `Extreme neerslag tot ongeveer ` +
      `${rainAmount.toFixed(1)} mm/u mogelijk.`;
  } else if (
    rainAmount >= 31 &&
    level !== 'red'
  ) {
    level = 'orange';
    phenomenon = 'rain';

    detail =
      `Zeer intense neerslag tot ongeveer ` +
      `${rainAmount.toFixed(1)} mm/u mogelijk.`;
  } else if (
    rainAmount >= 20 &&
    !['red', 'orange'].includes(level)
  ) {
    level = 'yellow';
    phenomenon = 'rain';

    detail =
      `Intense neerslag tot ongeveer ` +
      `${rainAmount.toFixed(1)} mm/u mogelijk.`;
  }

  if (!level) {
    return;
  }

  if (
    level === 'yellow' &&
    !prefs.codeYellow
  ) {
    return;
  }

  if (
    level === 'orange' &&
    !prefs.codeOrange
  ) {
    return;
  }

  if (
    level === 'red' &&
    !prefs.codeRed
  ) {
    return;
  }

  const label = {
    yellow: '🟡 Code geel',
    orange: '🟠 Code oranje',
    red: '🔴 Code rood'
  }[level];

  const place =
    location.name || 'jouw locatie';

  await push(
    sub,
    `be-warning-${level}-${phenomenon}`,
    `${level}-${phenomenon}`,
    `${label} – Wheaterflow`,
    `${detail} Regio: ${place}.`
  );
}

async function checkSubscription(row) {
  const prefs =
    json(row.preferences);

  const thresholds =
    json(row.thresholds);

  const location =
    json(row.location);

  const lat =
    Number(location.lat);

  const lon =
    Number(location.lon);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return;
  }

  const w =
    await weather(lat, lon);

  const hourly =
    w.hourly || {};

  const locationName =
    location.name || 'jouw locatie';

  const temps =
    hourly.temperature_2m || [];

  const rainProb =
    hourly.precipitation_probability || [];

  const precipitation =
    hourly.precipitation || [];

  const rain =
    hourly.rain || [];

  const snowfall =
    hourly.snowfall || [];

  const codes =
    hourly.weather_code || [];

  const gusts =
    hourly.wind_gusts_10m || [];

  const uv =
    hourly.uv_index || [];

  const heatLimit =
    Number(
      thresholds.heat ?? 30
    );

  const frostLimit =
    Number(
      thresholds.frost ?? 0
    );

  const windLimit =
    Number(
      thresholds.windGust ?? 70
    );

  const rainProbabilityLimit =
    Number(
      thresholds.rainProbability ?? 70
    );

  const maxTemp =
    max(temps);

  const minTemp =
    min(temps);

  const maxGust =
    max(gusts);

  const maxRainProb =
    max(rainProb);

  const maxPrecip =
    max(precipitation);

  const maxRain =
    max(rain);

  const maxSnow =
    max(snowfall);

  const maxUV =
    max(uv);

  const thunder =
    codes.some(
      c =>
        [95, 96, 99].includes(
          Number(c)
        )
    );

  /*
   * ONWEER
   */

  if (
    prefs.thunder &&
    thunder
  ) {
    await push(
      row,
      'thunder',
      'thunder',
      '⛈️ Onweer verwacht',
      `Er wordt onweer verwacht rond ${locationName}.`
    );
  }

  /*
   * REGEN BINNENKORT
   */

  if (
    prefs.rainSoon &&
    maxRainProb !== null &&
    maxRainProb >=
      rainProbabilityLimit
  ) {
    await push(
      row,
      'rainSoon',
      `rain-${Math.round(maxRainProb / 10) * 10}`,
      '🌧️ Regen op komst',
      `Kans op regen rond ${locationName}: ` +
        `tot ${Math.round(maxRainProb)}%.`
    );
  }

  /*
   * ZWARE REGEN
   */

  if (
    prefs.heavyRain &&
    (
      (
        maxRain !== null &&
        maxRain >= 7.5
      ) ||
      (
        maxPrecip !== null &&
        maxPrecip >= 7.5
      )
    )
  ) {
    const amount =
      Math.max(
        maxRain || 0,
        maxPrecip || 0
      );

    await push(
      row,
      'heavyRain',
      `heavy-${Math.floor(amount)}`,
      '🌧️ Zware regen verwacht',
      `Plaatselijk ongeveer ` +
        `${amount.toFixed(1)} mm/u mogelijk ` +
        `rond ${locationName}.`
    );
  }

  /*
   * WIND
   */

  if (
    prefs.wind &&
    maxGust !== null &&
    maxGust >= windLimit
  ) {
    await push(
      row,
      'wind',
      `wind-${Math.round(maxGust / 10) * 10}`,
      '💨 Harde wind verwacht',
      `Windstoten tot ongeveer ` +
        `${Math.round(maxGust)} km/u ` +
        `rond ${locationName}.`
    );
  }

  /*
   * HITTE
   */

  if (
    prefs.heat &&
    maxTemp !== null &&
    maxTemp >= heatLimit
  ) {
    await push(
      row,
      'heat',
      `heat-${Math.floor(maxTemp)}`,
      '🥵 Hittewaarschuwing',
      `Temperatuur kan oplopen tot ongeveer ` +
        `${Math.round(maxTemp)} °C ` +
        `in ${locationName}.`
    );
  }

  /*
   * VORST
   */

  if (
    prefs.frost &&
    minTemp !== null &&
    minTemp <= frostLimit
  ) {
    await push(
      row,
      'frost',
      `frost-${Math.floor(minTemp)}`,
      '🥶 Vorst verwacht',
      `Temperatuur kan dalen tot ongeveer ` +
        `${Math.round(minTemp)} °C ` +
        `in ${locationName}.`
    );
  }

  /*
   * GLADHEID
   */

  const iceRisk =
    minTemp !== null &&
    minTemp <= 1 &&
    (
      (
        maxPrecip !== null &&
        maxPrecip > 0.1
      ) ||
      (
        maxSnow !== null &&
        maxSnow > 0
      )
    );

  if (
    prefs.ice &&
    iceRisk
  ) {
    await push(
      row,
      'ice',
      'ice-risk',
      '🧊 Kans op gladheid',
      `Door neerslag en lage temperaturen ` +
        `kan het glad worden rond ${locationName}.`
    );
  }

  /*
   * SNEEUW
   */

  if (
    prefs.snow &&
    maxSnow !== null &&
    maxSnow > 0
  ) {
    await push(
      row,
      'snow',
      `snow-${Math.ceil(maxSnow)}`,
      '❄️ Sneeuw verwacht',
      `Er wordt sneeuw verwacht rond ${locationName}.`
    );
  }

  /*
   * UV
   */

  if (
    prefs.uv &&
    maxUV !== null &&
    maxUV >= 6
  ) {
    await push(
      row,
      'uv',
      `uv-${Math.floor(maxUV)}`,
      '☀️ Hoge UV-index',
      `UV-index kan oplopen tot ` +
        `${maxUV.toFixed(1)} rond ${locationName}.`
    );
  }

  /*
   * KUST
   */

  if (
    prefs.coast &&
    maxGust !== null &&
    maxGust >= 80
  ) {
    await push(
      row,
      'coast',
      `coast-${Math.round(maxGust / 10) * 10}`,
      '🌊 Onstuimig aan de kust',
      `Sterke windstoten tot ongeveer ` +
        `${Math.round(maxGust)} km/u verwacht ` +
        `rond ${locationName}.`
    );
  }

  /*
   * BELGISCHE CODEWAARSCHUWING
   */

  await checkBelgianWarnings(
    row,
    prefs,
    location,
    maxGust,
    maxRain,
    maxPrecip
  );
}

async function run() {
  console.log(
    '🌦️ Wheaterflow alert check gestart'
  );

  try {
    const r =
      await DB.query(`
        SELECT
          endpoint,
          installation_id,
          subscription,
          location,
          preferences,
          thresholds
        FROM push_subscriptions
      `);

    console.log(
      `📱 ${r.rows.length} push-abonnement(en)`
    );

    for (const row of r.rows) {
      try {
        await checkSubscription(row);
      } catch (e) {
        console.error(
          `Fout bij ${
            row.installation_id ||
            row.endpoint
          }:`,
          e.message
        );
      }
    }
  } catch (e) {
    console.error(
      'Worker fout:',
      e
    );
  }
}

async function start() {
  await init();

  await run();

  setInterval(
    run,
    CHECK_INTERVAL_MS
  );
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
