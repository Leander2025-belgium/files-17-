# Wheaterflow

Live weer, radar, waarschuwingen, community, persoonlijke klimaatdata en een professionele weerkaart.

## Hosting

- **Frontend + kleine API's:** Cloudflare Pages. De statische site staat in de root; de API-routes staan in `functions/api/` (Pages Functions):
  - `/api/alerts` — waarschuwingen (KV namespace `ALERTS`)
  - `/api/admin-login` — admin-login met sessiecookie (KV namespace `WHEATERFLOW_ADMIN_SECURITY`)
  - `/api/metar` — METAR-proxy (aviationweather.gov)
  - `/api/xweather-config`, `/api/xweather-conditions` — Xweather
- **Eigen server:** `backend/` draait op `https://api.wheaterflow.be` (accounts, community, push, bliksem, KMI/KNMI, weer-engine). De TV-koppeling via WebSocket draait met `server/tv-pairing-server.js`.

Headers en de `/tv`-route staan in `_headers` en `_redirects`.

## Cloudflare Pages instellen

Build command: `npm run build` — output directory: `/` (root).

Bindings (Settings → Functions):

```text
KV namespace  ALERTS
KV namespace  WHEATERFLOW_ADMIN_SECURITY
```

Variables & secrets (Settings → Environment variables):

```text
ADMIN_PASSWORD_HASH=      # pbkdf2$<iteraties>$<salt-base64>$<hash-base64>
ADMIN_SESSION_SECRET=
ADMIN_TOKEN=              # optioneel, Bearer-token als alternatief voor de login
XWEATHER_CLIENT_ID=
XWEATHER_CLIENT_SECRET=
```

Secrets horen nooit in frontendcode of GitHub. Als Xweather niet geconfigureerd is of een laag niet in je abonnement zit, blijft de gewone radar werken.

## Build

```bash
npm run build
```

## Native iOS companion

De geïsoleerde SwiftUI/WidgetKit/ActivityKit companion staat in `ios/`. Open op macOS `ios/Wheaterflow.xcodeproj` en volg `ios/README.md` voor signing, App Group, widget-, Live Activity- en API-deploymentstappen.


## Wheaterflow Shop

De webshop staat in `shop/` en is direct bereikbaar via `https://wheaterflow.be/shop/` zodra de repository is gedeployed.
De shop bevat momenteel de complete storefront, productopties, lokaal winkelmandje en checkout-UI. Productfoto’s, live orderverwerking en een betaalprovider zijn bewust nog niet gekoppeld.

Belangrijk voor live verkoop: sluit eerst een server-side orderflow en betaalprovider aan en vervang de voorlopige juridische teksten in `shop/privacy.html` en `shop/voorwaarden.html` door definitieve bedrijfsinformatie.
