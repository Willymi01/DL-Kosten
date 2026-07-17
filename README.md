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
