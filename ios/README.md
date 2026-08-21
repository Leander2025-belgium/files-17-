# Wheaterflow iOS companion

Deze map is volledig aanvullend. De bestaande PWA-bestanden (`index.html`, `script.js`, `style.css` en de service worker) worden niet door de iOS-targets gebruikt of gewijzigd.

## Bestaande repository

- De webclient is een statische, installable PWA in de repository-root. `script.js` beheert schermstatus, locatie, weersdata en de bestaande Wheaterflow Intelligence-laag.
- De PWA haalt de hoofdforecast momenteel rechtstreeks bij Open-Meteo op. Rain ETA wordt client-side uit `minutely_15` afgeleid met een natgrens van 0,1 mm, maximaal twaalf kwartierframes en een confidence-score.
- `api.wheaterflow.be` levert bestaande account-, profiel-, community-, push- en KNMI-functies. Providercredentials horen aan die serverkant; het publieke `/api/health`-endpoint is de operationele controle.
- Vercel- en Netlify-adapters in `api/` en `netlify/functions/` ondersteunen de webdeployments. De iOS-map wordt door geen van die webbuilds als frontendcode geladen.
- Voor de companion ontbrak een server-side Rain ETA-contract. Dat contract is daarom als een kleine, zelfstandige uitbreiding toegevoegd zonder de bestaande PWA-datastroom te veranderen.

## Architectuur

```text
api.wheaterflow.be/api/rain-eta
              |
              v
      RainETAClient (geen secrets)
              |
       RainETASnapshot v1
              |
       App Group UserDefaults
       /                  \
SwiftUI companion      WidgetKit
       |                |       \
  ActivityKit      Home/Lock   Live Activity
                              + Dynamic Island
```

- `Shared/` wordt in de app en widget-extension gecompileerd en bevat het API-contract, de client, App Group-opslag en ActivityKit-attributen.
- `Wheaterflow/` bevat de minimale SwiftUI-app, eenmalige locatietoegang en het lokaal starten/bijwerken/stoppen van de Live Activity.
- `WheaterflowWidgets/` bevat Home Screen- en Lock Screen-widgets plus Lock Screen, Dynamic Island expanded, compact en minimal voor de Live Activity.
- De client kent uitsluitend de publieke basis-URL. Providercredentials en beheercredentials horen niet in Swift, plist, entitlements of de PWA.

## API-contract

De companion gebruikt:

```text
GET https://api.wheaterflow.be/api/rain-eta?lat=51.2405&lon=2.9309&name=Oostende
```

De implementatie staat in `server/rain-eta-service.mjs`. Adapters voor Vercel en Netlify staan in `api/rain-eta.js` en `netlify/functions/rain-eta.js`. Voor de bestaande Express-server:

```js
app.get('/api/rain-eta', require('./rain-eta-route.cjs'));
```

Kopieer `rain-eta-route.cjs` en `rain-eta-service.mjs` naast de bestaande API-server en herstart de service. Controleer daarna:

```bash
curl 'https://api.wheaterflow.be/api/rain-eta?lat=51.2405&lon=2.9309&name=Oostende'
```

Zolang die productie-route nog niet is uitgerold, toont de app een duidelijke fout en blijven widgets op de laatst bekende of preview-snapshot staan. De iOS-client valt bewust niet rechtstreeks terug op een externe weerprovider.

## Openen en tekenen in Xcode

Vereist: macOS met Xcode 16 of nieuwer en een iPhone/iOS Simulator met iOS 17 of nieuwer.

1. Open `Wheaterflow.xcodeproj`.
2. Selecteer voor **Wheaterflow** en **WheaterflowWidgets** dezelfde Team onder Signing & Capabilities.
3. Als `be.wheaterflow.ios` niet voor jouw team beschikbaar is, wijzig dan beide bundle identifiers naar een eigen unieke reverse-DNS-naam.
4. Maak/activeer één App Group en zet dezelfde identifier op beide targets. Vervang `group.be.wheaterflow.shared` op drie plaatsen: beide entitlementbestanden en `Shared/AppGroupStore.swift`.
5. Kies de app-scheme en een iOS 17+-simulator of fysieke iPhone. Build en Run.
6. Geef locatietoegang, vernieuw Rain ETA en tik **Start Live Activity**.
7. Voeg via de widgetgalerij **Wheaterflow Rain ETA** toe. Lock Screen-widgets gebruiken accessory inline/circular/rectangular; Home Screen ondersteunt small en medium.

`project.yml` is de declaratieve bron voor XcodeGen. Als het projectbestand ooit opnieuw gegenereerd moet worden:

```bash
brew install xcodegen
cd ios
xcodegen generate
```

## Wat zonder betaalde Apple Developer Program-membership kan

- Met een gratis Apple Account kan Xcode apps op eigen apparaten testen. Personal Team-profielen verlopen na zeven dagen en moeten dan opnieuw worden gebouwd/geïnstalleerd.
- De simulator kan de app-, widget- en Live Activity-layouts testen zonder App Store-distributie.
- App Group-delen op een fysiek toestel vereist dat het door Xcode gemaakte profiel de App Group-entitlement voor beide targets bevat. Als Personal Team-signing dat voor jouw account weigert, kun je de losse UI in de simulator testen, maar niet betrouwbaar app en widget op het toestel laten delen.
- App Store/TestFlight-distributie vereist het betaalde Apple Developer Program.
- Deze eerste mijlpaal werkt lokaal: de app werkt de Live Activity bij wanneer Rain ETA wordt vernieuwd. Continue serverupdates wanneer de app niet draait vereisen een latere APNs/ActivityKit push-implementatie en geschikte provisioning; er is bewust nog geen pushsecret of tokenbeheer in de client opgenomen.

## Verificatie op macOS

Voer in de repository uit:

```bash
npm test
xcodebuild -project ios/Wheaterflow.xcodeproj \
  -scheme Wheaterflow \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  CODE_SIGNING_ALLOWED=NO build
```

Test daarna handmatig:

1. een droge, `rain_soon`, `raining` en unavailable API-snapshot;
2. small/medium en drie accessory widgetfamilies;
3. Live Activity op Lock Screen;
4. Dynamic Island expanded, compact en minimal op een ondersteund simulator/device;
5. app- en widgetdata na locatiewijziging en na een geforceerde API-fout.
