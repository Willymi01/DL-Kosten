# CostPilot V3

Single-User-Cloud-App mit Live-Synchronisierung zwischen Handy und PC.

## Neue Funktionen

- Übersicht mit Monat, Dienstleister, Kosten, Stunden und Durchschnittssatz
- ein Gesamtplan pro Monat direkt auf der Übersicht
- Abweichung in Euro und Prozent, Hochrechnung, Kosten je Stunde, größter Kostenanteil
- alle Dienstleister gleichzeitig in der Zeiterfassung
- Preise mit Gültigkeitszeitraum von/bis
- Live-Synchronisierung über Supabase Realtime
- separate Planzahlen-Seite entfernt

## Update einer bestehenden Supabase-Datenbank

Nach dem Hochladen der neuen App zusätzlich im Supabase SQL Editor ausführen:

```text
supabase/migrations/002_dashboard_rates_sync.sql
```

Danach GitHub Actions erneut starten. Für Handy und PC auf beiden Geräten mit demselben Konto anmelden. Änderungen werden sofort in Supabase gespeichert und über Realtime auf das andere Gerät übertragen.


## Version 4

- Jahresübersicht mit allen zwölf Monaten direkt auf dem Dashboard
- Monatsplan je Monat ohne Wechsel der Ansicht pflegen
- Ist-Kosten, Stunden, Abweichung in Euro und Prozent
- direkter Sprung in einen Monat durch Klick auf den Monatsnamen
- installierbare Progressive Web App für Handy und PC


## Version 5

- Monatskosten je Dienstleister nach Arbeitsbereichen aufgeschlüsselt
- Zwischensumme je Dienstleister
- Gesamtsumme über alle Dienstleister


## Version 6

- Zeiterfassung lädt die Daten der tatsächlich gewählten Kalenderwoche
- vergangene Monate und Kalenderwochen können angezeigt und bearbeitet werden
- Vor-/Zurück-Navigation zwischen Wochen
- Auswahl eines Monats springt in der Zeiterfassung automatisch zu einer passenden Kalenderwoche
- Behebung des Fehlers, bei dem Monatswerte in der Übersicht sichtbar, aber in der Zeiterfassung nicht geladen waren


## Version 8

- Behebung des Navigationsfehlers zwischen Zeiterfassung und Übersicht
- asynchrones Laden einer alten Zeiterfassungsansicht kann die neue Ansicht nicht mehr überschreiben
- aktive Navigation, Seitentitel und Seiteninhalt bleiben jetzt synchron


## Version 10 – stabiler Neuaufbau

Die Oberfläche wurde in getrennte Module aufgeteilt:

- `views/dashboard.js` – Monatsübersicht, Jahresübersicht und Prognose
- `views/entry.js` – Zeiterfassung und historische Kalenderwochen
- `views/vendors.js` – Dienstleister, Arbeitsbereiche und Preiszeiträume
- `store.js` – Laden und Aktualisieren der Supabase-Daten
- `shell.js` – Navigation und Zeitraumsauswahl
- `utils.js` – Datums-, Kosten- und Formatierungsfunktionen

Zusätzlich:

- Fehler einer einzelnen Ansicht legen nicht mehr die gesamte App lahm
- sichere Navigation gegen asynchrone Überschreibungen
- Jahresprognose mit Sparbedarf oder zusätzlichem monatlichem Spielraum
- bestehende Supabase-Daten und Migrationen bleiben kompatibel


## Version 11 – Controlling & Analysen

Neu auf dem Dashboard:

- Ampelsystem für den aktuellen Monatsplan
- 3-Monats-Durchschnitt
- Trend zum Vormonat
- Dienstleister-Ranking
- Arbeitsbereichsauswertung
- Monat-zu-Monat-Vergleich
- erweiterte Jahresprognose bleibt vollständig erhalten
- keine neue Supabase-Migration notwendig


## Version 12 – Berichte, Import und Sicherung

Neu:

- PDF-Monatsbericht
- Excel-Export mit Monatsübersicht, Zeiterfassung und Jahresplänen
- Excel-/CSV-Import mit Vorschau und Fehlerprüfung
- JSON-Gesamtbackup
- Wiederherstellung aus einem CostPilot-Backup
- eigener Bereich „Berichte & Import“
- keine neue Supabase-Migration erforderlich

### Excel-Importspalten

