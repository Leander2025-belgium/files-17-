const { recordForecast } = require('./learning/forecast-recorder');
const { Pool } = require('pg');

const LEARNING_DB = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.POSTGRES_DB || 'wheaterflow',
  user: process.env.POSTGRES_USER || 'wheaterflow',
  password:
    process.env.POSTGRES_PASSWORD ||
    process.env.DB_PASSWORD,
  max: 3,
  idleTimeoutMillis: 30000
});

const learningWeightCache = new Map();

const LEARNING_WEIGHT_CACHE_MS =
  10 * 60 * 1000;

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'precipitation_probability',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'weather_code'
].join(',');

async function fetchModel(lat, lon, model) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: HOURLY_VARS,
    forecast_days: '3',

    // Altijd UTC gebruiken zodat uren ondubbelzinnig zijn.
    timezone: 'UTC',

    models: model,
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm'
  });

  const url = `${OPEN_METEO_URL}?${params.toString()}`;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Wheaterflow/2.0'
      }
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');

      throw new Error(
        `${model} antwoordde met HTTP ${response.status}` +
        (body ? `: ${body.slice(0, 200)}` : '')
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}


/*
 * Zet waarden veilig om naar numbers.
 *
 * BELANGRIJK:
 * Number(null) zou normaal 0 worden.
 * Dat willen we NIET bij ontbrekende weerdata.
 */
function number(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function learningLocationKey(
  latitude,
  longitude
) {
  return `${Number(latitude).toFixed(2)},${Number(longitude).toFixed(2)}`;
}


function clampWeight(value) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(
    0.70,
    Math.max(
      0.30,
      numeric
    )
  );
}


async function getLearnedWeights({
  latitude,
  longitude,
  horizonBucket = 'h0_6'
}) {
  const locationKey =
    learningLocationKey(
      latitude,
      longitude
    );

  const cacheKey =
    `${locationKey}:${horizonBucket}`;

  const cached =
    learningWeightCache.get(
      cacheKey
    );

  if (
    cached &&
    Date.now() - cached.at <
      LEARNING_WEIGHT_CACHE_MS
  ) {
    return cached.weights;
  }

  try {
    const result =
      await LEARNING_DB.query(
        `
        SELECT
          model,
          variable,
          sample_count,
          learned_weight,
          mae,
          recent_mae,
          bias
        FROM wf_model_skill
        WHERE
          location_key=$1
          AND horizon_bucket=$2
          AND variable IN (
            'temperature',
            'humidity',
            'precipitation',
            'wind_speed',
            'wind_gust'
          )
        `,
        [
          locationKey,
          horizonBucket
        ]
      );

    const grouped = {};

    for (const row of result.rows) {
      if (!grouped[row.variable]) {
        grouped[row.variable] = {};
      }

      grouped[row.variable][row.model] = {
        samples:
          Number(row.sample_count || 0),

        weight:
          clampWeight(
            row.learned_weight
          ),

        mae:
          Number(row.mae),

        recentMae:
          Number(row.recent_mae),

        bias:
          Number(row.bias)
      };
    }

    const weights = {};

    for (
      const [
        variable,
        models
      ] of Object.entries(grouped)
    ) {
      const harmonie =
        models.harmonie;

      const ecmwf =
        models.ecmwf;

      if (
        !harmonie ||
        !ecmwf
      ) {
        continue;
      }

      /*
       * Nog te weinig bewijs:
       * vaste Wheaterflow-gewichten blijven actief.
       */
      const minimumSamples =
        Math.min(
          harmonie.samples,
          ecmwf.samples
        );

      if (minimumSamples < 5) {
        continue;
      }

      if (
        harmonie.weight === null ||
        ecmwf.weight === null
      ) {
        continue;
      }

      /*
       * Normaliseer nog één keer zodat
       * H + E exact 1 wordt.
       */
      const total =
        harmonie.weight +
        ecmwf.weight;

      if (
        !Number.isFinite(total) ||
        total <= 0
      ) {
        continue;
      }

      weights[variable] = {
        harmonie:
          harmonie.weight / total,

        ecmwf:
          ecmwf.weight / total,

        samples:
          minimumSamples,

        mature:
          minimumSamples >= 20
      };
    }

    learningWeightCache.set(
      cacheKey,
      {
        at: Date.now(),
        weights
      }
    );

    return weights;

  } catch (error) {
    console.error(
      '[WF Intelligence] learned weights:',
      error.message
    );

    /*
     * Belangrijk:
     * databasefout mag nooit weather-engine breken.
     */
    return {};
  }
}

