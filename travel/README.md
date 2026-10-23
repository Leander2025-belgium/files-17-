# Wheaterflow Travel 3.0 – eerste werkende navigatiebasis

## Inhoud
- Losstaande responsieve `/travel/`-pagina met Wheaterflow-thema.
- OpenStreetMap-kaart via Leaflet, route met volledige lijn over wegen en manoeuvre-instructies.
- Auto-, fiets- en wandelroutes via de OpenStreetMap.de routingdiensten.
- Locaties opzoeken via Photon; Open-Meteo geocoding als fallback.
- Weer op vijf posities langs de wegroute, op de verwachte passeertijd, via Open-Meteo.
- Locatie met uitdrukkelijke browsertoestemming; stopknop, navigatiestappen en detectie van afwijken van de route.
- Bestaande 'Reisweer'-tab verwijst nu naar de nieuwe aparte pagina, in plaats van onnauwkeurige vogelvluchtberekening.

## Testen
Start een lokale statische webserver in de projectmap, bijvoorbeeld `python3 -m http.server 8080`, en open `http://localhost:8080/travel/`. Test vanaf HTTPS voor locatiegebruik buiten localhost. `npm test` test de bestaande projectonderdelen; `node --check travel/travel.js` controleert de nieuwe JS.

## Operationele aandachtspunten
De kaart, geocoder en routing komen van **externe publieke diensten**. Daardoor zijn bereikbaarheid, snelheidsbeperkingen, CORS, dekking en gebruiksvoorwaarden niet gegarandeerd. Voor echte productiedrukte: configureer eigen/gecontracteerde tile- en routingproviders, beperk gebruik en voeg server-side caching toe. Er is nog geen offline navigatie, gesproken begeleiding, live verkeer, automatische routeherberekening, zoekresultaatkeuze of geïntegreerde officiële waarschuwingendienst. 'Routebegeleiding' toont volgende stappen en signaleert afwijken, maar herberekent nog niet automatisch. Niet gebruiken als primaire navigatie tijdens het rijden; kijk niet naar je telefoon onderweg. Weerrisico's zijn indicatief en geen vervanging voor officiële meldingen.

## Plaatsen van bestanden
Houd de structuur exact aan. Plaats de gehele map op dezelfde host als `script.js` en de startpagina, zodat `/travel/` bereikbaar is. Er worden geen productiegegevens, auth-instellingen of backend-API's gewijzigd.
