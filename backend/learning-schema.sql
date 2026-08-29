CREATE TABLE IF NOT EXISTS wf_predictions (
    id BIGSERIAL PRIMARY KEY,

    location_key TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_time TIMESTAMPTZ NOT NULL,

    lead_hours INTEGER NOT NULL,
    horizon_bucket TEXT NOT NULL,

    model TEXT NOT NULL,
    variable TEXT NOT NULL,

    predicted_value DOUBLE PRECISION NOT NULL,

    actual_value DOUBLE PRECISION,

    signed_error DOUBLE PRECISION,
    absolute_error DOUBLE PRECISION,
    squared_error DOUBLE PRECISION,

    weather_regime TEXT,
    season TEXT,
    coastal BOOLEAN DEFAULT FALSE,
    wind_sector TEXT,

    observation_source TEXT,
    observation_station TEXT,
    observation_distance_km DOUBLE PRECISION,

    verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (
        location_key,
        issued_at,
        valid_time,
        model,
        variable
    )
);

CREATE INDEX IF NOT EXISTS idx_wf_predictions_verify
ON wf_predictions (
    verified,
    valid_time
);

CREATE INDEX IF NOT EXISTS idx_wf_predictions_skill
ON wf_predictions (
    location_key,
    model,
    variable,
    horizon_bucket,
    verified
);


CREATE TABLE IF NOT EXISTS wf_observations (
    id BIGSERIAL PRIMARY KEY,

    station_id TEXT,
    station_name TEXT,

    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    observation_time TIMESTAMPTZ NOT NULL,

    variable TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,

    source TEXT NOT NULL,

    quality TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (
        station_id,
        observation_time,
        variable,
        source
    )
);

CREATE INDEX IF NOT EXISTS idx_wf_observations_lookup
ON wf_observations (
    observation_time,
    variable
);


CREATE TABLE IF NOT EXISTS wf_model_skill (
    location_key TEXT NOT NULL,
    model TEXT NOT NULL,
    variable TEXT NOT NULL,
    horizon_bucket TEXT NOT NULL,

    sample_count INTEGER NOT NULL DEFAULT 0,

    mae DOUBLE PRECISION,
    rmse DOUBLE PRECISION,
    bias DOUBLE PRECISION,

    recent_mae DOUBLE PRECISION,

    skill_score DOUBLE PRECISION,

    learned_weight DOUBLE PRECISION,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (
        location_key,
        model,
        variable,
        horizon_bucket
    )
);


CREATE TABLE IF NOT EXISTS wf_context_skill (
    location_key TEXT NOT NULL,

    model TEXT NOT NULL,
    variable TEXT NOT NULL,
    horizon_bucket TEXT NOT NULL,

    season TEXT NOT NULL,
    weather_regime TEXT NOT NULL,
    coastal BOOLEAN NOT NULL DEFAULT FALSE,
    wind_sector TEXT NOT NULL,

    sample_count INTEGER NOT NULL DEFAULT 0,

    mae DOUBLE PRECISION,
    rmse DOUBLE PRECISION,
    bias DOUBLE PRECISION,

    skill_score DOUBLE PRECISION,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (
        location_key,
        model,
        variable,
        horizon_bucket,
        season,
        weather_regime,
        coastal,
        wind_sector
    )
);


CREATE TABLE IF NOT EXISTS wf_learning_runs (
    id BIGSERIAL PRIMARY KEY,

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,

    status TEXT NOT NULL DEFAULT 'running',

    predictions_verified INTEGER NOT NULL DEFAULT 0,
    observations_loaded INTEGER NOT NULL DEFAULT 0,
    skills_updated INTEGER NOT NULL DEFAULT 0,

    duration_ms INTEGER,

    error TEXT
);


CREATE TABLE IF NOT EXISTS wf_rain_eta_verification (
    id BIGSERIAL PRIMARY KEY,

    location_key TEXT NOT NULL,

    issued_at TIMESTAMPTZ NOT NULL,
    predicted_start TIMESTAMPTZ,
    predicted_end TIMESTAMPTZ,

    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,

    start_error_minutes DOUBLE PRECISION,
    end_error_minutes DOUBLE PRECISION,

    predicted_rain BOOLEAN,
    actual_rain BOOLEAN,

    hit BOOLEAN,
    miss BOOLEAN,
    false_alarm BOOLEAN,

    confidence DOUBLE PRECISION,

    verified BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_rain_eta_verify
ON wf_rain_eta_verification (
    verified,
    issued_at
);
