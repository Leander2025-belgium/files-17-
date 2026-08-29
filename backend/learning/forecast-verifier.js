'use strict';

const { Pool } = require('pg');
const {
  fetchKmiHourly,
  selectBestCandidate,
  KMI_VARIABLE_MAP
} = require('./observation-engine');

const DB = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.POSTGRES_DB || 'wheaterflow',
  user: process.env.POSTGRES_USER || 'wheaterflow',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
  max: 3,
  idleTimeoutMillis: 30000
});

const VARIABLE_TO_KMI = {
  temperature: 'temp_dry_shelter_avg',
  humidity: 'humidity_rel_shelter_avg',
  precipitation: 'precip_quantity',
  wind_speed: 'wind_speed_10m',
  wind_gust: 'wind_gusts_speed'
};

function convertObservation(sourceKey, value) {
  const config = KMI_VARIABLE_MAP[sourceKey];
  if (!config) return null;
  return config.convert(value);
}

async function verifyOne(prediction) {
  const sourceKey = VARIABLE_TO_KMI[prediction.variable];

  if (!sourceKey) {
    return { status: 'unsupported' };
  }

  const kmi = await fetchKmiHourly({
    latitude: prediction.latitude,
    longitude: prediction.longitude,
    validTime: prediction.valid_time,
    radiusKm: 75
  });

  const best = selectBestCandidate(
    kmi.candidates,
    sourceKey,
    {
      maxDistanceKm: 75,
      maxTimeDifferenceMinutes: 60
    }
  );

  if (!best) {
    return { status: 'no_observation' };
  }

  const actual = convertObservation(
    sourceKey,
    best.feature.properties[sourceKey]
  );

  if (!Number.isFinite(actual)) {
    return { status: 'invalid_observation' };
  }

  const predicted = Number(prediction.predicted_value);
  const signedError = predicted - actual;
  const absoluteError = Math.abs(signedError);
  const squaredError = signedError * signedError;

  await DB.query(
    `
    UPDATE wf_predictions
    SET
      actual_value=$2,
      signed_error=$3,
      absolute_error=$4,
      squared_error=$5,
      observation_source='KMI AWS 1H',
      observation_station=$6,
      observation_distance_km=$7,
      verified=true,
      verified_at=now()
    WHERE id=$1
    `,
    [
      prediction.id,
      actual,
      signedError,
      absoluteError,
      squaredError,
      best.stationId,
      best.distanceKm
    ]
  );

  return {
    status: 'verified',
    actual,
    absoluteError
  };
}

async function rebuildSkills() {
  await DB.query(`
    WITH ranked AS (
      SELECT
        location_key,
        model,
        variable,
        horizon_bucket,
        absolute_error,
        squared_error,
        signed_error,
        verified_at,

        ROW_NUMBER() OVER (
          PARTITION BY
            location_key,
            model,
            variable,
            horizon_bucket
          ORDER BY verified_at DESC
        ) AS recent_rank

      FROM wf_predictions

      WHERE
        verified = true
        AND absolute_error IS NOT NULL
        AND squared_error IS NOT NULL
        AND signed_error IS NOT NULL
    ),

    aggregated AS (
      SELECT
        location_key,
        model,
        variable,
        horizon_bucket,

        COUNT(*)::int AS sample_count,

        AVG(absolute_error) AS mae,

        SQRT(
          AVG(squared_error)
        ) AS rmse,

        AVG(signed_error) AS bias,

        AVG(absolute_error)
          FILTER (
            WHERE recent_rank <= 20
          ) AS recent_mae

      FROM ranked

      GROUP BY
        location_key,
        model,
        variable,
        horizon_bucket
    ),

    scored AS (
      SELECT
        *,

        /*
         * Lagere fout = hogere score.
         *
         * 50% totale MAE
         * 35% recente MAE
         * 15% absolute bias
         */
        1.0 / (
          1.0
          + (
            0.50 * COALESCE(mae, 0)
          )
          + (
            0.35 *
            COALESCE(recent_mae, mae, 0)
          )
          + (
            0.15 *
            ABS(COALESCE(bias, 0))
          )
        ) AS raw_skill_score

      FROM aggregated
    ),

    normalized AS (
      SELECT
        *,

        COUNT(*) OVER (
          PARTITION BY
            location_key,
            variable,
            horizon_bucket
        ) AS model_count,

        raw_skill_score
        /
        NULLIF(
          SUM(raw_skill_score) OVER (
            PARTITION BY
              location_key,
              variable,
              horizon_bucket
          ),
          0
        ) AS normalized_weight

      FROM scored
    ),

    learned AS (
      SELECT
        *,

        /*
         * Confidence groeit geleidelijk.
         *
         * 0 samples  -> nauwelijks leren
         * 10 samples -> half vertrouwen
         * 20 samples -> volledig vertrouwen
         */
        LEAST(
          1.0,
          sample_count / 20.0
        ) AS confidence

      FROM normalized
    ),

    final_weights AS (
      SELECT
        *,

        CASE

          /*
           * Bij exact twee modellen:
           * trek het gewicht bij weinig samples
           * richting 50/50 en begrens op 70/30.
           */
          WHEN model_count = 2 THEN

            GREATEST(
              0.30,

              LEAST(
                0.70,

                0.50
                +
                confidence
                *
                (
                  normalized_weight
                  - 0.50
                )
              )
            )

          /*
           * Generiek fallbackgedrag als later
           * meer dan twee modellen deelnemen.
           */
          ELSE

            (
              1.0 / model_count
            )
            +
            confidence
            *
            (
              normalized_weight
              -
              (
                1.0 / model_count
              )
            )

        END AS learned_weight

      FROM learned
    )

    INSERT INTO wf_model_skill (
      location_key,
      model,
      variable,
      horizon_bucket,
      sample_count,
      mae,
      rmse,
      bias,
      recent_mae,
      skill_score,
      learned_weight,
      updated_at
    )

    SELECT
      location_key,
      model,
      variable,
      horizon_bucket,
      sample_count,
      mae,
      rmse,
      bias,
      recent_mae,
      raw_skill_score,
      learned_weight,
      now()

    FROM final_weights

    ON CONFLICT (
      location_key,
      model,
      variable,
      horizon_bucket
    )

    DO UPDATE SET
      sample_count =
        EXCLUDED.sample_count,

      mae =
        EXCLUDED.mae,

      rmse =
        EXCLUDED.rmse,

      bias =
        EXCLUDED.bias,

      recent_mae =
        EXCLUDED.recent_mae,

      skill_score =
        EXCLUDED.skill_score,

      learned_weight =
        EXCLUDED.learned_weight,

      updated_at =
        now()
  `);
}

