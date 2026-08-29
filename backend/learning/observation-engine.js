'use strict';

const { Pool } = require('pg');

const DB = new Pool({
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

DB.on('error', error => {
  console.error(
    '[WF Observation] PostgreSQL:',
    error.message
  );
});


/* =========================================================
   BASIC HELPERS
   ========================================================= */

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


function kmhFromMs(value) {
  const n = number(value);

  return n === null
    ? null
    : n * 3.6;
}


function haversineKm(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371;

  const toRad = value =>
    Number(value) *
    Math.PI /
    180;

  const dLat =
    toRad(lat2 - lat1);

  const dLon =
    toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}


function geoServerTime(date) {
  return new Date(date)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
}

function hourWindow(date) {
  const center = new Date(date);

  if (!Number.isFinite(center.getTime())) {
    throw new Error('Ongeldige observatietijd');
  }

  center.setUTCMinutes(0, 0, 0);

  const start = new Date(
    center.getTime() - 30 * 60 * 1000
  );

  const end = new Date(
    center.getTime() + 30 * 60 * 1000
  );

  return {
    start: geoServerTime(start),
    end: geoServerTime(end)
  };
}

/* =========================================================
   KMI VARIABLE MAPPING

   LET OP:
   pressure wordt voorlopig NIET gebruikt.

   Wheaterflow gebruikt pressure_msl.
   We willen KMI pressure niet als dezelfde grootheid
   behandelen zonder verdere bevestiging/correctie.
   ========================================================= */

const KMI_VARIABLE_MAP = {

  temp_dry_shelter_avg: {
    variable: 'temperature',
    convert: number
  },

  humidity_rel_shelter_avg: {
    variable: 'humidity',
    convert: number
  },

  precip_quantity: {
    variable: 'precipitation',
    convert: number
  },

  wind_speed_10m: {
    variable: 'wind_speed',
    convert: kmhFromMs
  },

  wind_gusts_speed: {
    variable: 'wind_gust',
    convert: kmhFromMs
  }

};


/* =========================================================
   DATABASE STORAGE
   ========================================================= */

async function storeObservation({
  stationId,
  stationName,
  latitude,
  longitude,
  observationTime,
  variable,
  value,
  quality = null,
  source = 'KMI AWS 1H'
}) {

  const numeric =
    number(value);

  if (
    numeric === null ||
    !observationTime ||
    !variable
  ) {
    return false;
  }


  await DB.query(
    `
    INSERT INTO wf_observations (
      station_id,
      station_name,
      latitude,
      longitude,
      observation_time,
      variable,
      value,
      source,
      quality
    )

    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9
    )

    ON CONFLICT (
      station_id,
      observation_time,
      variable,
      source
    )

    DO UPDATE SET
      station_name =
        EXCLUDED.station_name,

      latitude =
        EXCLUDED.latitude,

      longitude =
        EXCLUDED.longitude,

      value =
        EXCLUDED.value,

      quality =
        EXCLUDED.quality
    `,
    [
      stationId || 'unknown',
      stationName || null,
      number(latitude),
      number(longitude),
      observationTime,
      variable,
      numeric,
      source,
      quality
    ]
  );


  return true;
}


/* =========================================================
   STORE ONE KMI GEOJSON FEATURE
   ========================================================= */

async function storeKmiRecord(
  feature
) {

  const record =
    feature?.properties ||
    feature ||
    {};


  const coordinates =
    Array.isArray(
      feature?.geometry?.coordinates
    )
      ? feature.geometry.coordinates
      : [];


  const longitude =
    number(
      coordinates[0]
    );

  const latitude =
    number(
      coordinates[1]
    );


  const stationId =
    String(
      record.code ??
      'unknown'
    );


  const stationName =
    `KMI ${stationId}`;


  const observationTime =
    record.timestamp;


  if (!observationTime) {
    return 0;
  }


  /*
   * KMI geeft qc_flags als JSON-string.
   */
  let qualityFlags = {};

  try {

    if (record.qc_flags) {

      qualityFlags =
        typeof record.qc_flags === 'string'
          ? JSON.parse(
              record.qc_flags
            )
          : record.qc_flags;

    }

  } catch {

    qualityFlags = {};

  }


  let stored = 0;


  for (
    const [
      sourceKey,
      config
    ]
    of Object.entries(
      KMI_VARIABLE_MAP
    )
  ) {

    if (
      !(sourceKey in record)
    ) {
      continue;
    }


    const converted =
      config.convert(
        record[sourceKey]
      );


    if (
      converted === null
    ) {
      continue;
    }


    const validated =
      qualityFlags
        ?.validated
        ?.[
          sourceKey.toUpperCase()
        ];


    const quality =
      validated === true
        ? 'validated'
        : validated === false
          ? 'unvalidated'
          : 'unknown';


    const ok =
      await storeObservation({

        stationId,

        stationName,

        latitude,

        longitude,

        observationTime,

        variable:
          config.variable,

        value:
          converted,

        quality,

        source:
          'KMI AWS 1H'

      });


    if (ok) {
      stored += 1;
    }

  }


  return stored;
}


const KMI_CACHE = new Map();
const KMI_CACHE_TTL_MS = 15 * 60 * 1000;

function kmiCacheKey({
  latitude,
  longitude,
  validTime,
  radiusKm
}) {
  const date = new Date(validTime);

  date.setUTCMinutes(0, 0, 0);

  return [
    Number(latitude).toFixed(3),
    Number(longitude).toFixed(3),
    date.toISOString(),
    Number(radiusKm || 75)
  ].join('|');
}

function cleanupKmiCache() {
  const now = Date.now();

  for (const [key, entry] of KMI_CACHE.entries()) {
    if (
      !entry ||
      now - entry.createdAt > KMI_CACHE_TTL_MS
    ) {
      KMI_CACHE.delete(key);
    }
  }
}

/* =========================================================
   KMI WFS FETCHER
   ========================================================= */

async function fetchKmiHourly({
  latitude,
  longitude,
  validTime,
  radiusKm = 75
}) {

  cleanupKmiCache();

  const cacheKey = kmiCacheKey({
    latitude,
    longitude,
    validTime,
    radiusKm
  });

  const cached = KMI_CACHE.get(cacheKey);

  if (
    cached &&
    Date.now() - cached.createdAt <= KMI_CACHE_TTL_MS
  ) {
    console.log(
      '[WF Observation] KMI cache hit:',
      cacheKey
    );

    return cached.data;
  }

  const lat =
    Number(latitude);

  const lon =
    Number(longitude);


  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    throw new Error(
      'Ongeldige locatie voor KMI-observaties'
    );
  }


  const {
    start,
    end
  } =
    hourWindow(
      validTime
    );


  /*
   * Snelle bounding-box rond locatie.
   *
   * 1 graad latitude ≈ 111 km.
   */
  const latDelta =
    radiusKm / 111;


  const lonScale =
    Math.max(
      0.2,
      Math.cos(
        lat *
        Math.PI /
        180
      )
    );


  const lonDelta =
    radiusKm /
    (
      111 *
      lonScale
    );


  const minLon =
    lon - lonDelta;

  const maxLon =
    lon + lonDelta;

  const minLat =
    lat - latDelta;

  const maxLat =
    lat + latDelta;


  /*
   * Deze vorm werkte rechtstreeks
   * tegen KMI GeoServer:
   *
   * timestamp DURING start/end
   */
  const filter =
    `timestamp DURING ${start}/${end}`;


const params =
  new URLSearchParams({

    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'aws:aws_1hour',
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',

    CQL_FILTER:
      filter,

    count:
      '500'

  });


  const url =
    'https://opendata.meteo.be/' +
    'geoserver/aws/ows?' +
    params.toString();


  console.log(
    '[WF Observation] KMI query:',
    `${start} → ${end}`,
    `@ ${lat.toFixed(3)},${lon.toFixed(3)}`
  );


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      10000
    );


  try {

    const response =
      await fetch(
        url,
        {
          signal:
            controller.signal,

          headers: {
            'User-Agent':
              'Wheaterflow-Learning/3.0',
            'Accept':
              'application/json'
          }
        }
      );


    if (
      !response.ok
    ) {

      const body =
        await response
          .text()
          .catch(
            () => ''
          );


      throw new Error(
        `KMI WFS HTTP ${response.status}` +
        (
          body
            ? `: ${body.slice(0, 300)}`
            : ''
        )
      );
    }


    const data =
      await response.json();


    const features =
      Array.isArray(
        data?.features
      )
        ? data.features
        : [];


    const candidates = [];


    for (
      const feature
      of features
    ) {

      const coordinates =
        feature
          ?.geometry
          ?.coordinates;


      if (
        !Array.isArray(
          coordinates
        ) ||
        coordinates.length < 2
      ) {
        continue;
      }


      const stationLon =
        number(
          coordinates[0]
        );


      const stationLat =
        number(
          coordinates[1]
        );


      if (
        stationLat === null ||
        stationLon === null
      ) {
        continue;
      }


      const distanceKm =
        haversineKm(
          lat,
          lon,
          stationLat,
          stationLon
        );


      if (
        distanceKm >
        radiusKm
      ) {
        continue;
      }


      const timestamp =
        feature
          ?.properties
          ?.timestamp;


      const observationMs =
        new Date(
          timestamp
        ).getTime();


      const targetMs =
        new Date(
          validTime
        ).getTime();


      const timeDifferenceMinutes =
        Number.isFinite(
          observationMs
        ) &&
        Number.isFinite(
          targetMs
        )
          ? Math.abs(
              observationMs -
              targetMs
            ) /
            60000
          : null;


      candidates.push({

        feature,

        stationId:
          String(
            feature
              ?.properties
              ?.code ??
            'unknown'
          ),

        latitude:
          stationLat,

        longitude:
          stationLon,

        distanceKm,

        timeDifferenceMinutes

      });

    }


    /*
     * Eerst afstand.
     *
     * Later maken we dit nog slimmer:
     * QC + tijd + afstand per variabele.
     */
    candidates.sort(
      (a, b) => {

        if (
          a.distanceKm !==
          b.distanceKm
        ) {
          return (
            a.distanceKm -
            b.distanceKm
          );
        }

        return (
          (
            a.timeDifferenceMinutes ??
            Infinity
          ) -
          (
            b.timeDifferenceMinutes ??
            Infinity
          )
        );

      }
    );


const result = {
  source: 'KMI AWS 1H',
  requestedTime: new Date(validTime).toISOString(),
  window: {
    start,
    end
  },
  radiusKm,
  count: candidates.length,
  candidates
};

KMI_CACHE.set(
  cacheKey,
  {
    createdAt: Date.now(),
    data: result
  }
);

return result;

  } catch (error) {

    if (
      error?.name ===
      'AbortError'
    ) {

      throw new Error(
        'KMI WFS timeout'
      );

    }

    throw error;


  } finally {

    clearTimeout(
      timeout
    );

  }
}


