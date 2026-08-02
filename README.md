# Wheaterflow

Live weer, radar, waarschuwingen, community, persoonlijke klimaatdata en een professionele weerkaart.

## Online plaatsen zonder Netlify

Gebruik bij voorkeur Vercel voor deze versie. De app ondersteunt automatisch:

- Netlify Functions via `/.netlify/functions/...`
- Vercel Functions via `/api/...`

In Vercel:

1. Maak een account op `vercel.com`.
2. Kies `Add New` -> `Project`.
3. Kies je GitHub-repository.
4. Framework preset: `Other`.
5. Build command: `npm run build`.
6. Output directory: laat leeg of gebruik `.`.
7. Voeg de environment variables hieronder toe.
8. Klik `Deploy`.

## Environment variables

Zet deze waarden in Vercel bij `Project Settings` -> `Environment Variables`:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
XWEATHER_CLIENT_ID=
XWEATHER_CLIENT_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` en `XWEATHER_CLIENT_SECRET` mogen nooit in frontendcode of GitHub staan.

## Xweather MapsGL instellen

De professionele weerkaart gebruikt Xweather MapsGL. Zet deze waarden in Netlify bij:

`Project configuration` -> `Environment variables`

```text
XWEATHER_CLIENT_ID=
XWEATHER_CLIENT_SECRET=
```

Gebruik hier je eigen Xweather API & Maps gegevens. Zet deze waarden niet in `script.js`, `index.html`, GitHub of een publieke frontend-variabele.

De app haalt de instellingen op via Netlify of Vercel:

```text
/.netlify/functions/xweather-config
/api/xweather-config
```

Wanneer Xweather niet geconfigureerd is of een laag niet beschikbaar is binnen je abonnement, blijft de bestaande radar werken.

## Build

```bash
npm run build
```
