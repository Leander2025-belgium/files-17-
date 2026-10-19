# Wheaterflow — aangepaste radarpagina

Deze versie past de radarpagina aan aan het gekozen glasontwerp. De bestaande kaart, kaartbronnen, radarframes, weergegevens en onderste navigatie zijn behouden.

## Wat is aangepast?

- Glazen bovenpaneel met Buienradar, Regen, Satelliet, Wind en Lagen.
- Temperatuur, Bewolking en Bliksem blijven bereikbaar via Lagen.
- Compacte ronde knoppen voor huidige locatie en volledig scherm.
- Glazen paneel met kleurenlegenda, afspelen/pauzeren en tijdschuif.
- De tijdas volgt de werkelijk beschikbare radarframes. Het begin kan daarom bijvoorbeeld −50m zijn in plaats van −1u. Er worden geen radarframes verzonnen om het voorbeeld na te bootsen.
- Verwachtingsframes zijn herkenbaar aan het onderbroken deel van de tijdlijn.
- De bestaande 6-, 12- en 24-uurs modelverwachtingen blijven beschikbaar.
- Toetsenbordbediening, zichtbare focus, toegankelijke knoppen en Escape om Lagen te sluiten.
- Mobiele weergave, korte schermen en desktop krijgen passende afmetingen.

## Bestanden

Gewijzigd: index.html, script.js, service-worker.js.
Nieuw: radar-design.css, radar-design.js, deze LEESMIJ-RADAR.md.

De nieuwe styling is uitsluitend op de radarpagina gericht. De kaartconfiguratie en gegevensdiensten zijn niet vervangen. De service-worker heeft een nieuwe cacheversie en bewaart ook de nieuwe bestanden. Bestaande foutieve cachepaden (assets/tv tegenover assets/Tv en een ontbrekend locatie-icoon) zijn gecorrigeerd, zodat die de installatie van de cache niet laten mislukken.

## Plaatsen

Maak eerst een kopie van de bestaande website. Plaats de bestanden met dezelfde mappenstructuur op de bestaande hosting. Gebruik de reeds ingestelde serverfuncties en omgevingsvariabelen. Er zijn geen nieuwe dependencies nodig. Bij gebruik van de zip met alleen wijzigingen moeten ALLE bijgeleverde bestanden samen worden vervangen/toegevoegd.

De website is door deze levering niet gepubliceerd. Na plaatsing kan een herlaadbeurt nodig zijn voordat een reeds geopende app de nieuwe versie toont.

## Controle

De bestaande npm-testset slaagt (vier tests, plus de bestaande syntaxcontroles). De nieuwe JavaScript-module is op syntax gecontroleerd. De radarpagina is met echte kaart- en radargegevens in Chromium bekeken op mobiel en desktop; de gewijzigde lokale bestanden werden daarbij alleen in de testbrowser geladen. De website zelf is niet gewijzigd.

De meegeleverde voorbeeldafbeelding bij de levering is een screenshot van de geïmplementeerde pagina. Kaartuitsnede, actuele neerslag, labels en tijdstippen veranderen vanzelf mee met schermformaat, locatie en gegevens.