/* =========================================================
   IMPORT FETCHED KMI DATA
   ========================================================= */

async function importKmiHourly(
  options
) {

  const result =
    await fetchKmiHourly(
      options
    );


  let observationsStored =
    0;


  for (
    const candidate
    of result.candidates
  ) {

    observationsStored +=
      await storeKmiRecord(
        candidate.feature
      );

  }


  return {

    ...result,

    observationsStored

  };
}


/* =========================================================
   QUALITY HELPERS
   ========================================================= */

function getKmiValidation(
  feature,
  sourceKey
) {

  const raw =
    feature
      ?.properties
      ?.qc_flags;


  if (!raw) {
    return null;
  }


  let flags;

  try {

    flags =
      typeof raw === 'string'
        ? JSON.parse(raw)
        : raw;

  } catch {

    return null;

  }


  const result =
    flags
      ?.validated
      ?.[
        String(
          sourceKey
        ).toUpperCase()
      ];


  if (
    result === true
  ) {
    return true;
  }


  if (
    result === false
  ) {
    return false;
  }


  return null;
}


/*
 * Selecteer voorlopig het beste
 * station voor één variabele.
 *
 * Score:
 *
 * - afstand
 * - tijdverschil
 * - QC-validatie
 *
 * Lager = beter.
 */
