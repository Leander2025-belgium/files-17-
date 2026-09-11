/* Wheaterflow i18n v1 — Nederlands, Français, Deutsch, English
   Nederlands blijft de canonieke brontaal. */
(() => {
  'use strict';

  const SUPPORTED = ['nl', 'fr', 'de', 'en'];
  const LOCALES = { nl:'nl-BE', fr:'fr-BE', de:'de-DE', en:'en-GB' };
  const LANGUAGE_NAMES = { nl:'Nederlands', fr:'Français', de:'Deutsch', en:'English' };
  const STORAGE_KEY = 'wheaterflow:language';

  const T = {
    fr: {
      'Wheaterflow – live weer, radar en verwachtingen':'Wheaterflow – météo en direct, radar et prévisions',
      'Wheaterflow – live weer voor België':'Wheaterflow – météo en direct pour la Belgique',
      'Wheaterflow is een Belgisch weerplatform voor live weer, regenradar, lokale weersverwachtingen en weerwaarschuwingen.':'Wheaterflow est une plateforme météo belge pour la météo en direct, le radar de pluie, les prévisions locales et les alertes météo.',
      'Belgisch weerplatform voor live weer, radar en persoonlijke waarschuwingen':'Plateforme météo belge pour la météo en direct, le radar et les alertes personnalisées',
      'Live weer wordt geladen':'Chargement de la météo en direct',
      'Setup overslaan':'Passer la configuration', 'Welkom':'Bienvenue',
      'Weer dat met je meebeweegt.':'La météo qui vous accompagne.',
      'Live radar, slimme waarschuwingen en lokale verwachtingen in één rustige, persoonlijke app.':'Radar en direct, alertes intelligentes et prévisions locales dans une application claire et personnalisée.',
      'Slimme':'Intelligentes', 'meldingen':'alertes', 'Dagelijks':'Quotidien', 'overzicht':'aperçu', 'Begin':'Commencer',
      'Jouw locatie':'Votre position', 'Hyperlokaal vanaf het eerste moment.':'Hyperlocal dès le premier instant.',
      'Sta locatie toe om je huidige weer, regen-ETA, radar en waarschuwingen automatisch voor de juiste plek te tonen.':'Autorisez la localisation pour afficher automatiquement la météo actuelle, l’arrivée de la pluie, le radar et les alertes au bon endroit.',
      'Locatie':'Position', 'Nog niet ingesteld':'Pas encore configuré', 'Later instellen':'Configurer plus tard', 'Sta locatie toe':'Autoriser la localisation',
      'Blijf op de hoogte':'Restez informé', 'Alleen meldingen die ertoe doen.':'Uniquement les alertes qui comptent.',
      'Krijg een seintje bij naderende regen, onweer en officiële waarschuwingen. Je kunt alles later per type aanpassen.':'Recevez une alerte en cas de pluie imminente, d’orage et d’alertes officielles. Vous pourrez ensuite régler chaque type séparément.',
      'Regen op komst':'Pluie à l’approche', 'Bui bereikt je locatie over ongeveer 20 min.':'Une averse atteindra votre position dans environ 20 min.',
      'Onweer in de buurt':'Orage à proximité', 'Actieve onweerscel nadert jouw regio.':'Une cellule orageuse active approche de votre région.',
      'Officiële waarschuwingen':'Alertes officielles', 'Belangrijke weerwaarschuwingen voor jouw regio.':'Alertes météo importantes pour votre région.',
      'Waarschuw wanneer een bui nadert.':'Prévenir lorsqu’une averse approche.', 'Onweer of bliksem in jouw buurt.':'Orage ou foudre près de vous.',
      'Code geel, oranje en rood.':'Codes jaune, orange et rouge.', 'Dagelijks weeroverzicht':'Résumé météo quotidien', 'Een korte ochtendverwachting.':'Une courte prévision matinale.',
      'Schakel meldingen in':'Activer les notifications', 'Als echte app':'Comme une vraie app', 'Zet Wheaterflow op je beginscherm.':'Ajoutez Wheaterflow à votre écran d’accueil.',
      'Open Wheaterflow zonder browserbalk en krijg de beste ervaring voor radar, meldingen en je locaties.':'Ouvrez Wheaterflow sans barre de navigateur pour profiter au mieux du radar, des notifications et de vos lieux.',
      'Tik op Delen':'Touchez Partager', 'Onderaan in Safari.':'En bas dans Safari.', 'Zet op beginscherm':'Sur l’écran d’accueil', 'Kies deze optie in het deelmenu.':'Choisissez cette option dans le menu de partage.',
      'Tik op Voeg toe':'Touchez Ajouter', 'Daarna opent Wheaterflow als app.':'Wheaterflow s’ouvrira ensuite comme une application.',
      'Begrepen':'Compris', 'Maak het persoonlijk':'Personnalisez-le', 'Je Wheaterflow, op elk toestel.':'Votre Wheaterflow, sur chaque appareil.',
      'Met een gratis profiel bewaar je thuislocatie, favorieten, eenheden, meldingsvoorkeuren en weermodelkeuze.':'Avec un profil gratuit, conservez votre domicile, vos favoris, unités, préférences de notification et modèle météo.',
      'Jouw profiel':'Votre profil', 'Favorieten, voorkeuren en meldingen bewaren':'Enregistrer favoris, préférences et notifications', 'Optioneel':'Facultatif', 'Maak profiel':'Créer un profil',
      'Klaar':'Terminé', 'Wheaterflow is ingesteld.':'Wheaterflow est configuré.',
      'Vanaf nu opent de app direct op je weer. Alles wat je net koos kun je later wijzigen via Profiel en Instellingen.':'Désormais, l’application s’ouvre directement sur votre météo. Vous pourrez modifier vos choix plus tard via Profil et Paramètres.',
      'Niet ingesteld':'Non configuré', 'Start Wheaterflow':'Démarrer Wheaterflow',

      'Vandaag':'Aujourd’hui', 'Voorspelling':'Prévisions', 'Radar':'Radar', 'Community':'Communauté', 'Profiel':'Profil',
      'Instellingen':'Paramètres', 'Sluiten':'Fermer', 'Terug':'Retour', 'Vorige':'Précédent', 'Volgende':'Suivant', 'Nu':'Maintenant',
      'Mijn locatie':'Ma position', 'MIJN LOCATIE':'MA POSITION', 'Huidige locatie':'Position actuelle', 'Huidige GPS-locatie geladen':'Position GPS actuelle chargée',
      'Locatie bepalen...':'Détermination de la position…', 'Locatie bepalen…':'Détermination de la position…', 'Plaats kiezen':'Choisir un lieu', 'Zoek een plaats...':'Rechercher un lieu…',
      'Zojuist bijgewerkt':'Mis à jour à l’instant', 'Weer laden...':'Chargement de la météo…', 'Weer laden…':'Chargement de la météo…',
      'Gegevens worden geladen…':'Chargement des données…', 'Momenteel geen gegevens beschikbaar':'Aucune donnée disponible pour le moment', 'Opnieuw proberen':'Réessayer',
      'Radargegevens tijdelijk niet beschikbaar':'Données radar temporairement indisponibles', 'Komende 24 uur':'Prochaines 24 heures', '7-daagse verwachting':'Prévisions sur 7 jours', 'Bekijk alle 14 dagen':'Voir les 14 jours',
      'Jouw weer vandaag':'Votre météo aujourd’hui', 'Actuele weersinformatie voor jouw locatie.':'Informations météo actuelles pour votre position.',
      'Favoriete locaties':'Lieux favoris', 'Weermeldingen':'Alertes météo', 'Weervoorkeuren':'Préférences météo', 'Binnenkort beschikbaar':'Bientôt disponible', 'In de maak':'En préparation',
      'Persoonlijke gegevens':'Données personnelles', 'Thuislocatie':'Domicile', 'Actuele gps-locatie gebruiken':'Utiliser la position GPS actuelle', 'Wijzigingen opslaan':'Enregistrer les modifications',
      'Op je account':'Sur votre compte', '+ Huidige locatie':'+ Position actuelle', 'ACCOUNTBEHEER':'GESTION DU COMPTE', 'Lokale gegevens naar account kopiëren':'Copier les données locales vers le compte',
      'Wachtwoord wijzigen':'Modifier le mot de passe', 'Uitloggen':'Se déconnecter', 'GEVAARLIJKE ACTIES':'ACTIONS SENSIBLES', 'Account verwijderen':'Supprimer le compte', 'Bewerk profiel':'Modifier le profil',
      'Profiel laden...':'Chargement du profil…', 'Synchroniseer favorieten, instellingen en meldingen.':'Synchronisez favoris, paramètres et notifications.', 'Inloggen':'Se connecter', 'Account aanmaken':'Créer un compte',
      'E-mailadres':'Adresse e-mail', 'Wachtwoord':'Mot de passe', 'Wachtwoord tonen':'Afficher le mot de passe', 'Wachtwoord vergeten?':'Mot de passe oublié ?', 'Weergavenaam':'Nom affiché', 'Wachtwoord herhalen':'Répéter le mot de passe',
      'Ik ga akkoord met de privacyvoorwaarden.':'J’accepte les conditions de confidentialité.', 'Doorgaan als gast':'Continuer en invité', 'Privacy in het kort':'Confidentialité en bref',

      'Taal':'Langue', 'App-taal':'Langue de l’application', 'Taal & regio':'Langue et région', 'Kies de taal van Wheaterflow. De wijziging wordt direct toegepast en op je account bewaard.':'Choisissez la langue de Wheaterflow. Le changement est appliqué immédiatement et enregistré sur votre compte.',
      'Eenheden':'Unités', 'Weergave':'Affichage', 'Temperatuur':'Température', 'Windsnelheid':'Vitesse du vent', 'Neerslag':'Précipitations', 'Luchtdruk':'Pression atmosphérique',
      'Model':'Modèle', 'Vooruitzicht':'Période', '7 dagen':'7 jours', '14 dagen':'14 jours', 'Weermodel':'Modèle météo', 'Automatisch':'Automatique', 'actief':'actif',
      'Data':'Données', 'Actueel':'Actuel', 'Nu verversen':'Actualiser maintenant', 'Laatste update staat op het beginscherm bij je actuele weer.':'La dernière mise à jour s’affiche sur l’écran d’accueil avec votre météo actuelle.',
      'Wheaterflow setup':'Configuration Wheaterflow', 'Onboarding':'Prise en main', 'Onboarding opnieuw bekijken':'Revoir la prise en main',
      'Doorloop locatie, meldingen en profiel opnieuw. Je huidige instellingen blijven behouden totdat je iets wijzigt.':'Reparcourez la localisation, les notifications et le profil. Vos réglages actuels restent inchangés jusqu’à ce que vous les modifiiez.',
      'TV & apparaten':'TV et appareils', 'Niet gekoppeld':'Non connecté', 'TV-modus':'Mode TV', 'Open wheaterflow.be/tv op je TV en koppel met de code.':'Ouvrez wheaterflow.be/tv sur votre TV et associez-la avec le code.',
      'TV koppelen':'Associer la TV', 'TV verversen':'Actualiser la TV', 'TV ontkoppelen':'Dissocier la TV', 'Cast laden...':'Chargement de Cast…',
      'TV-koppeling gebruikt je actieve plaats en vernieuwt het TV-scherm zonder extra knoppen op het beginscherm.':'L’association TV utilise votre lieu actif et actualise l’écran TV sans boutons supplémentaires sur l’accueil.',
      'Meldingen':'Notifications', 'Controleren...':'Vérification…', 'Installeer Wheaterflow op je beginscherm om weerwaarschuwingen te ontvangen.':'Installez Wheaterflow sur votre écran d’accueil pour recevoir les alertes météo.',
      'Tik op Deel.':'Touchez Partager.', "Kies 'Zet op beginscherm'.":"Choisissez « Sur l’écran d’accueil ».", 'Open daarna Wheaterflow via het appicoon.':'Ouvrez ensuite Wheaterflow via son icône.', 'Schakel meldingen in via Instellingen.':'Activez les notifications dans Paramètres.',
      'Meldingen inschakelen':'Activer les notifications', 'Testmelding sturen':'Envoyer une notification test', 'Meldingen uitschakelen':'Désactiver les notifications',
      'Ingeschakeld':'Activé', 'Niet ondersteund':'Non pris en charge', 'Geblokkeerd':'Bloqué', 'Toestemming vereist':'Autorisation requise', 'Installeer eerst de app':'Installez d’abord l’application', 'Tijdelijk offline':'Temporairement hors ligne',
      'Code geel':'Code jaune', 'Code oranje':'Code orange', 'Code rood':'Code rouge', 'Regen en onweer':'Pluie et orages', 'Zware regen':'Forte pluie', 'Sneeuw':'Neige', 'Gladheid':'Verglas',
      'Wind en temperatuur':'Vent et température', 'Extreme windstoten':'Rafales extrêmes', 'Hitte':'Chaleur', 'Vorst':'Gel', 'UV & gezondheid':'UV et santé', 'Sterke UV':'UV élevé',
      'Dagelijks en lokaal':'Quotidien et local', 'Regen binnen 30 minuten':'Pluie dans les 30 minutes', 'Dagelijkse ochtendverwachting':'Prévision matinale quotidienne',
      'Neerslag vanaf':'Précipitations à partir de', 'Windstoten vanaf':'Rafales à partir de', 'Hitte vanaf':'Chaleur à partir de', 'Vorst onder':'Gel sous',
      'Vraag toestemming alleen via deze knop. Op iPhone werkt dit na installatie op je beginscherm.':'Demandez l’autorisation uniquement via ce bouton. Sur iPhone, cela fonctionne après installation sur l’écran d’accueil.',
      'Over Wheaterflow':'À propos de Wheaterflow', 'Info':'Info', 'Wheaterflow op Instagram':'Wheaterflow sur Instagram',

      'Helder':'Dégagé', 'Overwegend helder':'Plutôt dégagé', 'Half bewolkt':'Partiellement nuageux', 'Bewolkt':'Nuageux', 'Mist':'Brouillard', 'Rijpmist':'Brouillard givrant',
      'Lichte motregen':'Faible bruine', 'Motregen':'Bruine', 'Dichte motregen':'Bruine dense', 'IJzel (motregen)':'Bruine verglaçante', 'IJzel (dichte motregen)':'Forte bruine verglaçante',
      'Lichte regen':'Pluie faible', 'Regen':'Pluie', 'IJzel (regen)':'Pluie verglaçante', 'IJzel (zware regen)':'Forte pluie verglaçante',
      'Lichte sneeuw':'Faible neige', 'Zware sneeuw':'Forte neige', 'Sneeuwkorrels':'Grésil', 'Lichte buien':'Faibles averses', 'Buien':'Averses', 'Zware buien':'Fortes averses',
      'Sneeuwbuien':'Averses de neige', 'Zware sneeuwbuien':'Fortes averses de neige', 'Onweer':'Orage', 'Onweer met hagel':'Orage avec grêle', 'Zwaar onweer met hagel':'Orage violent avec grêle', 'Onbekend':'Inconnu',
      'Droog':'Sec', 'Het regent nu':'Il pleut maintenant', 'Geen regen':'Pas de pluie', 'Zeer lichte regen':'Pluie très faible', 'Matige regen':'Pluie modérée',
      'INTENSITEIT':'INTENSITÉ', 'DROGER ROND':'PLUS SEC VERS', 'REGEN HOUDT AAN':'LA PLUIE CONTINUE', 'REGEN ROND':'PLUIE VERS', 'GEEN REGEN VERWACHT':'AUCUNE PLUIE PRÉVUE',
      'Langer dan 2 uur':'Plus de 2 heures', 'Komende 2 uur':'2 prochaines heures', 'VERWACHTE REGENINTENSITEIT':'INTENSITÉ DE PLUIE PRÉVUE', 'ZWAAR':'FORTE', 'MATIG':'MODÉRÉE', 'LICHT':'FAIBLE', 'ZEER LICHT':'TRÈS FAIBLE',
      'Geen korte-termijnframes beschikbaar':'Aucune donnée à court terme disponible', 'KANS OP NEERSLAG':'PROBABILITÉ DE PRÉCIPITATIONS', 'NEERSLAG HOEVEELHEID':'QUANTITÉ DE PRÉCIPITATIONS', 'Regengegevens niet beschikbaar':'Données de pluie indisponibles',
      'Geen regen verwacht binnen 2 uur':'Aucune pluie prévue dans les 2 heures', 'Regen later mogelijk':'Pluie possible plus tard',
      'Goed zicht':'Bonne visibilité', 'Beperkt zicht':'Visibilité réduite', 'Vochtigheid':'Humidité', 'Bewolking':'Nébulosité', 'Zicht':'Visibilité',
      'Wind':'Vent', 'Windstoten':'Rafales', 'UV-index':'Indice UV', 'Zonsopgang':'Lever du soleil', 'Zonsondergang':'Coucher du soleil',

      'Buienradar':'Radar de pluie', 'Satelliet':'Satellite', 'Bliksem':'Foudre', 'Volledig scherm':'Plein écran', 'Windinstellingen':'Réglages du vent', 'Snelheid':'Vitesse', 'Dichtheid':'Densité', 'Lengte':'Longueur', 'Dekking':'Couverture',
      'Wheaterflow buienradar':'Radar de pluie Wheaterflow', 'Radar rond België':'Radar autour de la Belgique', 'Licht':'Faible', 'Zwaar':'Fort',
      'Live weer, gezien door jou':'La météo en direct, vue par vous', 'Deel foto':'Partager une photo', 'Waarneming melden':'Signaler une observation', 'Voor jou':'Pour vous', 'In de buurt':'À proximité', 'Zon':'Soleil', 'Alle categorieën':'Toutes les catégories', 'Community laden...':'Chargement de la communauté…', 'Feed':'Fil', 'Kaart':'Carte', 'Meer laden':'Charger plus',
      'Weerfoto delen':'Partager une photo météo', 'Plaatsen':'Publier', 'Weerfoto':'Photo météo', 'Waarneming':'Observation', 'Camera openen of foto kiezen':'Ouvrir l’appareil photo ou choisir une photo', 'Omschrijving':'Description', 'Weersoort':'Type de météo',
      'Locatie delen':'Partager la position', 'Exacte locatie':'Position exacte', 'Geen locatie':'Aucune position', 'Gebruik GPS voor deze upload':'Utiliser le GPS pour cet envoi',
      'Weergegevens worden toegevoegd bij plaatsen.':'Les données météo sont ajoutées lors de la publication.'
    },
    de: {
      'Wheaterflow – live weer, radar en verwachtingen':'Wheaterflow – Live-Wetter, Radar und Vorhersagen',
      'Wheaterflow – live weer voor België':'Wheaterflow – Live-Wetter für Belgien',
      'Wheaterflow is een Belgisch weerplatform voor live weer, regenradar, lokale weersverwachtingen en weerwaarschuwingen.':'Wheaterflow ist eine belgische Wetterplattform für Live-Wetter, Regenradar, lokale Vorhersagen und Wetterwarnungen.',
      'Belgisch weerplatform voor live weer, radar en persoonlijke waarschuwingen':'Belgische Wetterplattform für Live-Wetter, Radar und persönliche Warnungen',
      'Live weer wordt geladen':'Live-Wetter wird geladen',
      'Setup overslaan':'Einrichtung überspringen', 'Welkom':'Willkommen', 'Weer dat met je meebeweegt.':'Wetter, das sich mit dir bewegt.',
      'Live radar, slimme waarschuwingen en lokale verwachtingen in één rustige, persoonlijke app.':'Live-Radar, intelligente Warnungen und lokale Vorhersagen in einer übersichtlichen, persönlichen App.',
      'Slimme':'Intelligente', 'meldingen':'Warnungen', 'Dagelijks':'Täglich', 'overzicht':'Übersicht', 'Begin':'Starten',
      'Jouw locatie':'Dein Standort', 'Hyperlokaal vanaf het eerste moment.':'Vom ersten Moment an hyperlokal.',
      'Sta locatie toe om je huidige weer, regen-ETA, radar en waarschuwingen automatisch voor de juiste plek te tonen.':'Erlaube den Standortzugriff, damit aktuelles Wetter, Regen-ETA, Radar und Warnungen automatisch für den richtigen Ort angezeigt werden.',
      'Locatie':'Standort', 'Nog niet ingesteld':'Noch nicht eingerichtet', 'Later instellen':'Später einrichten', 'Sta locatie toe':'Standort erlauben',
      'Blijf op de hoogte':'Bleib informiert', 'Alleen meldingen die ertoe doen.':'Nur Warnungen, die wichtig sind.',
      'Krijg een seintje bij naderende regen, onweer en officiële waarschuwingen. Je kunt alles later per type aanpassen.':'Erhalte Hinweise bei heranziehendem Regen, Gewitter und offiziellen Warnungen. Später kannst du jeden Typ einzeln anpassen.',
      'Regen op komst':'Regen im Anmarsch', 'Bui bereikt je locatie over ongeveer 20 min.':'Ein Schauer erreicht deinen Standort in etwa 20 Min.', 'Onweer in de buurt':'Gewitter in der Nähe',
      'Actieve onweerscel nadert jouw regio.':'Eine aktive Gewitterzelle nähert sich deiner Region.', 'Officiële waarschuwingen':'Offizielle Warnungen', 'Belangrijke weerwaarschuwingen voor jouw regio.':'Wichtige Wetterwarnungen für deine Region.',
      'Waarschuw wanneer een bui nadert.':'Warnen, wenn ein Schauer naht.', 'Onweer of bliksem in jouw buurt.':'Gewitter oder Blitze in deiner Nähe.', 'Code geel, oranje en rood.':'Warnstufen Gelb, Orange und Rot.',
      'Dagelijks weeroverzicht':'Täglicher Wetterüberblick', 'Een korte ochtendverwachting.':'Eine kurze Morgenvorhersage.', 'Schakel meldingen in':'Benachrichtigungen aktivieren',
      'Als echte app':'Wie eine echte App', 'Zet Wheaterflow op je beginscherm.':'Wheaterflow zum Home-Bildschirm hinzufügen.',
      'Open Wheaterflow zonder browserbalk en krijg de beste ervaring voor radar, meldingen en je locaties.':'Öffne Wheaterflow ohne Browserleiste für die beste Erfahrung mit Radar, Benachrichtigungen und deinen Orten.',
      'Tik op Delen':'Auf Teilen tippen', 'Onderaan in Safari.':'Unten in Safari.', 'Zet op beginscherm':'Zum Home-Bildschirm', 'Kies deze optie in het deelmenu.':'Wähle diese Option im Teilen-Menü.',
      'Tik op Voeg toe':'Auf Hinzufügen tippen', 'Daarna opent Wheaterflow als app.':'Danach öffnet sich Wheaterflow als App.', 'Begrepen':'Verstanden',
      'Maak het persoonlijk':'Mach es persönlich', 'Je Wheaterflow, op elk toestel.':'Dein Wheaterflow auf jedem Gerät.',
      'Met een gratis profiel bewaar je thuislocatie, favorieten, eenheden, meldingsvoorkeuren en weermodelkeuze.':'Mit einem kostenlosen Profil speicherst du Heimatort, Favoriten, Einheiten, Benachrichtigungseinstellungen und Wettermodell.',
      'Jouw profiel':'Dein Profil', 'Favorieten, voorkeuren en meldingen bewaren':'Favoriten, Einstellungen und Benachrichtigungen speichern', 'Optioneel':'Optional', 'Maak profiel':'Profil erstellen',
      'Klaar':'Fertig', 'Wheaterflow is ingesteld.':'Wheaterflow ist eingerichtet.', 'Vanaf nu opent de app direct op je weer. Alles wat je net koos kun je later wijzigen via Profiel en Instellingen.':'Ab jetzt öffnet die App direkt dein Wetter. Alles Gewählte kannst du später unter Profil und Einstellungen ändern.',
      'Niet ingesteld':'Nicht eingerichtet', 'Start Wheaterflow':'Wheaterflow starten',

      'Vandaag':'Heute', 'Voorspelling':'Vorhersage', 'Radar':'Radar', 'Community':'Community', 'Profiel':'Profil', 'Instellingen':'Einstellungen', 'Sluiten':'Schließen', 'Terug':'Zurück', 'Vorige':'Zurück', 'Volgende':'Weiter', 'Nu':'Jetzt',
      'Mijn locatie':'Mein Standort', 'MIJN LOCATIE':'MEIN STANDORT', 'Huidige locatie':'Aktueller Standort', 'Huidige GPS-locatie geladen':'Aktueller GPS-Standort geladen', 'Locatie bepalen...':'Standort wird ermittelt…', 'Locatie bepalen…':'Standort wird ermittelt…', 'Plaats kiezen':'Ort wählen', 'Zoek een plaats...':'Ort suchen…',
      'Zojuist bijgewerkt':'Gerade aktualisiert', 'Weer laden...':'Wetter wird geladen…', 'Weer laden…':'Wetter wird geladen…', 'Gegevens worden geladen…':'Daten werden geladen…', 'Momenteel geen gegevens beschikbaar':'Derzeit keine Daten verfügbar', 'Opnieuw proberen':'Erneut versuchen', 'Radargegevens tijdelijk niet beschikbaar':'Radardaten vorübergehend nicht verfügbar',
      'Komende 24 uur':'Nächste 24 Stunden', '7-daagse verwachting':'7-Tage-Vorhersage', 'Bekijk alle 14 dagen':'Alle 14 Tage anzeigen', 'Jouw weer vandaag':'Dein Wetter heute', 'Actuele weersinformatie voor jouw locatie.':'Aktuelle Wetterinformationen für deinen Standort.',
      'Favoriete locaties':'Favoriten', 'Weermeldingen':'Wetterwarnungen', 'Weervoorkeuren':'Wettereinstellungen', 'Binnenkort beschikbaar':'Demnächst verfügbar', 'In de maak':'In Arbeit', 'Persoonlijke gegevens':'Persönliche Daten', 'Thuislocatie':'Heimatort', 'Actuele gps-locatie gebruiken':'Aktuellen GPS-Standort verwenden', 'Wijzigingen opslaan':'Änderungen speichern', 'Op je account':'In deinem Konto', '+ Huidige locatie':'+ Aktueller Standort',
      'ACCOUNTBEHEER':'KONTOVERWALTUNG', 'Lokale gegevens naar account kopiëren':'Lokale Daten ins Konto kopieren', 'Wachtwoord wijzigen':'Passwort ändern', 'Uitloggen':'Abmelden', 'GEVAARLIJKE ACTIES':'KRITISCHE AKTIONEN', 'Account verwijderen':'Konto löschen', 'Bewerk profiel':'Profil bearbeiten', 'Profiel laden...':'Profil wird geladen…',
      'Synchroniseer favorieten, instellingen en meldingen.':'Favoriten, Einstellungen und Benachrichtigungen synchronisieren.', 'Inloggen':'Anmelden', 'Account aanmaken':'Konto erstellen', 'E-mailadres':'E-Mail-Adresse', 'Wachtwoord':'Passwort', 'Wachtwoord tonen':'Passwort anzeigen', 'Wachtwoord vergeten?':'Passwort vergessen?', 'Weergavenaam':'Anzeigename', 'Wachtwoord herhalen':'Passwort wiederholen', 'Ik ga akkoord met de privacyvoorwaarden.':'Ich stimme den Datenschutzbedingungen zu.', 'Doorgaan als gast':'Als Gast fortfahren', 'Privacy in het kort':'Datenschutz kurz erklärt',

      'Taal':'Sprache', 'App-taal':'App-Sprache', 'Taal & regio':'Sprache & Region', 'Kies de taal van Wheaterflow. De wijziging wordt direct toegepast en op je account bewaard.':'Wähle die Sprache von Wheaterflow. Die Änderung wird sofort angewendet und in deinem Konto gespeichert.',
      'Eenheden':'Einheiten', 'Weergave':'Anzeige', 'Temperatuur':'Temperatur', 'Windsnelheid':'Windgeschwindigkeit', 'Neerslag':'Niederschlag', 'Luchtdruk':'Luftdruck', 'Model':'Modell', 'Vooruitzicht':'Zeitraum', '7 dagen':'7 Tage', '14 dagen':'14 Tage', 'Weermodel':'Wettermodell', 'Automatisch':'Automatisch', 'actief':'aktiv',
      'Data':'Daten', 'Actueel':'Aktuell', 'Nu verversen':'Jetzt aktualisieren', 'Laatste update staat op het beginscherm bij je actuele weer.':'Die letzte Aktualisierung steht auf dem Startbildschirm bei deinem aktuellen Wetter.', 'Wheaterflow setup':'Wheaterflow-Einrichtung', 'Onboarding':'Einführung', 'Onboarding opnieuw bekijken':'Einführung erneut ansehen', 'Doorloop locatie, meldingen en profiel opnieuw. Je huidige instellingen blijven behouden totdat je iets wijzigt.':'Durchlaufe Standort, Benachrichtigungen und Profil erneut. Deine aktuellen Einstellungen bleiben erhalten, bis du etwas änderst.',
      'TV & apparaten':'TV & Geräte', 'Niet gekoppeld':'Nicht verbunden', 'TV-modus':'TV-Modus', 'Open wheaterflow.be/tv op je TV en koppel met de code.':'Öffne wheaterflow.be/tv auf deinem TV und verbinde ihn mit dem Code.', 'TV koppelen':'TV verbinden', 'TV verversen':'TV aktualisieren', 'TV ontkoppelen':'TV trennen', 'Cast laden...':'Cast wird geladen…', 'TV-koppeling gebruikt je actieve plaats en vernieuwt het TV-scherm zonder extra knoppen op het beginscherm.':'Die TV-Verbindung verwendet deinen aktiven Ort und aktualisiert den TV-Bildschirm ohne zusätzliche Schaltflächen auf der Startseite.',
      'Meldingen':'Benachrichtigungen', 'Controleren...':'Wird geprüft…', 'Installeer Wheaterflow op je beginscherm om weerwaarschuwingen te ontvangen.':'Installiere Wheaterflow auf deinem Home-Bildschirm, um Wetterwarnungen zu erhalten.', 'Tik op Deel.':'Tippe auf Teilen.', "Kies 'Zet op beginscherm'.":"Wähle „Zum Home-Bildschirm“.", 'Open daarna Wheaterflow via het appicoon.':'Öffne Wheaterflow danach über das App-Symbol.', 'Schakel meldingen in via Instellingen.':'Aktiviere Benachrichtigungen in den Einstellungen.',
      'Meldingen inschakelen':'Benachrichtigungen aktivieren', 'Testmelding sturen':'Testbenachrichtigung senden', 'Meldingen uitschakelen':'Benachrichtigungen deaktivieren', 'Ingeschakeld':'Aktiviert', 'Niet ondersteund':'Nicht unterstützt', 'Geblokkeerd':'Blockiert', 'Toestemming vereist':'Berechtigung erforderlich', 'Installeer eerst de app':'App zuerst installieren', 'Tijdelijk offline':'Vorübergehend offline',
      'Code geel':'Warnstufe Gelb', 'Code oranje':'Warnstufe Orange', 'Code rood':'Warnstufe Rot', 'Regen en onweer':'Regen & Gewitter', 'Zware regen':'Starker Regen', 'Sneeuw':'Schnee', 'Gladheid':'Glätte', 'Wind en temperatuur':'Wind & Temperatur', 'Extreme windstoten':'Extreme Windböen', 'Hitte':'Hitze', 'Vorst':'Frost', 'UV & gezondheid':'UV & Gesundheit', 'Sterke UV':'Starke UV-Strahlung', 'Dagelijks en lokaal':'Täglich & lokal', 'Regen binnen 30 minuten':'Regen innerhalb von 30 Minuten', 'Dagelijkse ochtendverwachting':'Tägliche Morgenvorhersage',
      'Neerslag vanaf':'Niederschlag ab', 'Windstoten vanaf':'Windböen ab', 'Hitte vanaf':'Hitze ab', 'Vorst onder':'Frost unter', 'Vraag toestemming alleen via deze knop. Op iPhone werkt dit na installatie op je beginscherm.':'Fordere die Berechtigung nur über diese Schaltfläche an. Auf dem iPhone funktioniert dies nach der Installation auf dem Home-Bildschirm.', 'Over Wheaterflow':'Über Wheaterflow', 'Info':'Info', 'Wheaterflow op Instagram':'Wheaterflow auf Instagram',

      'Helder':'Klar', 'Overwegend helder':'Überwiegend klar', 'Half bewolkt':'Teilweise bewölkt', 'Bewolkt':'Bewölkt', 'Mist':'Nebel', 'Rijpmist':'Eisnebel', 'Lichte motregen':'Leichter Nieselregen', 'Motregen':'Nieselregen', 'Dichte motregen':'Dichter Nieselregen', 'IJzel (motregen)':'Gefrierender Nieselregen', 'IJzel (dichte motregen)':'Starker gefrierender Nieselregen', 'Lichte regen':'Leichter Regen', 'Regen':'Regen', 'IJzel (regen)':'Gefrierender Regen', 'IJzel (zware regen)':'Starker gefrierender Regen', 'Lichte sneeuw':'Leichter Schneefall', 'Zware sneeuw':'Starker Schneefall', 'Sneeuwkorrels':'Schneegriesel', 'Lichte buien':'Leichte Schauer', 'Buien':'Schauer', 'Zware buien':'Starke Schauer', 'Sneeuwbuien':'Schneeschauer', 'Zware sneeuwbuien':'Starke Schneeschauer', 'Onweer':'Gewitter', 'Onweer met hagel':'Gewitter mit Hagel', 'Zwaar onweer met hagel':'Starkes Gewitter mit Hagel', 'Onbekend':'Unbekannt',
      'Droog':'Trocken', 'Het regent nu':'Es regnet jetzt', 'Geen regen':'Kein Regen', 'Zeer lichte regen':'Sehr leichter Regen', 'Matige regen':'Mäßiger Regen', 'INTENSITEIT':'INTENSITÄT', 'DROGER ROND':'TROCKENER GEGEN', 'REGEN HOUDT AAN':'REGEN HÄLT AN', 'REGEN ROND':'REGEN GEGEN', 'GEEN REGEN VERWACHT':'KEIN REGEN ERWARTET', 'Langer dan 2 uur':'Länger als 2 Stunden', 'Komende 2 uur':'Nächste 2 Stunden', 'VERWACHTE REGENINTENSITEIT':'ERWARTETE REGENINTENSITÄT', 'ZWAAR':'STARK', 'MATIG':'MÄSSIG', 'LICHT':'LEICHT', 'ZEER LICHT':'SEHR LEICHT', 'Geen korte-termijnframes beschikbaar':'Keine Kurzzeitdaten verfügbar', 'KANS OP NEERSLAG':'NIEDERSCHLAGSWAHRSCHEINLICHKEIT', 'NEERSLAG HOEVEELHEID':'NIEDERSCHLAGSMENGE', 'Regengegevens niet beschikbaar':'Regendaten nicht verfügbar', 'Geen regen verwacht binnen 2 uur':'In den nächsten 2 Stunden kein Regen erwartet', 'Regen later mogelijk':'Später Regen möglich',
      'Goed zicht':'Gute Sicht', 'Beperkt zicht':'Eingeschränkte Sicht', 'Vochtigheid':'Luftfeuchtigkeit', 'Bewolking':'Bewölkung', 'Zicht':'Sicht', 'Wind':'Wind', 'Windstoten':'Windböen', 'UV-index':'UV-Index', 'Zonsopgang':'Sonnenaufgang', 'Zonsondergang':'Sonnenuntergang',

      'Buienradar':'Regenradar', 'Satelliet':'Satellit', 'Bliksem':'Blitze', 'Volledig scherm':'Vollbild', 'Windinstellingen':'Windeinstellungen', 'Snelheid':'Geschwindigkeit', 'Dichtheid':'Dichte', 'Lengte':'Länge', 'Dekking':'Abdeckung', 'Wheaterflow buienradar':'Wheaterflow Regenradar', 'Radar rond België':'Radar über Belgien', 'Licht':'Leicht', 'Zwaar':'Stark',
      'Live weer, gezien door jou':'Live-Wetter, von dir gesehen', 'Deel foto':'Foto teilen', 'Waarneming melden':'Beobachtung melden', 'Voor jou':'Für dich', 'In de buurt':'In der Nähe', 'Zon':'Sonne', 'Alle categorieën':'Alle Kategorien', 'Community laden...':'Community wird geladen…', 'Feed':'Feed', 'Kaart':'Karte', 'Meer laden':'Mehr laden', 'Weerfoto delen':'Wetterfoto teilen', 'Plaatsen':'Veröffentlichen', 'Weerfoto':'Wetterfoto', 'Waarneming':'Beobachtung', 'Camera openen of foto kiezen':'Kamera öffnen oder Foto auswählen', 'Omschrijving':'Beschreibung', 'Weersoort':'Wetterart', 'Locatie delen':'Standort teilen', 'Exacte locatie':'Genauer Standort', 'Geen locatie':'Kein Standort', 'Gebruik GPS voor deze upload':'GPS für diesen Upload verwenden', 'Weergegevens worden toegevoegd bij plaatsen.':'Wetterdaten werden beim Veröffentlichen hinzugefügt.'
    },
    en: {
      'Wheaterflow – live weer, radar en verwachtingen':'Wheaterflow – live weather, radar and forecasts',
      'Wheaterflow – live weer voor België':'Wheaterflow – live weather for Belgium',
      'Wheaterflow is een Belgisch weerplatform voor live weer, regenradar, lokale weersverwachtingen en weerwaarschuwingen.':'Wheaterflow is a Belgian weather platform for live weather, rain radar, local forecasts and weather alerts.',
      'Belgisch weerplatform voor live weer, radar en persoonlijke waarschuwingen':'Belgian weather platform for live weather, radar and personalised alerts',
      'Live weer wordt geladen':'Loading live weather', 'Setup overslaan':'Skip setup', 'Welkom':'Welcome', 'Weer dat met je meebeweegt.':'Weather that moves with you.',
      'Live radar, slimme waarschuwingen en lokale verwachtingen in één rustige, persoonlijke app.':'Live radar, smart alerts and local forecasts in one calm, personalised app.', 'Slimme':'Smart', 'meldingen':'alerts', 'Dagelijks':'Daily', 'overzicht':'overview', 'Begin':'Get started',
      'Jouw locatie':'Your location', 'Hyperlokaal vanaf het eerste moment.':'Hyperlocal from the very first moment.', 'Sta locatie toe om je huidige weer, regen-ETA, radar en waarschuwingen automatisch voor de juiste plek te tonen.':'Allow location access to automatically show current weather, rain ETA, radar and alerts for the right place.', 'Locatie':'Location', 'Nog niet ingesteld':'Not set up yet', 'Later instellen':'Set up later', 'Sta locatie toe':'Allow location',
      'Blijf op de hoogte':'Stay informed', 'Alleen meldingen die ertoe doen.':'Only alerts that matter.', 'Krijg een seintje bij naderende regen, onweer en officiële waarschuwingen. Je kunt alles later per type aanpassen.':'Get notified about approaching rain, thunderstorms and official warnings. You can customise each type later.', 'Regen op komst':'Rain approaching', 'Bui bereikt je locatie over ongeveer 20 min.':'A shower will reach your location in about 20 min.', 'Onweer in de buurt':'Thunderstorm nearby', 'Actieve onweerscel nadert jouw regio.':'An active thunderstorm cell is approaching your area.', 'Officiële waarschuwingen':'Official warnings', 'Belangrijke weerwaarschuwingen voor jouw regio.':'Important weather warnings for your area.', 'Waarschuw wanneer een bui nadert.':'Alert when a shower approaches.', 'Onweer of bliksem in jouw buurt.':'Thunder or lightning near you.', 'Code geel, oranje en rood.':'Yellow, orange and red warnings.', 'Dagelijks weeroverzicht':'Daily weather overview', 'Een korte ochtendverwachting.':'A short morning forecast.',
      'Schakel meldingen in':'Enable notifications', 'Als echte app':'As a real app', 'Zet Wheaterflow op je beginscherm.':'Add Wheaterflow to your Home Screen.', 'Open Wheaterflow zonder browserbalk en krijg de beste ervaring voor radar, meldingen en je locaties.':'Open Wheaterflow without the browser bar for the best experience with radar, notifications and your locations.', 'Tik op Delen':'Tap Share', 'Onderaan in Safari.':'At the bottom in Safari.', 'Zet op beginscherm':'Add to Home Screen', 'Kies deze optie in het deelmenu.':'Choose this option in the share menu.', 'Tik op Voeg toe':'Tap Add', 'Daarna opent Wheaterflow als app.':'Wheaterflow will then open as an app.', 'Begrepen':'Got it', 'Maak het persoonlijk':'Make it personal', 'Je Wheaterflow, op elk toestel.':'Your Wheaterflow, on every device.', 'Met een gratis profiel bewaar je thuislocatie, favorieten, eenheden, meldingsvoorkeuren en weermodelkeuze.':'With a free profile you can save your home location, favourites, units, notification preferences and weather model choice.', 'Jouw profiel':'Your profile', 'Favorieten, voorkeuren en meldingen bewaren':'Save favourites, preferences and notifications', 'Optioneel':'Optional', 'Maak profiel':'Create profile', 'Klaar':'Done', 'Wheaterflow is ingesteld.':'Wheaterflow is set up.', 'Vanaf nu opent de app direct op je weer. Alles wat je net koos kun je later wijzigen via Profiel en Instellingen.':'From now on the app opens directly to your weather. You can change everything later in Profile and Settings.', 'Niet ingesteld':'Not set', 'Start Wheaterflow':'Start Wheaterflow',

      'Vandaag':'Today', 'Voorspelling':'Forecast', 'Radar':'Radar', 'Community':'Community', 'Profiel':'Profile', 'Instellingen':'Settings', 'Sluiten':'Close', 'Terug':'Back', 'Vorige':'Previous', 'Volgende':'Next', 'Nu':'Now',
      'Mijn locatie':'My location', 'MIJN LOCATIE':'MY LOCATION', 'Huidige locatie':'Current location', 'Huidige GPS-locatie geladen':'Current GPS location loaded', 'Locatie bepalen...':'Determining location…', 'Locatie bepalen…':'Determining location…', 'Plaats kiezen':'Choose a place', 'Zoek een plaats...':'Search for a place…', 'Zojuist bijgewerkt':'Just updated', 'Weer laden...':'Loading weather…', 'Weer laden…':'Loading weather…', 'Gegevens worden geladen…':'Loading data…', 'Momenteel geen gegevens beschikbaar':'No data available right now', 'Opnieuw proberen':'Try again', 'Radargegevens tijdelijk niet beschikbaar':'Radar data temporarily unavailable', 'Komende 24 uur':'Next 24 hours', '7-daagse verwachting':'7-day forecast', 'Bekijk alle 14 dagen':'View all 14 days',
      'Jouw weer vandaag':'Your weather today', 'Actuele weersinformatie voor jouw locatie.':'Current weather information for your location.', 'Favoriete locaties':'Favourite locations', 'Weermeldingen':'Weather alerts', 'Weervoorkeuren':'Weather preferences', 'Binnenkort beschikbaar':'Coming soon', 'In de maak':'In development', 'Persoonlijke gegevens':'Personal details', 'Thuislocatie':'Home location', 'Actuele gps-locatie gebruiken':'Use current GPS location', 'Wijzigingen opslaan':'Save changes', 'Op je account':'On your account', '+ Huidige locatie':'+ Current location', 'ACCOUNTBEHEER':'ACCOUNT MANAGEMENT', 'Lokale gegevens naar account kopiëren':'Copy local data to account', 'Wachtwoord wijzigen':'Change password', 'Uitloggen':'Sign out', 'GEVAARLIJKE ACTIES':'DANGEROUS ACTIONS', 'Account verwijderen':'Delete account', 'Bewerk profiel':'Edit profile', 'Profiel laden...':'Loading profile…', 'Synchroniseer favorieten, instellingen en meldingen.':'Sync favourites, settings and notifications.', 'Inloggen':'Sign in', 'Account aanmaken':'Create account', 'E-mailadres':'Email address', 'Wachtwoord':'Password', 'Wachtwoord tonen':'Show password', 'Wachtwoord vergeten?':'Forgot password?', 'Weergavenaam':'Display name', 'Wachtwoord herhalen':'Repeat password', 'Ik ga akkoord met de privacyvoorwaarden.':'I agree to the privacy terms.', 'Doorgaan als gast':'Continue as guest', 'Privacy in het kort':'Privacy at a glance',

      'Taal':'Language', 'App-taal':'App language', 'Taal & regio':'Language & region', 'Kies de taal van Wheaterflow. De wijziging wordt direct toegepast en op je account bewaard.':'Choose the language for Wheaterflow. The change is applied immediately and saved to your account.',
      'Eenheden':'Units', 'Weergave':'Display', 'Temperatuur':'Temperature', 'Windsnelheid':'Wind speed', 'Neerslag':'Precipitation', 'Luchtdruk':'Air pressure', 'Model':'Model', 'Vooruitzicht':'Forecast range', '7 dagen':'7 days', '14 dagen':'14 days', 'Weermodel':'Weather model', 'Automatisch':'Automatic', 'actief':'active', 'Data':'Data', 'Actueel':'Current', 'Nu verversen':'Refresh now', 'Laatste update staat op het beginscherm bij je actuele weer.':'The latest update is shown on the Home screen with your current weather.', 'Wheaterflow setup':'Wheaterflow setup', 'Onboarding':'Onboarding', 'Onboarding opnieuw bekijken':'View onboarding again', 'Doorloop locatie, meldingen en profiel opnieuw. Je huidige instellingen blijven behouden totdat je iets wijzigt.':'Go through location, notifications and profile again. Your current settings remain until you change something.',
      'TV & apparaten':'TV & devices', 'Niet gekoppeld':'Not connected', 'TV-modus':'TV mode', 'Open wheaterflow.be/tv op je TV en koppel met de code.':'Open wheaterflow.be/tv on your TV and pair it with the code.', 'TV koppelen':'Pair TV', 'TV verversen':'Refresh TV', 'TV ontkoppelen':'Disconnect TV', 'Cast laden...':'Loading Cast…', 'TV-koppeling gebruikt je actieve plaats en vernieuwt het TV-scherm zonder extra knoppen op het beginscherm.':'TV pairing uses your active location and refreshes the TV screen without extra controls on Home.',
      'Meldingen':'Notifications', 'Controleren...':'Checking…', 'Installeer Wheaterflow op je beginscherm om weerwaarschuwingen te ontvangen.':'Install Wheaterflow on your Home Screen to receive weather alerts.', 'Tik op Deel.':'Tap Share.', "Kies 'Zet op beginscherm'.":"Choose 'Add to Home Screen'.", 'Open daarna Wheaterflow via het appicoon.':'Then open Wheaterflow from the app icon.', 'Schakel meldingen in via Instellingen.':'Enable notifications in Settings.', 'Meldingen inschakelen':'Enable notifications', 'Testmelding sturen':'Send test notification', 'Meldingen uitschakelen':'Disable notifications', 'Ingeschakeld':'Enabled', 'Niet ondersteund':'Not supported', 'Geblokkeerd':'Blocked', 'Toestemming vereist':'Permission required', 'Installeer eerst de app':'Install the app first', 'Tijdelijk offline':'Temporarily offline',
      'Code geel':'Yellow warning', 'Code oranje':'Orange warning', 'Code rood':'Red warning', 'Regen en onweer':'Rain & thunderstorms', 'Zware regen':'Heavy rain', 'Sneeuw':'Snow', 'Gladheid':'Ice', 'Wind en temperatuur':'Wind & temperature', 'Extreme windstoten':'Extreme wind gusts', 'Hitte':'Heat', 'Vorst':'Frost', 'UV & gezondheid':'UV & health', 'Sterke UV':'High UV', 'Dagelijks en lokaal':'Daily & local', 'Regen binnen 30 minuten':'Rain within 30 minutes', 'Dagelijkse ochtendverwachting':'Daily morning forecast', 'Neerslag vanaf':'Precipitation from', 'Windstoten vanaf':'Wind gusts from', 'Hitte vanaf':'Heat from', 'Vorst onder':'Frost below', 'Vraag toestemming alleen via deze knop. Op iPhone werkt dit na installatie op je beginscherm.':'Only request permission using this button. On iPhone this works after installing to the Home Screen.', 'Over Wheaterflow':'About Wheaterflow', 'Info':'Info', 'Wheaterflow op Instagram':'Wheaterflow on Instagram',

      'Helder':'Clear', 'Overwegend helder':'Mostly clear', 'Half bewolkt':'Partly cloudy', 'Bewolkt':'Cloudy', 'Mist':'Fog', 'Rijpmist':'Rime fog', 'Lichte motregen':'Light drizzle', 'Motregen':'Drizzle', 'Dichte motregen':'Dense drizzle', 'IJzel (motregen)':'Freezing drizzle', 'IJzel (dichte motregen)':'Heavy freezing drizzle', 'Lichte regen':'Light rain', 'Regen':'Rain', 'IJzel (regen)':'Freezing rain', 'IJzel (zware regen)':'Heavy freezing rain', 'Lichte sneeuw':'Light snow', 'Zware sneeuw':'Heavy snow', 'Sneeuwkorrels':'Snow grains', 'Lichte buien':'Light showers', 'Buien':'Showers', 'Zware buien':'Heavy showers', 'Sneeuwbuien':'Snow showers', 'Zware sneeuwbuien':'Heavy snow showers', 'Onweer':'Thunderstorm', 'Onweer met hagel':'Thunderstorm with hail', 'Zwaar onweer met hagel':'Severe thunderstorm with hail', 'Onbekend':'Unknown',
      'Droog':'Dry', 'Het regent nu':'It is raining now', 'Geen regen':'No rain', 'Zeer lichte regen':'Very light rain', 'Matige regen':'Moderate rain', 'INTENSITEIT':'INTENSITY', 'DROGER ROND':'DRIER AROUND', 'REGEN HOUDT AAN':'RAIN CONTINUES', 'REGEN ROND':'RAIN AROUND', 'GEEN REGEN VERWACHT':'NO RAIN EXPECTED', 'Langer dan 2 uur':'Longer than 2 hours', 'Komende 2 uur':'Next 2 hours', 'VERWACHTE REGENINTENSITEIT':'EXPECTED RAIN INTENSITY', 'ZWAAR':'HEAVY', 'MATIG':'MODERATE', 'LICHT':'LIGHT', 'ZEER LICHT':'VERY LIGHT', 'Geen korte-termijnframes beschikbaar':'No short-term frames available', 'KANS OP NEERSLAG':'CHANCE OF PRECIPITATION', 'NEERSLAG HOEVEELHEID':'PRECIPITATION AMOUNT', 'Regengegevens niet beschikbaar':'Rain data unavailable', 'Geen regen verwacht binnen 2 uur':'No rain expected within 2 hours', 'Regen later mogelijk':'Rain possible later',
      'Goed zicht':'Good visibility', 'Beperkt zicht':'Reduced visibility', 'Vochtigheid':'Humidity', 'Bewolking':'Cloud cover', 'Zicht':'Visibility', 'Wind':'Wind', 'Windstoten':'Wind gusts', 'UV-index':'UV index', 'Zonsopgang':'Sunrise', 'Zonsondergang':'Sunset',

      'Buienradar':'Rain radar', 'Satelliet':'Satellite', 'Bliksem':'Lightning', 'Volledig scherm':'Full screen', 'Windinstellingen':'Wind settings', 'Snelheid':'Speed', 'Dichtheid':'Density', 'Lengte':'Length', 'Dekking':'Coverage', 'Wheaterflow buienradar':'Wheaterflow rain radar', 'Radar rond België':'Radar around Belgium', 'Licht':'Light', 'Zwaar':'Heavy',
      'Live weer, gezien door jou':'Live weather, seen by you', 'Deel foto':'Share photo', 'Waarneming melden':'Report observation', 'Voor jou':'For you', 'In de buurt':'Nearby', 'Zon':'Sun', 'Alle categorieën':'All categories', 'Community laden...':'Loading community…', 'Feed':'Feed', 'Kaart':'Map', 'Meer laden':'Load more', 'Weerfoto delen':'Share weather photo', 'Plaatsen':'Post', 'Weerfoto':'Weather photo', 'Waarneming':'Observation', 'Camera openen of foto kiezen':'Open camera or choose a photo', 'Omschrijving':'Description', 'Weersoort':'Weather type', 'Locatie delen':'Share location', 'Exacte locatie':'Exact location', 'Geen locatie':'No location', 'Gebruik GPS voor deze upload':'Use GPS for this upload', 'Weergegevens worden toegevoegd bij plaatsen.':'Weather data is added when posting.'
    }
  };

  const textState = new WeakMap();
  const attrState = new WeakMap();
  let mutating = false;

  function languageCode(value){ return String(value || '').toLowerCase().split('-')[0]; }
  function normaliseLanguage(value){
    const code = languageCode(value);
    return SUPPORTED.includes(code) ? code : 'nl';
  }

  function initialLanguage(){
    try{
      const stored = localStorage.getItem(STORAGE_KEY);
      if(stored && SUPPORTED.includes(normaliseLanguage(stored))) return normaliseLanguage(stored);
    }catch(e){}
    return normaliseLanguage(navigator.language || 'nl');
  }

  let language = initialLanguage();

  function locale(lang=language){ return LOCALES[normaliseLanguage(lang)] || LOCALES.nl; }
  function languageName(lang=language){ return LANGUAGE_NAMES[normaliseLanguage(lang)] || LANGUAGE_NAMES.nl; }
  function isSupported(lang){ return SUPPORTED.includes(languageCode(lang)); }

  function dynamicTranslate(source, lang){
    if(lang === 'nl') return source;
    const rules = {
      fr: [
        [/^Voelt als (.+)$/,'Ressenti $1'],
        [/^Kans (\d+)%$/,'Probabilité $1 %'],
        [/^Dauwpunt (.+)$/,'Point de rosée $1'],
        [/^stoten (.+)$/,'rafales $1'],
        [/^Rond (.+)$/,'Vers $1'],
        [/^Huidige locatie: (.+)$/,'Position actuelle : $1'],
        [/^Locatie gevonden: (.+) ✓$/,'Position trouvée : $1 ✓'],
        [/^Kustwaarschuwingen · (.+)$/,'Alertes côtières · $1'],
        [/^(\d+) min geleden$/,'il y a $1 min'],
        [/^De regen houdt waarschijnlijk nog ongeveer (\d+) minuten aan; daarna wordt het tijdelijk droger\.$/,'La pluie devrait encore durer environ $1 minutes ; le temps deviendra ensuite temporairement plus sec.'],
        [/^Vanaf ongeveer (.+) neemt de kans op regen duidelijk toe\.$/,'À partir d’environ $1, le risque de pluie augmente nettement.'],
        [/^De temperatuur zakt de komende uren richting (.+)\.$/,'La température baissera dans les prochaines heures vers $1.'],
        [/^De temperatuur loopt de komende uren op richting (.+)\.$/,'La température montera dans les prochaines heures vers $1.'],
        [/^Houd rekening met windstoten tot ongeveer (.+)\.$/,'Prévoyez des rafales pouvant atteindre environ $1.'],
        [/^Geen regen verwacht binnen 2 uur · (.+)$/,'Aucune pluie prévue dans les 2 heures · $1'],
        [/^Details voor (.+)$/,'Détails pour $1']
      ],
      de: [
        [/^Voelt als (.+)$/,'Gefühlt $1'], [/^Kans (\d+)%$/,'Wahrscheinlichkeit $1 %'], [/^Dauwpunt (.+)$/,'Taupunkt $1'], [/^stoten (.+)$/,'Böen $1'], [/^Rond (.+)$/,'Gegen $1'],
        [/^Huidige locatie: (.+)$/,'Aktueller Standort: $1'], [/^Locatie gevonden: (.+) ✓$/,'Standort gefunden: $1 ✓'], [/^Kustwaarschuwingen · (.+)$/,'Küstenwarnungen · $1'], [/^(\d+) min geleden$/,'vor $1 Min.'],
        [/^De regen houdt waarschijnlijk nog ongeveer (\d+) minuten aan; daarna wordt het tijdelijk droger\.$/,'Der Regen hält voraussichtlich noch etwa $1 Minuten an; danach wird es vorübergehend trockener.'],
        [/^Vanaf ongeveer (.+) neemt de kans op regen duidelijk toe\.$/,'Ab etwa $1 steigt die Regenwahrscheinlichkeit deutlich an.'], [/^De temperatuur zakt de komende uren richting (.+)\.$/,'Die Temperatur sinkt in den nächsten Stunden auf etwa $1.'], [/^De temperatuur loopt de komende uren op richting (.+)\.$/,'Die Temperatur steigt in den nächsten Stunden auf etwa $1.'], [/^Houd rekening met windstoten tot ongeveer (.+)\.$/,'Rechne mit Windböen bis etwa $1.'], [/^Geen regen verwacht binnen 2 uur · (.+)$/,'In den nächsten 2 Stunden kein Regen erwartet · $1'], [/^Details voor (.+)$/,'Details für $1']
      ],
      en: [
        [/^Voelt als (.+)$/,'Feels like $1'], [/^Kans (\d+)%$/,'Chance $1%'], [/^Dauwpunt (.+)$/,'Dew point $1'], [/^stoten (.+)$/,'gusts $1'], [/^Rond (.+)$/,'Around $1'],
        [/^Huidige locatie: (.+)$/,'Current location: $1'], [/^Locatie gevonden: (.+) ✓$/,'Location found: $1 ✓'], [/^Kustwaarschuwingen · (.+)$/,'Coastal alerts · $1'], [/^(\d+) min geleden$/,'$1 min ago'],
        [/^De regen houdt waarschijnlijk nog ongeveer (\d+) minuten aan; daarna wordt het tijdelijk droger\.$/,'The rain will probably continue for about $1 more minutes; after that it will temporarily become drier.'],
        [/^Vanaf ongeveer (.+) neemt de kans op regen duidelijk toe\.$/,'From around $1, the chance of rain increases noticeably.'], [/^De temperatuur zakt de komende uren richting (.+)\.$/,'The temperature will fall towards $1 over the next few hours.'], [/^De temperatuur loopt de komende uren op richting (.+)\.$/,'The temperature will rise towards $1 over the next few hours.'], [/^Houd rekening met windstoten tot ongeveer (.+)\.$/,'Expect wind gusts up to around $1.'], [/^Geen regen verwacht binnen 2 uur · (.+)$/,'No rain expected within 2 hours · $1'], [/^Details voor (.+)$/,'Details for $1']
      ]
    };
    for(const [re, replacement] of (rules[lang] || [])){
      if(re.test(source)) return source.replace(re, replacement);
    }
    return source;
  }

  function translateString(source, lang=language){
    if(source == null) return source;
    const s = String(source);
    if(normaliseLanguage(lang) === 'nl') return s;
    const target = T[normaliseLanguage(lang)] || {};
    if(Object.prototype.hasOwnProperty.call(target, s)) return target[s];
    return dynamicTranslate(s, normaliseLanguage(lang));
  }

  function translateTextNode(node){
    if(!node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    if(!parent || parent.closest('[data-i18n-ignore],script,style,code,pre')) return;
    const raw = node.nodeValue || '';
    const core = raw.trim();
    if(!core) return;
    const previous = textState.get(node);
    let source = previous?.source;
    if(!previous || raw !== previous.output){
      source = core;
    }
    const translated = translateString(source);
    const lead = raw.match(/^\s*/)?.[0] || '';
    const tail = raw.match(/\s*$/)?.[0] || '';
    const output = lead + translated + tail;
    textState.set(node, {source, output});
    if(raw !== output){ mutating = true; node.nodeValue = output; mutating = false; }
  }

  function translateAttribute(el, attr){
    if(!el?.getAttribute || el.closest?.('[data-i18n-ignore]')) return;
    const value = el.getAttribute(attr);
    if(!value) return;
    let records = attrState.get(el);
    if(!records){ records = {}; attrState.set(el, records); }
    const prev = records[attr];
    let source = prev?.source;
    if(!prev || value !== prev.output) source = value;
    const output = translateString(source);
    records[attr] = {source, output};
    if(value !== output){ mutating = true; el.setAttribute(attr, output); mutating = false; }
  }

  function translateElement(el){
    if(!el || el.nodeType !== Node.ELEMENT_NODE) return;
    ['placeholder','aria-label','title'].forEach(attr => translateAttribute(el, attr));
    for(const child of el.childNodes){
      if(child.nodeType === Node.TEXT_NODE) translateTextNode(child);
    }
    el.querySelectorAll?.('*').forEach(child => {
      ['placeholder','aria-label','title'].forEach(attr => translateAttribute(child, attr));
      for(const node of child.childNodes) if(node.nodeType === Node.TEXT_NODE) translateTextNode(node);
    });
  }

  function translateMeta(){
    const titleSource = 'Wheaterflow – live weer, radar en verwachtingen';
    document.title = translateString(titleSource);
    const descriptions = document.querySelectorAll('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]');
    descriptions.forEach(meta => {
      const source = meta.dataset.i18nSource || meta.getAttribute('content') || '';
      if(!meta.dataset.i18nSource) meta.dataset.i18nSource = source;
      meta.setAttribute('content', translateString(source));
    });
  }

  function syncLanguageControls(){
    const current = document.getElementById('languageCurrent');
    if(current) current.textContent = languageName();
    document.querySelectorAll('#segLanguage button[data-v], [data-wf-language]').forEach(button => {
      const code = normaliseLanguage(button.dataset.wfLanguage || button.dataset.v);
      const selected = code === language;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function translateDocument(root=document.body){
    if(root) translateElement(root);
    document.documentElement.lang = locale();
    document.documentElement.dataset.wfLanguage = language;
    translateMeta();
    syncLanguageControls();
  }

  function setLanguage(next, options={}){
    const lang = normaliseLanguage(next);
    if(!SUPPORTED.includes(lang)) return language;
    const changed = lang !== language;
    language = lang;
    if(options.persist !== false){ try{ localStorage.setItem(STORAGE_KEY, lang); }catch(e){} }
    translateDocument();
    if(changed && options.notify !== false){
      window.dispatchEvent(new CustomEvent('wheaterflow:language-changed', {detail:{language:lang, locale:locale(lang)}}));
    }
    return language;
  }

  function wireLanguageSelectorFallback(){
    if(document.documentElement.dataset.wfLanguageFallbackWired === '1') return;
    document.documentElement.dataset.wfLanguageFallbackWired = '1';
    // Capture phase makes the language selector reliable even when a glass
    // sheet/accordion installs its own click handlers later. Do not stop
    // propagation: script.js may additionally persist the choice to account.
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('#segLanguage button[data-v], [data-wf-language]');
      if(!button) return;
      const next = button.dataset.wfLanguage || button.dataset.v;
      if(!isSupported(next)) return;
      event.preventDefault();
      setLanguage(next, {persist:true, notify:true});
      syncLanguageControls();
    }, true);
  }

  function startObserver(){
    if(!document.body) return;
    wireLanguageSelectorFallback();
    translateDocument();
    const observer = new MutationObserver(mutations => {
      if(mutating) return;
      for(const mutation of mutations){
        if(mutation.type === 'characterData') translateTextNode(mutation.target);
        if(mutation.type === 'childList'){
          mutation.addedNodes.forEach(node => {
            if(node.nodeType === Node.TEXT_NODE) translateTextNode(node);
            else if(node.nodeType === Node.ELEMENT_NODE) translateElement(node);
          });
        }
        if(mutation.type === 'attributes') translateAttribute(mutation.target, mutation.attributeName);
      }
    });
    observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['placeholder','aria-label','title']});
  }

  window.WF_I18N = {
    supported:[...SUPPORTED], locales:{...LOCALES},
    get language(){ return language; },
    locale, languageName, isSupported, t:translateString,
    setLanguage, translateDocument, syncLanguageControls
  };

  if(document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, {once:true});
})();
