# Wheaterflow – vernieuwde weerfoto-upload

Deze versie vernieuwt het scherm **Weerfoto delen** zonder de bestaande community- en serverfunctionaliteit te verwijderen.

## Wat is aangepast

- lichte Liquid Glass-panelen in plaats van donkere kaarten;
- duidelijke keuze tussen **Maak foto** en **Kies foto**;
- voorvertoning met centraal bijsnijden (origineel, vierkant of staand) en draaien;
- fotocontrole voor JPEG, PNG en WebP tot maximaal 20 MB;
- compacte chips voor de weersoort;
- privacykeuze: gemeente, exacte locatie of geen locatie;
- optionele automatische weergegevens;
- duidelijke laad-, fout- en succesmeldingen;
- verzendknop blijft uitgeschakeld totdat de invoer geldig is;
- navigatie verdwijnt tijdelijk tijdens het delen, zodat zij niets bedekt;
- foto's worden vóór upload verkleind tot maximaal 1800 pixels en gecomprimeerd.

## Bestanden

- `index.html` – vernieuwde uploadinterface;
- `style.css` – lichte Liquid Glass-styling en mobiele lay-out;
- `script.js` – fotoverwerking, validatie, privacy en uploadlogica;
- `service-worker.js` – nieuwe cacheversie zodat de wijziging direct wordt geladen;
- `backend/` – bestaande servercode, ongewijzigd.

## Testen

Open `index.html` via dezelfde ontwikkel- of hostingomgeving als de bestaande Wheaterflow-app. Voor het daadwerkelijk plaatsen van een foto moeten de bestaande backend en gebruikerssessie beschikbaar zijn.
