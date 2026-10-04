# Küchenbuch

Handy-App (PWA) für Vorrat mit Ablaufdaten, Kochideen, Essensplan und Einkaufsliste.
Was die App können soll und in welchen Phasen sie entsteht, steht in [docs/SPEC.md](docs/SPEC.md).

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 24.

```bash
npm install
npm run dev
```

`npm install` lädt einmalig alle Pakete. `npm run dev` startet die App unter <http://localhost:3000>.

## Weitere Befehle

| Befehl | Was er tut |
| --- | --- |
| `npm test` | Tests einmal ausführen |
| `npm run test:watch` | Tests bei jeder Änderung automatisch neu ausführen |
| `npm run lint` | Code auf typische Fehler prüfen |
| `npm run build` | Fertige Version bauen, so wie Vercel es online macht |
