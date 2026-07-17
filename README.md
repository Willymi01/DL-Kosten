# CostPilot Single-User

Sichere Cloud-App für eine Firma und ein Benutzerkonto.

## Enthalten

- E-Mail-/Passwort-Login
- Passwort zurücksetzen
- keine Filialen, Rollen oder Teamverwaltung
- sichere Cloud-Speicherung in Supabase
- Row-Level-Security: alle Daten gehören nur zum angemeldeten Konto
- Dienstleister und Stundensätze
- Wochen- und Tageserfassung
- Monatsauswertung und Plan-Ist
- mobile Nutzung und GitHub-Pages-Deployment

## Start

```bash
cp .env.example .env
npm install
npm run dev
```

Danach `supabase/migrations/001_secure_schema.sql` im Supabase SQL Editor ausführen und die Supabase-Zugangsdaten in `.env` eintragen.

Anschließend direkt in der App registrieren, E-Mail bestätigen und anmelden. Eine zusätzliche Filial- oder Rollenzuordnung ist nicht nötig.
