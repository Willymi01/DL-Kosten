# CostPilot V15.1 – Einrichtung

V15.1 legt Benutzer direkt mit E-Mail und Startpasswort an. Einladungslinks und E-Mail-Bestätigungen entfallen.

## 1. Datenbank aktualisieren

Im Supabase SQL Editor den vollständigen Inhalt dieser Datei ausführen:

`supabase/migrations/005_v15_1_direct_admin_users.sql`

## 2. Öffentliche Registrierung deaktivieren

In Supabase unter **Authentication → Providers → Email**:

- **Allow new users to sign up: AUS**

Benutzer werden ausschließlich über die Admin-Funktion erstellt.

## 3. Edge Function bereitstellen

Im Supabase Dashboard:

1. **Edge Functions** öffnen.
2. **Create new function** wählen.
3. Als Namen exakt `admin-users` eintragen.
4. Den kompletten Beispielcode in `index.ts` löschen.
5. Den vollständigen Inhalt aus `supabase/functions/admin-users/index.ts` einfügen.
6. **Deploy** anklicken.

Die Variablen `SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` werden von Supabase für gehostete Edge Functions bereitgestellt. Der Service-Role-Schlüssel darf niemals in den Browsercode oder in GitHub-Secrets für die Webseite kopiert werden.

## 4. V15.1 veröffentlichen

Den Projektinhalt nach GitHub übertragen und den Pages-Build abwarten. Anschließend CostPilot schließen und im Browser einmal mit **Strg + F5** öffnen.

## 5. Funktion testen

- Als Administrator anmelden.
- **Benutzerverwaltung** öffnen.
- Name, E-Mail und ein Startpasswort mit mindestens 10 Zeichen eingeben.
- Der neue Benutzer kann sich sofort anmelden.

## Fehlerprüfung

Erscheint „Benutzerverwaltung nicht erreichbar“:

- Prüfen, ob die Function wirklich exakt `admin-users` heißt.
- Supabase → Edge Functions → `admin-users` → Logs öffnen.
- In der Browser-Konsole unter Network nach `/functions/v1/admin-users` suchen.
- 404 bedeutet meist falscher Funktionsname oder nicht deployed.
- 401 bedeutet abgelaufene Sitzung; ab- und erneut anmelden.
- 403 bedeutet, dass das Profil nicht als aktiver Admin eingetragen ist.
