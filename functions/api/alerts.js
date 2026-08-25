// Wheaterflow Alerts API v2
// Cloudflare Pages Function — /api/alerts
//
// Vereist:
// - KV namespace: ALERTS
// - secret: ADMIN_TOKEN

const KV_KEY = "alerts";

const VALID_TYPES = [
  "info",
  "warning",
  "danger"
];

const VALID_SCOPES = [
  "all",
  "land",
  "provincie",
  "stad"
];


/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function cors(response) {
  const headers =
    new Headers(response.headers);

  headers.set(
    "Access-Control-Allow-Origin",
    "*"
  );

  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );

  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  headers.set(
    "Cache-Control",
    "no-store"
  );

  return new Response(
    response.body,
    {
      status: response.status,
      statusText: response.statusText,
      headers
    }
  );
}


function json(data, init = {}) {
  const headers =
    new Headers(
      init.headers || {}
    );

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  return cors(
    new Response(
      JSON.stringify(data),
      {
        ...init,
        headers
      }
    )
  );
}


function errorResponse(
  message,
  status = 400
) {
  return json(
    {
      ok: false,
      error: message
    },
    {
      status
    }
  );
}


/* =========================================================
   AUTH
   ========================================================= */

function isAuthorized(
  request,
  env
) {
  if (!env.ADMIN_TOKEN) {
    return false;
  }

  const auth =
    request.headers.get(
      "Authorization"
    ) || "";

  return (
    auth ===
    `Bearer ${env.ADMIN_TOKEN}`
  );
}


/* =========================================================
   DATA HELPERS
   ========================================================= */

async function readAlerts(env) {
  if (!env.ALERTS) {
    return [];
  }

  const alerts =
    await env.ALERTS.get(
      KV_KEY,
      {
        type: "json"
      }
    );

  return Array.isArray(alerts)
    ? alerts
    : [];
}


async function writeAlerts(
  env,
  alerts
) {
  if (!env.ALERTS) {
    throw new Error(
      "ALERTS KV namespace ontbreekt"
    );
  }

  await env.ALERTS.put(
    KV_KEY,
    JSON.stringify(alerts)
  );
}


function text(
  value,
  maxLength
) {
  return String(
    value ?? ""
  )
    .trim()
    .slice(
      0,
      maxLength
    );
}


