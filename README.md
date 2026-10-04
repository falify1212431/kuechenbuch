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

## Weitere Befehle

| Befehl | Was er tut |
| --- | --- |
| `npm test` | Tests einmal ausführen |
| `npm run test:watch` | Tests bei jeder Änderung automatisch neu ausführen |
| `npm run lint` | Code auf typische Fehler prüfen |
| `npm run build` | Fertige Version bauen, so wie Vercel es online macht |
| `node scripts/generate-icons.mjs` | App-Icons neu erzeugen (die Zeichnung steht im Skript) |
