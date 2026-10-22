# Wheaterflow — snellere start en minder onnodig werk

Basis: `files-17--main (3).zip`. Het bestaande ontwerp is behouden. Het eerder voorgestelde Solar 2.0-dashboard is niet toegevoegd. Deze wijziging is lokaal voorbereid en getest; niets is gepubliceerd.

## Aanpassingen

1. **Voorspelling eerst zichtbaar.** Zodra de basisvoorspelling binnen is, verschijnt Vandaag en verdwijnt het laadscherm. Voorheen wachtte de pagina eerst op twaalf aanvullende bronnen en vervolgens op UV. De bestaande aanvullende gegevens worden nog steeds opgehaald en verfijnen de pagina daarna. Het laden daarvan is dus niet opeens sneller; de hoofdverwachting hoeft er niet meer op te wachten.
2. **Cast naast de normale start.** Op telefoon/desktop hoeft het weer niet op de configuratie en Google Cast SDK te wachten. De receiverroute blijft de bestaande volgorde gebruiken. Locatiesynchronisatie volgt zodra Cast klaar is.
3. **Grafieken en homekaart pas nabij beeld.** De vier uitgebreide grafieken en interactieve homekaart worden opgebouwd wanneer ze tot op 300 px van het zichtbare scherm komen. Scrol je ernaartoe, dan werken ze zoals voordien. De kaart op het aparte Radar-tabblad is niet veranderd.
4. **Dubbele verversingen samengevoegd.** Gelijktijdige aanvragen voor dezelfde locatie en hetzelfde weermodel delen één laadronde. Een oudere forecastaanvraag mag een nieuwere laadronde niet meer rechtstreeks overschrijven. Dit is geen algemene herbouw van de bestaande databronnen of hun interne locatielogica.
5. **Beperkte eerste service-workerdownload.** Grote afbeeldingen in `assets/` worden niet allemaal vooraf gedownload. Bekende statische afbeeldingen houden hun cachebeleid en worden bij gebruik opgeslagen. Live weersgegevens blijven netwerkgegevens; gebruikersfoto's behouden hun bestaande afzonderlijke behandeling.
6. **Opruimen.** Kaartinstanties, chart-listeners en zichtbaarheid-observers worden bij hertekenen opgeruimd. Opnieuw starten van automatische verversing maakt geen extra visibility-listener aan. Adminmeldingen krijgen expliciet een lege beginwaarde, zodat de eerste weergave kan tekenen voordat hun aanvraag klaar is.

## Metingen en hun betekenis

### Vooraf gecachte lokale bestanden

Op basis van de on-gecomprimeerde bestandsgrootten in het project:

| | Voorheen | Nu |
|---|---:|---:|
| Bestanden (exclusief de root-navigatie) | 136 | 31 |
| Totale grootte | 65.713.053 bytes | 2.684.715 bytes |

Dat is ongeveer 96% minder vooraf geselecteerde bestandsbytes. Dit is geen gemeten netwerkvolume: HTTP-compressie, browsercache en afbeeldingen die meteen in beeld komen beïnvloeden het echte verkeer. De grote afbeeldingen zijn niet verwijderd of in kwaliteit verlaagd.

**Offline-afweging:** een afbeelding die nog nooit geladen is, kan tijdens een eerste offlinebezoek ontbreken. De basistoepassing blijft vooraf gecachet. Ook voorheen waren externe integraties afhankelijk van hun verbinding.

### Gecontroleerde vergelijking van de laadfunctie

Drie runs met dezelfde gesimuleerde wachttijden: forecast 30 ms; iedere aanvullende bron 300 ms (parallel); UV 30 ms.

- Voorheen, eerste renderaanroep: 365 / 364 / 364 ms.
- Nu, eerste renderaanroep: 30 / 31 / 31 ms.

Dit is een geïsoleerde test van de laadvolgorde, zonder echte netwerkvertraging, browserlayout of complete appstart. Het is dus **geen claim dat de volledige app twaalf keer sneller is**. Serververtraging en externe scriptdownloads blijven van invloed.

## Tests

`npm test`: **13 tests geslaagd**, plus de syntaxiscontroles.

Nieuwe tests controleren gedeelde aanvragen en opnieuw proberen na een fout, het ongeldig worden van een oude laadronde, uitgestelde initialisatie/opruimen, de eerste weergave vóór trage aanvullende bronnen inclusief een mislukte optionele aanvraag, en het service-workercachebeleid. Bestaande tests voor regen en interactieve grafiekdata blijven slagen.

Volledige app in Chromium/Playwright met lokale gewijzigde bestanden en echte, alleen gelezen API-antwoorden:

- De normale voorspelling wordt zichtbaar, niet alleen de noodweergave.
- De vier uitgebreide grafieken en homekaart worden aanvankelijk niet geïnitialiseerd als ze buiten beeld staan.
- Bij scrollen worden alle vier grafieken en de Leaflet-homekaart actief.
- Toetsenbordselectie in de temperatuurgrafiek werkt.
- Desktop en een 390 px mobiele viewport bekeken.
- Geen JavaScript-fouten in de geslaagde integratierun.
- Solar 2.0 ontbreekt zoals bedoeld; bestaande layout en kaarten zijn behouden.

Geen fysieke toesteltest of volledige veldmeting op alle browsers/netwerken. Google Cast is niet met een fysieke ontvanger getest; de ontvangerroute is niet opnieuw ontworpen.

## Bestanden

Gewijzigd:
- `script.js`: progressieve weergave, gedeelde laadronde, uitgestelde widgets, opruimen en Cast-startvolgorde.
- `index.html`: nieuwe helper vóór de appcode, nieuwe scriptversie.
- `service-worker.js`: kleinere precache, efficiënte statische padlookup en cacheversie.
- `package.json`: nieuwe controles in `npm test`.

Nieuw:
- `performance.js`: kleine scheduler zonder afhankelijkheden of weerdatacache.
- `tests/performance.test.js`: vijf regressietests.
- `LEESMIJ-SNELHEID.md`: deze handleiding.

## Activeren en terugzetten

1. Gebruik de volledige zip als nieuwe projectversie, of pak de gewijzigde-bestanden-zip uit in de frontendmap waar `index.html` staat. Behoud de mapstructuur.
2. Deze patch hoort bij de aangeleverde `(3).zip`. Vergelijk eerst eventuele eigen wijzigingen van daarna.
3. Draai `npm test` en controleer je preview: Vandaag laden, daarna naar de uitgebreide grafieken en de interactieve kaart scrollen.
4. Publiceer via je gebruikelijke frontendproces als één release. Heropen de PWA of herlaad na de service-workerupdate. Er is geen backend-, container- of databasewijziging nodig.
5. Voor terugzetten: herstel `script.js`, `index.html`, `service-worker.js` en `package.json` uit de back-up en publiceer/herlaad opnieuw. De nieuwe losse helper en test mogen ongebruikt blijven staan.
