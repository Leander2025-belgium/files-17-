'use strict';

const { Pool } = require('pg');

const DB = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.POSTGRES_DB || 'wheaterflow',
  user: process.env.POSTGRES_USER || 'wheaterflow',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
  max: 3,
  idleTimeoutMillis: 30000
});

DB.on('error', error => {
  console.error('[WF Learning] PostgreSQL:', error.message);
});

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function locationKey(lat, lon) {
  return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

function horizonBucket(hours) {
  if (hours < 6) return 'h0_6';
  if (hours < 18) return 'h6_18';
  if (hours < 36) return 'h18_36';
  if (hours < 72) return 'h36_72';
  return 'h72_plus';
}

function seasonForDate(date) {
  const month = date.getUTCMonth() + 1;

  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'autumn';
}

function windSector(direction) {
  const d = number(direction);
  if (d === null) return 'unknown';

  const sectors = [
    'N', 'NE', 'E', 'SE',
    'S', 'SW', 'W', 'NW'
  ];

  return sectors[Math.round(((d % 360) / 45)) % 8];
}

function isCoastal(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);

  // Voorlopige generieke Belgische kustzone.
  // Later vervangen we dit door een echte coastline-distance helper.
  return (
    latitude >= 50.95 &&
    latitude <= 51.40 &&
    longitude >= 2.45 &&
    longitude <= 3.45
  );
}

function weatherRegime(hour) {
  const precipitation = number(hour.precipitation) || 0;
  const probability = number(hour.precipitationProbability) || 0;
  const cloud = number(hour.cloudCover) || 0;
  const gust = number(hour.windGust) || 0;
  const temperature = number(hour.temperature);
  const code = number(hour.weatherCode);

  if ([95, 96, 99].includes(code)) return 'stormy';
  if (gust >= 70) return 'windy';
  if ([45, 48].includes(code)) return 'foggy';

  if (
    [80, 81, 82].includes(code) ||
    (precipitation >= 0.2 && probability >= 40)
  ) {
    return 'convective_showers';
  }

  if (
    [51, 53, 55, 61, 63, 65].includes(code) ||
    precipitation >= 0.2
  ) {
    return 'frontal_rain';
  }

  if (temperature !== null && temperature >= 28) return 'hot';
  if (temperature !== null && temperature <= 2) return 'cold';
  if (cloud >= 75) return 'cloudy_stable';

  return 'stable_dry';
}

const VARIABLES = [
  ['temperature', 'temperature'],
  ['humidity', 'humidity'],
  ['precipitation', 'precipitation'],
  ['wind_speed', 'windSpeed'],
  ['wind_gust', 'windGust']
];

function issueBucket(date = new Date()) {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
}

async function recordForecast({
  latitude,
  longitude,
  model,
  hour,
  issuedAt = new Date()
}) {
  try {
    if (!hour || !hour.time) return 0;

    const validTime = new Date(`${hour.time}Z`);

    const storedIssuedAt = issueBucket(issuedAt);

    if (!Number.isFinite(validTime.getTime())) {
      return 0;
    }

    const leadHours = Math.max(
      0,
      Math.round(
        (validTime.getTime() - storedIssuedAt.getTime()) / 3600000
      )
    );

    const key = locationKey(latitude, longitude);
    const horizon = horizonBucket(leadHours);
    const season = seasonForDate(validTime);
    const coastal = isCoastal(latitude, longitude);
    const sector = windSector(hour.windDirection);
    const regime = weatherRegime(hour);

    let inserted = 0;

    for (const [dbVariable, objectKey] of VARIABLES) {
      const value = number(hour[objectKey]);
      if (value === null) continue;

      await DB.query(
        `
        INSERT INTO wf_predictions (
          location_key,
          latitude,
          longitude,
          issued_at,
          valid_time,
          lead_hours,
          horizon_bucket,
          model,
          variable,
          predicted_value,
          weather_regime,
          season,
          coastal,
          wind_sector
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )
        ON CONFLICT (
          location_key,
          issued_at,
          valid_time,
          model,
          variable
        )
        DO NOTHING
        `,
        [
          key,
          latitude,
          longitude,
          storedIssuedAt,
          validTime,
          leadHours,
          horizon,
          model,
          dbVariable,
          value,
          regime,
          season,
          coastal,
          sector
        ]
      );

      inserted += 1;
    }

    return inserted;
  } catch (error) {
    console.error(
      '[WF Learning] forecast recorder:',
      error.message
    );

    return 0;
  }
}

module.exports = {
  recordForecast,
  locationKey,
  horizonBucket,
  seasonForDate,
  windSector,
  weatherRegime
};
