# Küchenbuch (EssenApp)

Handy-App (PWA) für meinen Vorrat mit Ablaufdaten, Scannen, KI-Kochvorschlägen, Essensplan, Einkaufsliste, Prospekten und Morgen-Briefing. Nur für mich (ein Haushalt). Mein Handy: Android (Chrome).

**Die vollständige Spezifikation steht in [`docs/SPEC.md`](docs/SPEC.md). Lies sie vor jeder Phase.**

## Technik

Next.js (App Router) + TypeScript + Tailwind als PWA · Supabase (Datenbank, Login, Fotos) · Gemini API (kostenloses Kontingent, nur vom Server aufgerufen) · Open Food Facts · Hosting auf Vercel (Hobby). Details und Datenmodell stehen in der SPEC unter „Technik“.

## Infrastruktur (Stand Phase 0)

- Live: https://kuechenbuch-six.vercel.app · GitHub: falify1212431/kuechenbuch (privat) · Vercel-Projekt `essens-app/kuechenbuch` (Hobby), jeder Push auf `main` wird automatisch veröffentlicht
- Supabase-Projekt `swqapqhrhyxsarzfrzci` (Free, Region eu-west-1/Irland), deshalb Vercel-Region `dub1` in `vercel.json`
- Vercel-CLI und Supabase-CLI sind auf meinem PC angemeldet (`npx vercel …`, `npx supabase …`)
- Login: nur Link per Mail (PKCE, gleicher Browser nötig), max. 2 Mails pro Stunde, nur an die Adresse meines Supabase-Kontos; neue Registrierungen sind abgeschaltet
- Ich nutze die App in Samsung Internet; Installieren aufs Homescreen klappt auf meinem S25 nicht (Geräteproblem, nicht die App)

## Code-Struktur

- `app/(app)/…`: Bereiche nach dem Login (vorrat, einkauf, einstellungen) mit Navigationsleiste; `actions.ts` je Bereich = Server-Aktionen, Eingaben mit zod geprüft
- `app/login`, `app/auth/confirm`: Login per Mail-Link; `proxy.ts` schützt alle anderen Seiten
- `lib/` reine Logik mit Tests daneben (`*.test.ts`): `dates`, `pantry/` (Ablauf, Schätzung, Mengen, Gruppierung), `shopping/`, `order`, `text`
- `lib/data/`: Laden aus Supabase (`loadBasics` legt beim ersten Besuch die Startwerte per `ensure_defaults()` an)
- `supabase/migrations/`: Datenbank-Änderungen als SQL; übertragen mit `npm run db:push`, danach `npm run db:types`
- `components/styles.ts`: gemeinsame Tailwind-Klassen (keine UI-Bibliothek)

## Befehle

- `npm run dev`: App lokal starten (http://localhost:3000)
- `npm test`: Tests (Vitest), Testdateien liegen neben dem Code als `*.test.ts`
- `npm run lint`: ESLint
- `npm run build`: Produktions-Build, vor jedem Commit laufen lassen

## So arbeitest du mit mir

- **Alles auf Deutsch:** Erklärungen, Oberfläche, Code-Kommentare, Commit-Nachrichten. Namen im Code (Tabellen, Variablen, Funktionen) auf Englisch wie im Datenmodell der SPEC.
- **Ich lerne gerade programmieren:** Erklär mir nach jedem Schritt kurz, was du gemacht hast und warum. Sag mir genau, was ich selbst tun muss (z. B. Konten anlegen, Einstellungen klicken).
- **Nur die aktuelle Phase bauen.** Vor jeder Phase einen kurzen Plan zeigen und auf mein Okay warten. Ideen für später in `docs/IDEEN.md` sammeln, nicht nebenbei einbauen.
- Kleine Schritte, nach jedem Schritt testen.
- **Fragen statt raten:** bei Entscheidungen mit mehreren sinnvollen Wegen, bei allem, was etwas kosten könnte, und bei rechtlich unklaren Datenquellen (z. B. automatischer Prospekt-Abruf).
- **Nach jeder Phase:** Tests für die Logik, App starten, ich probiere sie am Handy aus. Erst dann Haken in `docs/SPEC.md` setzen und einen Git-Commit machen. Danach in 3–5 Sätzen erklären, was neu ist und wie ich es teste.

## Harte Regeln

- **0 € laufende Kosten:** nur kostenlose Stufen. Keinen kostenpflichtigen Dienst hinzufügen, keine Abrechnung aktivieren, keine Zahlungsdaten hinterlegen. Ausnahmen nur mit meiner ausdrücklichen Zustimmung.
- **Erdnussallergie (sehr stark) = harter Ausschluss**, auch Erdnussöl, Erdnussbutter, Erdnusssauce, Saté. Doppelte Sicherung: Die KI bekommt den Ausschluss im Prompt, und der Server prüft jeden Vorschlag zusätzlich gegen eine Sperrliste mit eigenen Tests. Treffer werden verworfen, nicht angezeigt.
- **Ebenfalls nie vorschlagen:** Kokos in jeder Form, saurer/eingelegter Fisch (z. B. Rollmops, Bismarckhering).
- **Die App ersetzt nie das Lesen der Zutatenliste:** Erdnuss → rote Warnung, Spuren → gelbe Warnung, ungeprüfte Allergene → „Allergene nicht geprüft – Packung lesen“.
- **KI hilft, entscheidet aber nicht allein:** Jede KI-Erkennung erst zum Bestätigen zeigen, nie direkt speichern. KI-Antworten immer mit zod prüfen.
- **Geheimnisse** (KI-Schlüssel, Supabase-Secret-Key) nur als Umgebungsvariablen auf dem Server, nie im Browser-Code und nie im Git-Repo. Jede neue Variable in `.env.example` dokumentieren.
- **Deutsche Formate:** Datum TT.MM.JJJJ, Preise in Euro, Zeitzone Europe/Berlin.

## Next.js-Regeln

Next.js 16 weicht stark von älteren Versionen ab. Die folgende Datei wird von `next dev` gepflegt:

@AGENTS.md
