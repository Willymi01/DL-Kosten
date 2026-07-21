# CostPilot V16 installieren

## 1. Datenbank stabilisieren

Im Supabase SQL Editor den vollständigen Inhalt dieser Datei ausführen:

`supabase/migrations/006_v16_profile_stability.sql`

Die Migration ergänzt fehlende Profile und stellt sicher, dass jeder Benutzer sein eigenes Profil lesen kann.

## 2. Benutzerverwaltung

Die vorhandene Edge Function muss exakt `admin-users` heißen und den Inhalt aus

`supabase/functions/admin-users/index.ts`

verwenden. Ist sie bereits unter diesem Namen bereitgestellt, ist keine Änderung nötig.

## 3. Registrierung

Unter Authentication → Providers → Email muss „Allow new users to sign up“ ausgeschaltet bleiben. Neue Benutzer werden ausschließlich durch den Administrator angelegt.

## 4. GitHub Pages

V16 veröffentlichen, den Build abwarten und anschließend die App mit Strg+F5 neu laden. Bei einer installierten PWA die App vollständig schließen und wieder öffnen.

## Behobener Loginfehler

Frühere Versionen fragten alle Teamprofile mit `.maybeSingle()` ab. Sobald mehr als ein Benutzer vorhanden war, meldete Supabase:

`JSON object requested, multiple (or no) rows returned`

V16 fragt ausschließlich das Profil der aktuell angemeldeten Benutzer-ID ab.
