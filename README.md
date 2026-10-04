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

- **Authentication → Emails → Templates:** Die Vorlagen „Confirm signup“ und „Magic Link“ enthalten den Login-Code und einen Link (Text unten). Ohne diese Änderung steht kein Code in der Mail.
- **Authentication → URL Configuration:** Site URL = Adresse der App bei Vercel. Redirect URLs = `http://localhost:3000/**` und `https://<adresse-bei-vercel>/**`.
- **Authentication → Sign In / Providers:** „Allow new users to sign up“ ist ausgeschaltet, damit sich niemand Fremdes registrieren kann.
- Der eingebaute Mailversand von Supabase schickt nur an Adressen aus dem eigenen Supabase-Team und höchstens 2 Mails pro Stunde.

Betreff beider Vorlagen: `Dein Code fürs Küchenbuch`. Inhalt:

```html
<h2>Dein Code fürs Küchenbuch</h2>
<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
<p>Tippe den Code in der App ein. Oder melde dich direkt über diesen Link an:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Jetzt anmelden</a></p>
<p>Wenn du das nicht angefordert hast, kannst du diese Mail ignorieren.</p>
```

## Weitere Befehle

| Befehl | Was er tut |
| --- | --- |
| `npm test` | Tests einmal ausführen |
| `npm run test:watch` | Tests bei jeder Änderung automatisch neu ausführen |
| `npm run lint` | Code auf typische Fehler prüfen |
| `npm run build` | Fertige Version bauen, so wie Vercel es online macht |
| `node scripts/generate-icons.mjs` | App-Icons neu erzeugen (die Zeichnung steht im Skript) |