function norm(value) {
  return String(
    value || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}


function normalizeDate(
  value,
  fallback = null
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}


function alertStatus(
  alert,
  nowMs = Date.now()
) {
  const start =
    alert.startsAt
      ? new Date(
          alert.startsAt
        ).getTime()
      : 0;

  const end =
    alert.endsAt
      ? new Date(
          alert.endsAt
        ).getTime()
      : Infinity;

  if (
    Number.isFinite(start) &&
    start > nowMs
  ) {
    return "scheduled";
  }

  if (
    Number.isFinite(end) &&
    end <= nowMs
  ) {
    return "expired";
  }

  return "active";
}


/*
 * Houdt compatibiliteit met locaties zoals:
 *
 * alert:
 *   West-Vlaanderen
 *
 * app:
 *   West-Vlaanderen, België
 */
function locationMatches(
  alertValue,
  requestValue
) {
  const expected =
    norm(alertValue);

  const actual =
    norm(requestValue);

  if (
    !expected ||
    !actual
  ) {
    return false;
  }

  if (
    expected === actual
  ) {
    return true;
  }

  if (
    actual.startsWith(
      expected + ","
    )
  ) {
    return true;
  }

  if (
    expected.startsWith(
      actual + ","
    )
  ) {
    return true;
  }

  return false;
}


function matchesScope(
  alert,
  {
    land,
    provincie,
    stad
  }
) {
  const scope =
    alert.scope || "all";

  if (
    scope === "all"
  ) {
    return true;
  }

  if (
    scope === "land"
  ) {
    return locationMatches(
      alert.scopeValue,
      land
    );
  }

  if (
    scope === "provincie"
  ) {
    return locationMatches(
      alert.scopeValue,
      provincie
    );
  }

  if (
    scope === "stad"
  ) {
    return locationMatches(
      alert.scopeValue,
      stad
    );
  }

  return false;
}


function publicAlert(alert) {
  return {
    id:
      alert.id,

    type:
      alert.type || "info",

    title:
      alert.title,

    message:
      alert.message,

    scope:
      alert.scope || "all",

    scopeValue:
      alert.scopeValue || null,

    startsAt:
      alert.startsAt || null,

    endsAt:
      alert.endsAt || null,

    createdAt:
      alert.createdAt || null,

    showInApp:
      alert.showInApp !== false
  };
}


/* =========================================================
   OPTIONS
   ========================================================= */

export async function onRequestOptions() {
  return cors(
    new Response(
      null,
      {
        status: 204
      }
    )
  );
}


/* =========================================================
   GET
   ========================================================= */

export async function onRequestGet(
  context
) {
  const {
    env,
    request
  } = context;

  try {
    const url =
      new URL(
        request.url
      );

    const adminMode =
      url.searchParams.get(
        "admin"
      ) === "1";

    let alerts =
      await readAlerts(env);


    /*
     * ADMIN:
     * geeft ook geplande en verlopen
     * meldingen terug.
     */
    if (adminMode) {
      if (
        !isAuthorized(
          request,
          env
        )
      ) {
        return errorResponse(
          "Unauthorized",
          401
        );
      }

      alerts =
        alerts
          .map(alert => ({
            ...alert,
            status:
              alertStatus(
                alert
              )
          }))
          .sort((a, b) => {
            return (
              new Date(
                b.createdAt || 0
              ).getTime()
              -
              new Date(
                a.createdAt || 0
              ).getTime()
            );
          });

      return json({
        ok: true,
        count:
          alerts.length,
        alerts
      });
    }


    /*
     * PUBLIEKE APP:
     *
     * Alleen:
     * - gestart
     * - niet verlopen
     * - showInApp=true
     * - passend bij locatie
     */

    const now =
      Date.now();

    const land =
      url.searchParams.get(
        "land"
      );

    const provincie =
      url.searchParams.get(
        "provincie"
      );

    const stad =
      url.searchParams.get(
        "stad"
      );


    alerts =
      alerts.filter(
        alert => {

          if (
            alert.showInApp === false
          ) {
            return false;
          }

          if (
            alertStatus(
              alert,
              now
            ) !== "active"
          ) {
            return false;
          }

          return matchesScope(
            alert,
            {
              land,
              provincie,
              stad
            }
          );
        }
      );


    return json(
      alerts.map(
        publicAlert
      )
    );

  } catch (error) {
    console.error(
      "alerts GET:",
      error
    );

    return errorResponse(
      "Meldingen konden niet worden geladen.",
      500
    );
  }
}


/* =========================================================
   POST
   ========================================================= */

export async function onRequestPost(
  context
) {
  const {
    request,
    env
  } = context;

  if (
    !isAuthorized(
      request,
      env
    )
  ) {
    return errorResponse(
      "Unauthorized",
      401
    );
  }


  let body;

  try {
    body =
      await request.json();
  } catch {
    return errorResponse(
      "Ongeldige JSON",
      400
    );
  }


  const title =
    text(
      body.title,
      100
    );

  const message =
    text(
      body.message,
      500
    );


  if (
    !title ||
    !message
  ) {
    return errorResponse(
      "Titel en bericht zijn verplicht.",
      400
    );
  }


  const type =
    VALID_TYPES.includes(
      body.type
    )
      ? body.type
      : "info";


  const scope =
    VALID_SCOPES.includes(
      body.scope
    )
      ? body.scope
      : "all";


  const scopeValue =
    scope === "all"
      ? null
      : text(
          body.scopeValue,
          120
        );


  if (
    scope !== "all" &&
    !scopeValue
  ) {
    return errorResponse(
      "Een locatie is verplicht voor dit doelgebied.",
      400
    );
  }


  const now =
    new Date();

  const startsAt =
    normalizeDate(
      body.startsAt,
      now.toISOString()
    );


  if (!startsAt) {
    return errorResponse(
      "Ongeldige startdatum.",
      400
    );
  }


  const endsAt =
    normalizeDate(
      body.endsAt,
      null
    );


  if (
    body.endsAt &&
    !endsAt
  ) {
    return errorResponse(
      "Ongeldige einddatum.",
      400
    );
  }


  if (
    endsAt &&
    new Date(
      endsAt
    ).getTime()
      <=
    new Date(
      startsAt
    ).getTime()
  ) {
    return errorResponse(
      "De eindtijd moet na de starttijd liggen.",
      400
    );
  }


  const alerts =
    await readAlerts(env);


  const createdAt =
    now.toISOString();


  const item = {
    id:
      crypto.randomUUID(),

    type,

    title,

    message,

    scope,

    scopeValue,

    startsAt,

    endsAt,

    showInApp:
      body.showInApp !== false,

    sendPush:
      body.sendPush === true,

    pushSentAt:
      null,

    pushResult:
      null,

    createdAt,

    updatedAt:
      createdAt
  };


  alerts.unshift(
    item
  );


  /*
   * Houd KV beheersbaar.
   * Verlopen historie blijft voorlopig
   * maximaal 500 records.
   */
  const limited =
    alerts.slice(
      0,
      500
    );


  try {
    await writeAlerts(
      env,
      limited
    );
  } catch (error) {
    console.error(
      "alerts POST storage:",
      error
    );

    return errorResponse(
      "Melding kon niet worden opgeslagen.",
      500
    );
  }


  return json(
    {
      ok: true,
      alert: {
        ...item,
        status:
          alertStatus(
            item
          )
      }
    },
    {
      status: 201
    }
  );
}


/* =========================================================
   PATCH
   ========================================================= */

export async function onRequestPatch(
  context
) {
  const {
    request,
    env
  } = context;


  if (
    !isAuthorized(
      request,
      env
    )
  ) {
    return errorResponse(
      "Unauthorized",
      401
    );
  }


  let body;

  try {
    body =
      await request.json();
  } catch {
    return errorResponse(
      "Ongeldige JSON",
      400
    );
  }


  const url =
    new URL(
      request.url
    );

  const id =
    text(
      url.searchParams.get(
        "id"
      ) || body.id,
      100
    );


  if (!id) {
    return errorResponse(
      "id ontbreekt",
      400
    );
  }


  const alerts =
    await readAlerts(env);


  const index =
    alerts.findIndex(
      alert =>
        alert.id === id
    );


  if (index === -1) {
    return errorResponse(
      "Melding niet gevonden.",
      404
    );
  }


  const current =
    alerts[index];


  const next = {
    ...current
  };


  if (
    body.type !== undefined
  ) {
    if (
      !VALID_TYPES.includes(
        body.type
      )
    ) {
      return errorResponse(
        "Ongeldig meldingstype.",
        400
      );
    }

    next.type =
      body.type;
  }


  if (
    body.title !== undefined
  ) {
    next.title =
      text(
        body.title,
        100
      );

    if (!next.title) {
      return errorResponse(
        "Titel mag niet leeg zijn.",
        400
      );
    }
  }


  if (
    body.message !== undefined
  ) {
    next.message =
      text(
        body.message,
        500
      );

    if (!next.message) {
      return errorResponse(
        "Bericht mag niet leeg zijn.",
        400
      );
    }
  }


  if (
    body.scope !== undefined
  ) {
    if (
      !VALID_SCOPES.includes(
        body.scope
      )
    ) {
      return errorResponse(
        "Ongeldig doelgebied.",
        400
      );
    }

    next.scope =
      body.scope;
  }


  if (
    body.scopeValue !== undefined ||
    body.scope !== undefined
  ) {
    next.scopeValue =
      next.scope === "all"
        ? null
        : text(
            body.scopeValue
              ??
            next.scopeValue,
            120
          );

    if (
      next.scope !== "all" &&
      !next.scopeValue
    ) {
      return errorResponse(
        "Locatie ontbreekt.",
        400
      );
    }
  }


  if (
    body.startsAt !== undefined
  ) {
    const value =
      normalizeDate(
        body.startsAt,
        null
      );

    if (!value) {
      return errorResponse(
        "Ongeldige startdatum.",
        400
      );
    }

    next.startsAt =
      value;
  }


  if (
    body.endsAt !== undefined
  ) {
    if (
      body.endsAt === null ||
      body.endsAt === ""
    ) {
      next.endsAt =
        null;
    } else {
      const value =
        normalizeDate(
          body.endsAt,
          null
        );

      if (!value) {
        return errorResponse(
          "Ongeldige einddatum.",
          400
        );
      }

      next.endsAt =
        value;
    }
  }


  if (
    next.endsAt &&
    new Date(
      next.endsAt
    ).getTime()
      <=
    new Date(
      next.startsAt
    ).getTime()
  ) {
    return errorResponse(
      "De eindtijd moet na de starttijd liggen.",
      400
    );
  }


  if (
    body.showInApp !== undefined
  ) {
    next.showInApp =
      body.showInApp === true;
  }


  if (
    body.sendPush !== undefined
  ) {
    next.sendPush =
      body.sendPush === true;
  }


  next.updatedAt =
    new Date().toISOString();


  alerts[index] =
    next;


  await writeAlerts(
    env,
    alerts
  );


  return json({
    ok: true,
    alert: {
      ...next,
      status:
        alertStatus(
          next
        )
    }
  });
}


/* =========================================================
   DELETE
   ========================================================= */

export async function onRequestDelete(
  context
) {
  const {
    request,
    env
  } = context;


  if (
    !isAuthorized(
      request,
      env
    )
  ) {
    return errorResponse(
      "Unauthorized",
      401
    );
  }


  const url =
    new URL(
      request.url
    );


  const id =
    text(
      url.searchParams.get(
        "id"
      ),
      100
    );


  if (!id) {
    return errorResponse(
      "id ontbreekt",
      400
    );
  }


  const alerts =
    await readAlerts(env);


  const next =
    alerts.filter(
      alert =>
        alert.id !== id
    );


  if (
    next.length ===
    alerts.length
  ) {
    return errorResponse(
      "Melding niet gevonden.",
      404
    );
  }


  await writeAlerts(
    env,
    next
  );


  return cors(
    new Response(
      null,
      {
        status: 204
      }
    )
  );
}