async function runVerification(limit = 100) {
  const run = await DB.query(`
    INSERT INTO wf_learning_runs(status)
    VALUES('running')
    RETURNING id, started_at
  `);

  const runId = run.rows[0].id;
  const started = Date.now();

  const diagnostics = {
    selected: 0,
    verified: 0,
    unsupported: 0,
    noObservation: 0,
    invalidObservation: 0,
    unknown: 0,
    errors: 0
  };

  try {
    const result = await DB.query(
      `
      SELECT *
      FROM wf_predictions
      WHERE
        verified=false
        AND valid_time <= now()
        AND variable IN (
          'temperature',
          'humidity',
          'precipitation',
          'wind_speed',
          'wind_gust'
        )
      ORDER BY valid_time ASC
      LIMIT $1
      `,
      [limit]
    );

    diagnostics.selected = result.rows.length;

    for (const prediction of result.rows) {
      try {
        const outcome = await verifyOne(prediction);

        switch (outcome?.status) {
          case 'verified':
            diagnostics.verified++;
            break;

          case 'unsupported':
            diagnostics.unsupported++;
            break;

          case 'no_observation':
            diagnostics.noObservation++;
            break;

          case 'invalid_observation':
            diagnostics.invalidObservation++;
            break;

          default:
            diagnostics.unknown++;

            console.warn(
              '[WF Verification] onbekende status:',
              prediction.id,
              outcome?.status
            );
            break;
        }

      } catch (error) {
        diagnostics.errors++;

        console.error(
          '[WF Verification] fout:',
          `id=${prediction.id}`,
          `location=${prediction.location_key}`,
          `model=${prediction.model}`,
          `variable=${prediction.variable}`,
          `valid=${prediction.valid_time}`,
          error.message
        );
      }
    }

    await rebuildSkills();

    const durationMs =
      Date.now() - started;

    await DB.query(
      `
      UPDATE wf_learning_runs
      SET
        finished_at=now(),
        status='completed',
        predictions_verified=$2,
        skills_updated=1,
        duration_ms=$3
      WHERE id=$1
      `,
      [
        runId,
        diagnostics.verified,
        durationMs
      ]
    );

    const skipped =
      diagnostics.unsupported +
      diagnostics.noObservation +
      diagnostics.invalidObservation +
      diagnostics.unknown +
      diagnostics.errors;

    const summary = {
      ok: true,
      selected: diagnostics.selected,
      verified: diagnostics.verified,
      skipped,
      unsupported: diagnostics.unsupported,
      noObservation: diagnostics.noObservation,
      invalidObservation: diagnostics.invalidObservation,
      unknown: diagnostics.unknown,
      errors: diagnostics.errors,
      durationMs
    };

    console.log(
      '[WF Verification] diagnostics:',
      JSON.stringify(summary)
    );

    return summary;

  } catch (error) {
    const durationMs =
      Date.now() - started;

    await DB.query(
      `
      UPDATE wf_learning_runs
      SET
        finished_at=now(),
        status='failed',
        duration_ms=$2,
        error=$3
      WHERE id=$1
      `,
      [
        runId,
        durationMs,
        String(
          error.message || error
        ).slice(0, 500)
      ]
    );

    console.error(
      '[WF Verification] run mislukt:',
      error.message
    );

    throw error;
  }
}


module.exports = {
  runVerification,
  verifyOne,
  rebuildSkills
};
