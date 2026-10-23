# Wheaterflow Travel 3.1 — kaart- en routeherstel

## Installatie
Kopieer de inhoud van de map `files-17--main/travel/` naar de al bestaande map `/travel/` op je website. De andere Wheaterflow-bestanden zijn niet gewijzigd. Laat de mapstructuur intact. Maak eerst een back-up. Wis eventueel de browsercache of voer een harde herlaadactie uit.

## Wat is aangepast
- Leaflet-basisstijlen toegevoegd als lokale fallback tegen uit elkaar vallende kaarttegels (ook bij geblokkeerde externe CSS).
- `invalidateSize()` bij openen, roteren en resizing van de kaart.
- Klik op de kaart om GPS-coördinaten als bestemming te kiezen.
- Eigen GPS-knoppen om de positie op de kaart te tonen en als vertrekpunt in te stellen, inclusief nauwkeurigheidscirkel. HTTPS en browsertoestemming vereist.
- Hersteld: `Mijn locatie` bleef soms tekst in plaats van echte coördinaten, vooral bij omwisselen van velden.
- Routing met echte wegen via externe OSRM-compatibele diensten en een tweede provider voor auto als fallback; fietsroutes en wandelroutes gebruiken respectievelijke services.
- Kiesbare alternatieve routes wanneer de routingdienst die teruggeeft.
- Vijf weerpunten langs de gekozen route, op verwachte passeertijd. Externe open diensten kunnen gelimiteerd of tijdelijk onbereikbaar zijn.

## Test
Open op HTTPS `/travel/`; kies `Mijn locatie`, geef locatietoestemming en vul `Brugge, België` in. Klik `Bereken mijn route`. Controleer dat de blauwe lijn door wegen loopt, dat reistijd/afstand realistisch zijn en dat je blauwe locatiestip zichtbaar is. Tik op een ander kaartpunt en plan een tweede route. Probeer ook fiets en wandelen. Controleer op mobiel en desktop.

## Grenzen
Publieke externe kaart/geocoding/routingdiensten hebben geen beschikbaarheidsgarantie of gegarandeerde capaciteit; een productieomgeving met veel gebruikers vereist eigen of contractuele kaart- en routinginfrastructuur. Er is geen live verkeer, offline kaart, spraakbegeleiding of automatische herberekening. Gebruik de app niet als enige veiligheidskritische navigatiebron tijdens het rijden. GPS werkt alleen in een beveiligde context (HTTPS/localhost) en na toestemming.
