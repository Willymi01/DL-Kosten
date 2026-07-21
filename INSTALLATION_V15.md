# CostPilot V15 installieren

## 1. Datenbank aktualisieren

Öffne Supabase → SQL Editor → New query. Kopiere den vollständigen Inhalt aus:

`supabase/migrations/004_v15_invitation_access.sql`

Klicke anschließend auf **Run**. Erwartete Meldung: `Success. No rows returned`.

## 2. Supabase Auth einstellen

Öffne Authentication → Providers → Email.

- **Allow new users to sign up:** EIN
- E-Mail-Bestätigung kann nach Wunsch EIN oder AUS sein.

Die aktivierte Registrierung ist nicht öffentlich nutzbar: Der V15-Datenbanktrigger akzeptiert ausschließlich gültige, nicht abgelaufene Einladungen.

## 3. App veröffentlichen

Das Projekt zu GitHub hochladen und den Pages-Build abwarten. Danach CostPilot vollständig schließen und im Browser mit `Strg + F5` neu laden.

## 4. Benutzer einladen

Als Admin anmelden → Benutzerverwaltung → Name und E-Mail eintragen → Einladungslink erzeugen → Link an den Benutzer senden.

Der Benutzer öffnet den Link, trägt genau die eingeladene E-Mail-Adresse ein und vergibt sein Passwort.

## 5. Alte Edge Function

`admin-users` wird von V15 nicht mehr verwendet. Sie kann in Supabase unter Edge Functions gelöscht werden.
