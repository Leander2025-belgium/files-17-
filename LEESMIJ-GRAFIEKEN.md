# Wheaterflow — vier interactieve weerkaarten

Deze levering bevat zowel de eerder aangepaste radarpagina als de nieuwe kaarten Temperatuur, Neerslag, UV-index en Wind.

## Nieuwe kaarten

- Blauwe glaskaarten met beter contrast, grote kernwaarden, duidelijke legenda en rustige grafieken.
- Twee kolommen op brede schermen, één kolom op mobiel.
- Neerslag toont Droog, Lichte regen, Matige regen of Zware regen. De kans in procenten heeft een eigen as; die bepaalt niet de intensiteit.
- De intensiteitsindeling gebruikt dezelfde drempels als de bestaande neerslagservice: onder 0,1 mm/u droog, vanaf 0,1 licht, vanaf 1 matig, vanaf 3 zwaar. Dit is de app-indeling, geen nieuwe officiële waarschuwingsschaal.
- In het detailvenster blijft de oorspronkelijke hoeveelheid beschikbaar als mm/u, met twee decimalen.
- Nachtschaduw wordt alleen getoond wanneer de bron dag/nacht of zonsopkomst/zonsondergang levert.

## Bediening

Beweeg de muis, tik of sleep horizontaal over een grafiek. Een verticale markering en detailvenster verschijnen op ALLE vier de kaarten voor hetzelfde uur. De kernwaarden bovenaan volgen het gekozen uur.

- Temperatuur en gevoelstemperatuur in °C.
- Neerslagintensiteit, hoeveelheid in mm/u en neerslagkans in %.
- Exacte UV-index.
- Wind en windstoten in km/u, plus windrichting wanneer beschikbaar.

De selectie blijft staan tot je een ander uur kiest of op Terug naar nu drukt. Met Tab kun je een grafiek focussen. Links/Rechts kiezen een uur; Home/End gaan naar het eerste/laatste uur; Escape wist de selectie. Verticaal vegen blijft gewoon de pagina scrollen.

## Gegevens

De bestaande forecastbron wordt gebruikt. Ontbrekende waarden worden niet als nul voorgesteld. Bij de live controle leverde de huidige backend geen UV-uurreeks. In dat geval toont die kaart Geen gegevens beschikbaar; zodra geldige UV-uurwaarden in hourly.uv_index beschikbaar zijn, verschijnen de grafiek en sleepwaarden automatisch. Een echt gemeten/voorspeld UV-nulpunt wordt wel als 0 weergegeven. Er zijn geen fictieve UV-gegevens of afgeleide uurwaarden uit een dagmaximum toegevoegd.

## Plaatsen

Maak een reservekopie en plaats de bestanden in de bestaande webroot met dezelfde mappenstructuur. De volledige zip bevat de hele app. De zip met gewijzigde bestanden bevat alle wijzigingen ten opzichte van de oorspronkelijk aangeleverde zip, dus ook de eerdere radaraanpassing. Beide pakketten bevatten dezelfde definitieve versies van de gewijzigde bestanden.

Nieuwe kaartbestanden: weather-charts.js en weather-charts.css.
Aangepast voor de kaarten: index.html, script.js, service-worker.js, package.json.
Nieuwe regressietests: tests/weather-charts.test.js.

De service-worker-cacheversie is vernieuwd. Plaats index.html, script.js en beide nieuwe kaartbestanden samen. De bestaande hosting, API-instellingen en dependencies blijven van toepassing. Er is niets live gepubliceerd door deze levering.

## Controle

npm test: acht tests geslaagd, inclusief vier nieuwe controles voor intensiteitsdrempels, exacte mm-waarden, ontbrekende gegevens en tijdreeksen over middernacht. Syntaxcontroles zijn geslaagd.

In Chromium gecontroleerd: vier gesynchroniseerde markeringen, numerieke neerslagdetails, slepen buiten de grafiekrand, toetsenbordbediening, reset, opnieuw openen van de kaarten, korte/onvolledige tijdreeksen, echte touchgebeurtenissen op mobiel en verticaal scrollen over een grafiek. Geen JavaScript-fouten tijdens deze controles.