function weighted(values) {
  let sum = 0;
  let weightSum = 0;

  for (const item of values) {
    if (
      item.value === null ||
      item.value === undefined ||
      !Number.isFinite(Number(item.value))
    ) {
      continue;
    }

    const value = Number(item.value);
    const weight = Number(item.weight);

    if (!Number.isFinite(weight) || weight <= 0) {
      continue;
    }

    sum += value * weight;
    weightSum += weight;
  }

  if (!weightSum) {
    return null;
  }

  return sum / weightSum;
}


function round(value, decimals = 1) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  const factor = 10 ** decimals;

  return (
    Math.round(Number(value) * factor) /
    factor
  );
}


/*
 * Windrichting is circulair.
 *
 * Voorbeeld:
 *
 * HARMONIE = 350°
 * ECMWF    = 10°
 *
 * Gewoon gemiddelde zou 180° geven,
 * terwijl beide modellen eigenlijk NOORD zeggen.
 *
 * Daarom gebruiken we sin/cos.
 */
function weightedDirection(values) {
  let x = 0;
  let y = 0;
  let weightSum = 0;

  for (const item of values) {
    if (
      item.value === null ||
      item.value === undefined
    ) {
      continue;
    }

    const direction = Number(item.value);
    const weight = Number(item.weight);

    if (
      !Number.isFinite(direction) ||
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      continue;
    }

    const radians =
      direction * Math.PI / 180;

    x += Math.cos(radians) * weight;
    y += Math.sin(radians) * weight;

    weightSum += weight;
  }

  if (!weightSum) {
    return null;
  }

  let degrees =
    Math.atan2(y, x) * 180 / Math.PI;

  if (degrees < 0) {
    degrees += 360;
  }

  return degrees;
}


/*
 * Wheaterflow condition-engine.
 *
 * Neerslag / onweer / mist hebben prioriteit
 * boven gewone bewolking.
 */
function determineCondition({
  weatherCode,
  precipitation,
  cloudCover
}) {
  const code =
    weatherCode === null ||
    weatherCode === undefined
      ? null
      : Number(weatherCode);

  const rain =
    Number.isFinite(Number(precipitation))
      ? Number(precipitation)
      : 0;

  const cloud =
    Number.isFinite(Number(cloudCover))
      ? Number(cloudCover)
      : 0;


  // Onweer
  if ([95, 96, 99].includes(code)) {
    return 'thunderstorm';
  }


  // Sneeuw / sneeuwbuien
  if (
    [71, 73, 75, 77, 85, 86].includes(code)
  ) {
    return 'snow';
  }


  // IJzel / freezing rain
  if (
    [56, 57, 66, 67].includes(code)
  ) {
    return 'freezing_rain';
  }


  // Mist
  if ([45, 48].includes(code)) {
    return 'fog';
  }


  // Regen / motregen / buien
  if (
    [
      51,
      53,
      55,
      61,
      63,
      65,
      80,
      81,
      82
    ].includes(code) ||
    rain >= 0.1
  ) {
    if (rain >= 4) {
      return 'heavy_rain';
    }

    if (rain >= 1) {
      return 'rain';
    }

    return 'light_rain';
  }


  // Geen neerslag → bewolking bepaalt conditie

  if (cloud <= 10) {
    return 'clear';
  }

  if (cloud <= 30) {
    return 'mostly_clear';
  }

  if (cloud <= 55) {
    return 'partly_cloudy';
  }

  if (cloud <= 85) {
    return 'cloudy';
  }

  return 'overcast';
}


/*
 * Zoek het forecastuur dat het dichtst
 * bij de huidige UTC-tijd ligt.
 */
function getCurrentIndex(data) {
  const times = data?.hourly?.time;

  if (
    !Array.isArray(times) ||
    !times.length
  ) {
    return 0;
  }

  const now = Date.now();

  let closestIndex = 0;
  let closestDifference = Infinity;

  times.forEach((time, index) => {

    /*
     * Open-Meteo geeft wanneer timezone=UTC bijvoorbeeld:
     *
     * 2026-08-10T18:00
     *
     * Door Z toe te voegen weten we zeker
     * dat JavaScript dit als UTC behandelt.
     */
    const parsed =
      new Date(`${time}Z`).getTime();

    if (!Number.isFinite(parsed)) {
      return;
    }

    const difference =
      Math.abs(parsed - now);

    if (
      difference < closestDifference
    ) {
      closestDifference = difference;
      closestIndex = index;
    }
  });

  return closestIndex;
}


