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
