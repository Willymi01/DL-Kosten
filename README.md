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


## Version 9

- Jahresprognose aus dem bisherigen Ist-Verlauf
- erwartete Jahreskosten und erwartete Abweichung zum Jahresplan
- durchschnittlich verfügbares Budget je verbleibendem Monatsanteil
- automatische Aussage, wie viel pro Restmonat gespart werden muss oder zusätzlich ausgegeben werden kann
- abgeschlossene und zukünftige Jahre werden getrennt behandelt