/*
 * Lees één forecastuur uit het
 * Open-Meteo antwoord.
 */
function readHour(data, index) {
  const h = data?.hourly || {};

  return {
    time:
      h.time?.[index] ?? null,

    temperature:
      number(
        h.temperature_2m?.[index]
      ),

    apparentTemperature:
      number(
        h.apparent_temperature?.[index]
      ),

    humidity:
      number(
        h.relative_humidity_2m?.[index]
      ),

    precipitation:
      number(
        h.precipitation?.[index]
      ),

    precipitationProbability:
      number(
        h.precipitation_probability?.[index]
      ),

    cloudCover:
      number(
        h.cloud_cover?.[index]
      ),

    pressure:
      number(
        h.pressure_msl?.[index]
      ),

    windSpeed:
      number(
        h.wind_speed_10m?.[index]
      ),

    windDirection:
      number(
        h.wind_direction_10m?.[index]
      ),

    windGust:
      number(
        h.wind_gusts_10m?.[index]
      ),

    weatherCode:
      number(
        h.weather_code?.[index]
      )
  };
}


/*
 * Blend voor het actuele/korte-termijnweer.
 *
 * Voorlopige gewichten.
 * Later gaan we deze automatisch leren
 * op basis van echte forecastfouten.
 */
function blendCurrent(
  harmonie,
  ecmwf,
  learnedWeights = {}
) {

const base = {
  temperature: {
    harmonie: 0.70,
    ecmwf: 0.30
  },

  humidity: {
    harmonie: 0.70,
    ecmwf: 0.30
  },

  precipitation: {
    harmonie: 0.80,
    ecmwf: 0.20
  },

  wind_speed: {
    harmonie: 0.70,
    ecmwf: 0.30
  },

  wind_gust: {
    harmonie: 0.75,
    ecmwf: 0.25
  }
};


function weightFor(
  variable,
  model
) {
  return (
    learnedWeights
      ?.[variable]
      ?.[model]
    ??
    base
      ?.[variable]
      ?.[model]
    ??
    0.50
  );
}


const H = weightFor(
  'temperature',
  'harmonie'
);

const E = weightFor(
  'temperature',
  'ecmwf'
);

const temperature =
  weighted([
    {
      value:
        harmonie.temperature,
      weight:
        weightFor(
          'temperature',
          'harmonie'
        )
    },
    {
      value:
        ecmwf.temperature,
      weight:
        weightFor(
          'temperature',
          'ecmwf'
        )
    }
  ]);

  const apparentTemperature =
    weighted([
      {
        value:
          harmonie.apparentTemperature,
        weight: H
      },
      {
        value:
          ecmwf.apparentTemperature,
        weight: E
      }
    ]);


const humidity =
  weighted([
    {
      value:
        harmonie.humidity,
      weight:
        weightFor(
          'humidity',
          'harmonie'
        )
    },
    {
      value:
        ecmwf.humidity,
      weight:
        weightFor(
          'humidity',
          'ecmwf'
        )
    }
  ]);

  /*
   * HARMONIE krijgt meer gewicht
   * voor lokale bewolking.
   */
  const cloudCover =
    weighted([
      {
        value:
          harmonie.cloudCover,
        weight: 0.80
      },
      {
        value:
          ecmwf.cloudCover,
        weight: 0.20
      }
    ]);


  /*
   * Neerslag korte termijn:
   * regionaal model zwaarder.
   */
const precipitation =
  weighted([
    {
      value:
        harmonie.precipitation,
      weight:
        weightFor(
          'precipitation',
          'harmonie'
        )
    },
    {
      value:
        ecmwf.precipitation,
      weight:
        weightFor(
          'precipitation',
          'ecmwf'
        )
    }
  ]);

  const precipitationProbability =
    weighted([
      {
        value:
          harmonie.precipitationProbability,
        weight: 0.75
      },
      {
        value:
          ecmwf.precipitationProbability,
        weight: 0.25
      }
    ]);


const windSpeed =
  weighted([
    {
      value:
        harmonie.windSpeed,
      weight:
        weightFor(
          'wind_speed',
          'harmonie'
        )
    },
    {
      value:
        ecmwf.windSpeed,
      weight:
        weightFor(
          'wind_speed',
          'ecmwf'
        )
    }
  ]);

const windGust =
  weighted([
    {
      value:
        harmonie.windGust,
      weight:
        weightFor(
          'wind_gust',
          'harmonie'
        )
    },
    {
      value:
        ecmwf.windGust,
      weight:
        weightFor(
          'wind_gust',
          'ecmwf'
        )
    }
  ]);

  /*
   * Voor druk gebruiken we ECMWF iets zwaarder.
   *
   * Als HARMONIE geen pressure heeft
   * (null), wordt die automatisch
   * overgeslagen door weighted().
   */
  const pressure =
    weighted([
      {
        value:
          harmonie.pressure,
        weight: 0.45
      },
      {
        value:
          ecmwf.pressure,
        weight: 0.55
      }
    ]);


  /*
   * Circulair gemiddelde voor windrichting.
   */
  const windDirection =
    weightedDirection([
      {
        value:
          harmonie.windDirection,
        weight: H
      },
      {
        value:
          ecmwf.windDirection,
        weight: E
      }
    ]);


  /*
   * Voor korte termijn krijgt HARMONIE
   * voorlopig voorkeur voor WMO weather code.
   */
  const weatherCode =
    harmonie.weatherCode ??
    ecmwf.weatherCode ??
    null;


  const condition =
    determineCondition({
      weatherCode,
      precipitation,
      cloudCover
    });


  return {
    temperature:
      round(
        temperature,
        1
      ),

    apparentTemperature:
      round(
        apparentTemperature,
        1
      ),

    humidity:
      round(
        humidity,
        0
      ),

    precipitation:
      round(
        precipitation,
        2
      ),

    precipitationProbability:
      round(
        precipitationProbability,
        0
      ),

    cloudCover:
      round(
        cloudCover,
        0
      ),

    pressure:
      round(
        pressure,
        1
      ),

    windSpeed:
      round(
        windSpeed,
        1
      ),

    windDirection:
      round(
        windDirection,
        0
      ),

    windGust:
      round(
        windGust,
        1
      ),

    weatherCode,

    condition
  };
}