Pflicht:

- Datum
- Dienstleister
- Arbeitsbereich
- Stunden

Optional:

- Notiz

Dienstleister und Arbeitsbereich müssen vor dem Import bereits angelegt sein.


## Version 13 – Komfort, Warnungen und Visualisierung

- eigener Bereich „Analysen & Warnungen“
- automatische Budget-, Konzentrations- und Preiswarnungen
- Kostenverlaufsdiagramm für zwölf Monate
- Plan-Ist-Balkendiagramm
- Kostenverteilung der Dienstleister als Ringdiagramm
- optionale Browser-Benachrichtigungen
- PWA-Installationsschaltfläche, sofern der Browser sie anbietet
- Online-/Offline-Anzeige und verbesserter Service Worker
- manuelles Aktualisieren der Analysedaten
- keine neue Supabase-Migration erforderlich


## Version 13.1 – Aktuelle Woche beim Öffnen

Beim Wechsel in die Zeiterfassung springt CostPilot jetzt immer automatisch auf die aktuelle ISO-Kalenderwoche. Jahr und Monat werden ebenfalls auf das aktuelle Datum gesetzt. Manuell ausgewählte vergangene oder zukünftige Wochen können danach weiterhin wie gewohnt bearbeitet werden.

## Version 14 – Admin-verwaltete Teamzugänge

- öffentliche Selbstregistrierung entfernt
- vorhandener erster Benutzer wird durch Migration 003 zum Administrator
- Administrator kann weitere Benutzer anlegen
- Administrator kann Benutzerpasswörter setzen und Benutzer entfernen
- alle Benutzer eines Accounts arbeiten im selben Datenbestand
- RLS bleibt aktiv; Daten sind nicht öffentlich zugänglich
- Stundenlimit auf 1.000 je Eintrag erweitert

### Einrichtung in Supabase

1. Im SQL Editor `supabase/migrations/003_admin_team_access.sql` ausführen.
2. Die Edge Function bereitstellen:
   ```bash
   supabase functions deploy admin-users
   ```
3. In Supabase Auth die öffentliche Registrierung deaktivieren: **Authentication → Providers → Email → Allow new users to sign up** ausschalten.
4. App neu deployen und einmal vollständig neu laden.

Die Edge Function verwendet den automatisch verfügbaren `SUPABASE_SERVICE_ROLE_KEY`. Dieser Schlüssel darf niemals in die Web-App oder in `.env` übernommen werden.


## Version 15 – stabile Teamverwaltung

V15 entfernt die Abhängigkeit von der Edge Function `admin-users`.

- Admins erzeugen sieben Tage gültige Einmal-Einladungslinks.
- Eingeladene Benutzer legen ihr Passwort selbst fest.
- Nicht eingeladene Registrierungen werden vom Datenbank-Trigger abgewiesen.
- Zugänge können gesperrt und reaktiviert werden.
- Passwortänderungen laufen über Supabase Reset-E-Mails.
- Bestehende Auth-Benutzer werden durch Migration 004 automatisch als Administratoren nachgetragen.

### Einmalige Aktualisierung

1. `supabase/migrations/004_v15_invitation_access.sql` vollständig im Supabase SQL Editor ausführen.
2. Unter Authentication > Providers > Email muss `Allow new users to sign up` aktiviert sein. Unbefugte Registrierungen werden trotzdem vom Einladungs-Trigger blockiert.
3. V15 auf GitHub Pages veröffentlichen und die App mit Strg+F5 neu laden.
4. Die alte Edge Function `admin-users` wird nicht mehr benötigt und kann gelöscht werden.


## Version 15.1 – direkte Benutzeranlage

- Benutzer werden vom Admin mit Name, E-Mail und Startpasswort angelegt.
- Keine Einladungslinks und keine E-Mail-Bestätigung.
- Passwörter können vom Admin gesetzt werden.
- Zugänge können gesperrt, reaktiviert und entfernt werden.
- Einrichtung: siehe `INSTALLATION_V15_1.md`.


## Version 15.2 – Formularfehler behoben

- „Benutzer anlegen“ funktioniert wieder.
- „Passwort setzen“ funktioniert wieder.
- Submit-Schaltflächen sind nun explizit als `type="submit"` definiert.
- Keine neue SQL-Migration und keine Änderung an der Edge Function erforderlich.
