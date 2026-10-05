Wheaterflow — Bodemkaart herstel

Deze zip bevat:
- soil-card-fix.js

Plaats `soil-card-fix.js` in de hoofdmap van Wheaterflow.

Voeg in index.html DIRECT NA de bestaande script.js-regel toe:

<script src="./soil-card-fix.js?v=20261005-soil-card-v1"></script>

Daarna herladen / nieuwe deploy uitvoeren.

Wat wordt hersteld:
- aparte kaart 'Bodem'
- bodemtemperatuur
- bodemvocht
- temperatuurlaag 0 cm
- vochtlaag 0–1 cm
- status droog/normaal/vochtig
- status koud/gematigd/warm
- bron
- laatste update
- aanduiding van oudere cachedata
- nette Liquid Glass-opmaak

De bestaande bodemdata, Open-Meteo fallback en 10-minuten cache uit script.js
worden NIET vervangen of verwijderd.
