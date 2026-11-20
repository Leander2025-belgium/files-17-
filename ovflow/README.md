# OVFlow – openbaar vervoer in heel België

OVFlow is een installeerbare webapp (PWA) voor **NMBS/SNCB, De Lijn, TEC en MIVB/STIB**.
Hij draait in elke browser en heeft geen API-sleutels of buildstap nodig.

Online: open `/ovflow/` op je bestaande website (Vercel, Netlify of Cloudflare Pages).

## Functies

| Tab | Wat |
|---|---|
| 🧭 **Plannen** | Routeplanner van deur tot deur over alle vervoerders heen: adressen, haltes, stations of "Mijn locatie". Vertrek- of aankomsttijd, filters voor trein/metro/tram/bus, max. aantal overstappen, wandeltempo en een rolstoeltoegankelijk profiel. Realtime vertragingen, perrons/sporen, afgeschafte ritten, storingsmeldingen, eerdere en latere verbindingen, en de route op de kaart. |
| ▶ **Live volgen** | Bij een reisadvies kun je op "Volg deze reis live" tikken. Je ziet dan een balk met de stap waar je nu bent ("Wandel naar…", "Wacht op…", "Uitstappen bij…"), het voertuig live op de kaart en je eigen GPS-positie. Je krijgt meldingen wanneer het tijd is om te vertrekken, bij vertraging of afschaffing, als een overstap in gevaar komt en net voor je moet uitstappen. |
| 🗺️ **Live** | Kaart met alle bussen, trams, metro's en treinen die nu rijden, met filters per vervoerder en type. Tik op een voertuig om de rit te volgen. Vanaf zoomniveau 15 verschijnen ook de haltes. |
| 🚏 **Vertrek** | Live vertrektijden en aankomsten per halte, met realtime vertraging, perron en afschaffingen, en haltes in de buurt via GPS. Wordt elke 30 s ververst. |
| 🚆 **Treinen** | NMBS-liveboards via iRail (met perronwijzigingen en bezetting), treinen opzoeken op nummer (bv. `IC 1832`) met hun live positie, en de actuele storingen en werken. |
| ⭐ **Mijn** | Thuis en werk instellen (snelknoppen "Naar huis" en "Naar werk"), bewaarde routes, favoriete haltes en stations, meldingen en installeren. |

Deeplinks zoals `#/stop/<id>`, `#/trip/<id>`, `#/station/<id>`, `#/train/BE.NMBS.IC1832` en gedeelde routes (`#/plan?f=…&t=…`) werken ook rechtstreeks.

## Databronnen

- **[Transitous](https://transitous.org)** (MOTIS 2-API, `api.transitous.org`): routeplanning, geocoding, vertrektijden, ritten en live voertuigposities. Transitous verwerkt de officiële GTFS-feeds van NMBS, De Lijn, TEC en MIVB, plus de GTFS-realtime van NMBS, De Lijn en TEC. Licentie: CC-BY 4.0.
- **[iRail](https://irail.be)** (`api.irail.be`): NMBS-stations, liveboards, treinritten en storingen.
- Kaart: OpenStreetMap-bijdragers en CARTO-basiskaarten, via Leaflet.

De app kiest zelf de nieuwste API-versie (v6 → v1) die de server ondersteunt.

## Proxy (automatische fallback)

De app praat rechtstreeks met de API's. Lukt dat niet, bijvoorbeeld door CORS of een netwerkfilter, dan schakelt hij automatisch over op een kleine serverproxy op je eigen domein:

- Vercel: `api/ov-proxy.js`
- Netlify: `netlify/functions/ov-proxy.js`
- Cloudflare Pages: route `/api/ov-proxy` in `_worker.js`

De proxy accepteert alleen GET-verzoeken naar `api.transitous.org` en `api.irail.be` (zie `server/ov-proxy.mjs`).

## Bestanden

```
ovflow/
  index.html            app-shell
  ovflow.css            vormgeving (licht/donker, mobiel/desktop)
  js/app.js             UI, kaart, routeplanner, live volgen, meldingen
  js/api.js             Transitous- en iRail-client met versie- en proxyfallback
  js/util.js            polyline, voertuiginterpolatie, tijden, vervoerders
  sw.js                 service worker (offline app-shell)
  manifest.webmanifest  PWA-manifest
  icons/                app-iconen
```

## Testen

```
npm test   # bevat tests/ovflow.test.js
```

Lokaal draaien: `python3 -m http.server` in de repo-root en dan `http://localhost:8000/ovflow/` openen.

## Grenzen

- Transitous en iRail zijn gratis community-diensten zonder garantie op beschikbaarheid. Bij veel gebruikers is een eigen MOTIS-server aan te raden.
- Live posities worden berekend uit realtime vertrek- en aankomsttijden en het traject. Het zijn geen GPS-posities van de voertuigen zelf.
- Voor MIVB is er in Transitous alleen een dienstregeling (geen realtime).
- Meldingen tijdens het live volgen werken zolang de app of het tabblad open is. Op iPhone moet je OVFlow daarvoor eerst via "Zet op beginscherm" installeren.
