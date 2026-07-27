# Weerscoop

Live weer, radar, waarschuwingen, community, persoonlijke klimaatdata en een professionele weerkaart.

## Xweather MapsGL instellen

De professionele weerkaart gebruikt Xweather MapsGL. Zet deze waarden in Netlify bij:

`Project configuration` -> `Environment variables`

```text
XWEATHER_CLIENT_ID=
XWEATHER_CLIENT_SECRET=
```

Gebruik hier je eigen Xweather API & Maps gegevens. Zet deze waarden niet in `script.js`, `index.html`, GitHub of een publieke frontend-variabele.

De app haalt de instellingen op via:

```text
/.netlify/functions/xweather-config
```

Wanneer Xweather niet geconfigureerd is of een laag niet beschikbaar is binnen je abonnement, blijft de bestaande radar werken.

## Build

```bash
npm run build
```