/*
 * Eerste confidence-engine.
 *
 * Hoe meer HARMONIE en ECMWF van elkaar
 * verschillen, hoe lager de betrouwbaarheid.
 */
function calculateConfidence(
  harmonie,
  ecmwf
) {
  let score = 100;


  // Temperatuurverschil
  if (
    harmonie.temperature !== null &&
    ecmwf.temperature !== null
  ) {
    const difference =
      Math.abs(
        harmonie.temperature -
        ecmwf.temperature
      );

    score -= Math.min(
      difference * 7,
      25
    );
  }


  // Verschil in bewolking
  if (
    harmonie.cloudCover !== null &&
    ecmwf.cloudCover !== null
  ) {
    const difference =
      Math.abs(
        harmonie.cloudCover -
        ecmwf.cloudCover
      );

    score -= Math.min(
      difference * 0.15,
      15
    );
  }


  // Verschil in windsnelheid
  if (
    harmonie.windSpeed !== null &&
    ecmwf.windSpeed !== null
  ) {
    const difference =
      Math.abs(
        harmonie.windSpeed -
        ecmwf.windSpeed
      );

    score -= Math.min(
      difference * 0.5,
      10
    );
  }


  // Verschil in neerslag
  if (
    harmonie.precipitation !== null &&
    ecmwf.precipitation !== null
  ) {
    const difference =
      Math.abs(
        harmonie.precipitation -
        ecmwf.precipitation
      );

    score -= Math.min(
      difference * 4,
      10
    );
  }


  return Math.max(
    30,
    Math.min(
      100,
      Math.round(score)
    )
  );
}


/*
 * Hoofdfunctie van Wheaterflow Weather Engine v1.
 */
