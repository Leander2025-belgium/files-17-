# Weerscoop Supabase Auth Setup

## 1. Supabase-project maken

1. Ga naar https://supabase.com.
2. Maak een nieuw project.
3. Kies een sterk databasewachtwoord en bewaar dit buiten de app.

## 2. URL en anon key vinden

1. Open je Supabase-project.
2. Ga naar Project Settings > API.
3. Kopieer:
   - Project URL
   - anon public key
   - service_role key

De service-role key is geheim en mag alleen in Netlify Functions staan.

## 3. Environment variables lokaal

Maak lokaal een `.env` bestand op basis van `.env.example`:

```env
VITE_SUPABASE_URL=https://jouw-project.supabase.co
VITE_SUPABASE_ANON_KEY=jouw-anon-key
SUPABASE_URL=https://jouw-project.supabase.co
SUPABASE_ANON_KEY=jouw-anon-key
SUPABASE_SERVICE_ROLE_KEY=jouw-service-role-key
```

Zet `.env` nooit op GitHub.

## 4. Environment variables in Netlify

Ga in Netlify naar:

Site configuration > Environment variables

Voeg toe:

```env
VITE_SUPABASE_URL=https://jouw-project.supabase.co
VITE_SUPABASE_ANON_KEY=jouw-anon-key
SUPABASE_URL=https://jouw-project.supabase.co
SUPABASE_ANON_KEY=jouw-anon-key
SUPABASE_SERVICE_ROLE_KEY=jouw-service-role-key
```

Gebruik de service-role key alleen hier, nooit in frontendcode.

## 5. SQL uitvoeren

1. Open Supabase > SQL Editor.
2. Open `supabase/schema.sql`.
3. Plak de volledige inhoud.
4. Klik Run.

Dit maakt:

- `profiles`
- `favorite_locations`
- `push_subscriptions`
- avatar bucket `avatars`
- triggers
- Row Level Security policies

## 6. Redirect-URL's instellen

Ga naar Authentication > URL Configuration.

Zet Site URL op je Netlify-URL, bijvoorbeeld:

```text
https://jouw-site.netlify.app
```

Voeg Redirect URLs toe:

```text
https://jouw-site.netlify.app/
https://jouw-site.netlify.app/index.html
http://127.0.0.1:5500/
http://127.0.0.1:5500/index.html
```

Als je een eigen domein gebruikt, voeg dat domein ook toe.

## 7. E-mailbevestiging

Ga naar Authentication > Providers > Email.

Aanbevolen:

- Confirm email: aan
- Secure email change: aan
- Minimum password length: 8 of hoger

## 8. Avatarbucket

De SQL maakt de bucket `avatars` automatisch aan.

Controleer in Storage:

- bucket bestaat;
- public access staat aan voor lezen;
- upload policies staan op eigen gebruikersmap.

## 9. Testen

Test na deploy:

1. Account aanmaken.
2. Mail bevestigen.
3. Inloggen.
4. App sluiten en opnieuw openen.
5. Profielnaam aanpassen.
6. Avatar uploaden.
7. Favoriet toevoegen.
8. Favoriet verwijderen.
9. Instellingen wijzigen.
10. Op tweede toestel inloggen.
11. Account verwijderen.

## 10. Vercel

Deze app gebruikt Netlify Functions voor:

- Supabase config ophalen;
- account verwijderen;
- pushmeldingen.

Voor Vercel moeten deze functies eerst naar Vercel Functions worden omgezet.