function selectBestCandidate(
  candidates,
  sourceKey,
  {
    maxDistanceKm = 75,
    maxTimeDifferenceMinutes = 90
  } = {}
) {

  const usable = [];


  for (
    const candidate
    of candidates || []
  ) {

    const feature =
      candidate.feature;


    const value =
      number(
        feature
          ?.properties
          ?.[sourceKey]
      );


    if (
      value === null
    ) {
      continue;
    }


    if (
      candidate.distanceKm >
      maxDistanceKm
    ) {
      continue;
    }


    if (
      candidate.timeDifferenceMinutes !== null &&
      candidate.timeDifferenceMinutes >
      maxTimeDifferenceMinutes
    ) {
      continue;
    }


    const validated =
      getKmiValidation(
        feature,
        sourceKey
      );


    /*
     * Basisscore.
     *
     * Afstand weegt sterk.
     */
    let score =
      candidate.distanceKm;


    /*
     * Tijdverschil telt mee.
     */
    score +=
      (
        candidate.timeDifferenceMinutes ??
        90
      ) *
      0.15;


    /*
     * Gevalideerde data krijgt bonus.
     *
     * Unvalidated wordt nog niet geweigerd,
     * omdat recente KMI-data vaak nog niet
     * gevalideerd is.
     */
    if (
      validated === true
    ) {
      score -= 10;
    }

    if (
      validated === false
    ) {
      score += 5;
    }


    usable.push({

      ...candidate,

      value,

      validated,

      score

    });

  }


  usable.sort(
    (a, b) =>
      a.score -
      b.score
  );


  return (
    usable[0] ||
    null
  );
}


/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {

  storeObservation,

  storeKmiRecord,

  fetchKmiHourly,

  importKmiHourly,

  selectBestCandidate,

  getKmiValidation,

  haversineKm,

  hourWindow,

  geoServerTime,

  KMI_VARIABLE_MAP,

  kmiCacheKey,

  cleanupKmiCache,
};