async function getWeather(
  lat,
  lon
) {

  const latitude =
    Number(lat);

  const longitude =
    Number(lon);


  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      'Ongeldige latitude of longitude'
    );
  }


  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      'Latitude of longitude buiten geldig bereik'
    );
  }


  /*
   * Beide modellen tegelijkertijd ophalen.
   *
   * Promise.allSettled zorgt ervoor dat
   * Wheaterflow kan blijven werken wanneer
   * één provider tijdelijk uitvalt.
   */
  const [
    harmonieResult,
    ecmwfResult
  ] =
    await Promise.allSettled([

      fetchModel(
        latitude,
        longitude,
        'knmi_harmonie_arome_netherlands'
      ),

      fetchModel(
        latitude,
        longitude,
        'ecmwf_ifs025'
      )

    ]);


  /*
   * Beide modellen down = fout.
   */
  if (
    harmonieResult.status === 'rejected' &&
    ecmwfResult.status === 'rejected'
  ) {
    throw new Error(
      'Geen weermodellen beschikbaar. ' +
      `HARMONIE: ${
        harmonieResult.reason?.message ||
        'unknown'
      }; ECMWF: ${
        ecmwfResult.reason?.message ||
        'unknown'
      }`
    );
  }


  const harmonie =
    harmonieResult.status === 'fulfilled'
      ? harmonieResult.value
      : null;


  const ecmwf =
    ecmwfResult.status === 'fulfilled'
      ? ecmwfResult.value
      : null;


  /*
   * Kies één beschikbare dataset als basis
   * om het huidige uur te vinden.
   */
  const base =
    harmonie ||
    ecmwf;


  const index =
    getCurrentIndex(base);


  const harmonieHour =
    harmonie
      ? readHour(
          harmonie,
          getCurrentIndex(harmonie)
        )
      : {};


  const ecmwfHour =
    ecmwf
      ? readHour(
          ecmwf,
          getCurrentIndex(ecmwf)
        )
      : {};
const learningOffsets = [0, 3, 6, 12, 24, 36, 48, 72];

const learningJobs = [];

if (harmonie) {
  const baseIndex = getCurrentIndex(harmonie);

  for (const offset of learningOffsets) {
    const index = baseIndex + offset;

    if (harmonie?.hourly?.time?.[index]) {
      learningJobs.push(
        recordForecast({
          latitude,
          longitude,
          model: 'harmonie',
          hour: readHour(harmonie, index)
        })
      );
    }
  }
}

if (ecmwf) {
  const baseIndex = getCurrentIndex(ecmwf);

  for (const offset of learningOffsets) {
    const index = baseIndex + offset;

    if (ecmwf?.hourly?.time?.[index]) {
      learningJobs.push(
        recordForecast({
          latitude,
          longitude,
          model: 'ecmwf',
          hour: readHour(ecmwf, index)
        })
      );
    }
  }
}

Promise.allSettled(learningJobs).catch(() => {});
  /*
   * Blend kan ook met één model werken,
   * want ontbrekende waarden worden
   * automatisch genegeerd.
   */

const learnedWeights =
  await getLearnedWeights({
    latitude,
    longitude,
    horizonBucket: 'h0_6'
  });

const current =
  blendCurrent(
    harmonieHour,
    ecmwfHour,
    learnedWeights
  );

  /*
   * Beide modellen beschikbaar:
   * echte confidence-score.
   *
   * Eén model beschikbaar:
   * lagere fallback-confidence.
   */
  const confidence =
    harmonie && ecmwf
      ? calculateConfidence(
          harmonieHour,
          ecmwfHour
        )
      : 55;


  return {

    status: 'ok',

    engine:
      'wheaterflow-v1',

    location: {
      latitude,
      longitude,

      /*
       * De modeldata zelf is UTC.
       *
       * We bewaren daarnaast de echte
       * locatie-timezone uit Open-Meteo
       * indien beschikbaar.
       */
      timezone:
        harmonie?.timezone ||
        ecmwf?.timezone ||
        'UTC'
    },


    current,


    confidence,


    models: {

      harmonie: {
        available:
          Boolean(harmonie),

        model:
          'KNMI HARMONIE-AROME Netherlands',

        error:
          harmonieResult.status === 'rejected'
            ? harmonieResult.reason?.message
            : null,

        values:
          harmonie
            ? harmonieHour
            : null
      },


      ecmwf: {
        available:
          Boolean(ecmwf),

        model:
          'ECMWF IFS',

        error:
          ecmwfResult.status === 'rejected'
            ? ecmwfResult.reason?.message
            : null,

        values:
          ecmwf
            ? ecmwfHour
            : null
      }

    },


    generatedAt:
      new Date().toISOString()

  };
}


module.exports = {
  getWeather
};
