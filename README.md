# Küchenbuch

Handy-App (PWA) für Vorrat mit Ablaufdaten, Kochideen, Essensplan und Einkaufsliste.
Was die App können soll und in welchen Phasen sie entsteht, steht in [docs/SPEC.md](docs/SPEC.md).

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 24.

1. `.env.example` kopieren, die Kopie `.env.local` nennen und die echten Werte aus Supabase eintragen. Wo du sie findest, steht in der Datei. `.env.local` kommt nie ins Git-Repo.
2. Pakete installieren und App starten:

```bash
npm install
npm run dev
```

`npm install` lädt einmalig alle Pakete. `npm run dev` startet die App unter <http://localhost:3000>.

## Online (Vercel)

Vercel baut die App bei jedem Push auf GitHub automatisch neu. Die Variablen aus `.env.example` müssen dort unter Settings → Environment Variables eingetragen sein. Die Server-Region Frankfurt steht in `vercel.json`.

## Einstellungen im Supabase-Dashboard

Diese Einstellungen stehen nicht im Code, sondern werden im Supabase-Dashboard gemacht:

- **Login per Link:** Die Mail-Vorlagen bleiben Standard (ändern geht erst mit eigenem Mail-Server/SMTP). Der Link funktioniert nur im selben Browser, in dem er angefordert wurde.
- **Authentication → URL Configuration:** Site URL = Adresse der App bei Vercel. Redirect URLs = `http://localhost:3000/**` und `https://<adresse-bei-vercel>/**`.
- **Authentication → Sign In / Providers:** „Allow new users to sign up“ ist ausgeschaltet, damit sich niemand Fremdes registrieren kann.
- Der eingebaute Mailversand von Supabase schickt nur an Adressen aus dem eigenen Supabase-Team und höchstens 2 Mails pro Stunde.

## Weitere Befehle

| Befehl | Was er tut |
| --- | --- |
| `npm test` | Tests einmal ausführen |
| `npm run test:watch` | Tests bei jeder Änderung automatisch neu ausführen |
| `npm run lint` | Code auf typische Fehler prüfen |
| `npm run build` | Fertige Version bauen, so wie Vercel es online macht |
| `node scripts/generate-icons.mjs` | App-Icons neu erzeugen (die Zeichnung steht im Skript) |
