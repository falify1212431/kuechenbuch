"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonPrimary, buttonSecondary, card, errorBox, input } from "@/components/styles";
import type { Category, Location } from "@/lib/data/basics";
import { formatDateDe } from "@/lib/dates";
import type { ScanCandidate } from "@/lib/scan/candidate";
import { saveScanned } from "./actions";
import { BarcodeCamera } from "./barcode-camera";
import { CandidateCard } from "./candidate-card";
import { PhotoButton } from "./photo-button";

type Mode = "barcode" | "datum" | "lose-ware" | "kassenbon";

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: "barcode", label: "Barcode", icon: "▥" },
  { id: "datum", label: "Datum", icon: "📅" },
  { id: "lose-ware", label: "Lose Ware", icon: "🍎" },
  { id: "kassenbon", label: "Kassenbon", icon: "🧾" },
];

interface Props {
  categories: Category[];
  locations: Location[];
}

export function Scanner(props: Props) {
  const [mode, setMode] = useState<Mode>("barcode");

  return (
    <div className="flex flex-col gap-4">
      <nav className="grid grid-cols-4 gap-1 rounded-xl bg-stone-200 p-1 text-xs dark:bg-stone-800" aria-label="Scan-Modus">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            className={`flex flex-col items-center rounded-lg py-1.5 ${
              mode === m.id ? "bg-white font-semibold shadow-sm dark:bg-stone-600" : "text-stone-600 dark:text-stone-300"
            }`}
          >
            <span className="text-lg" aria-hidden>
              {m.icon}
            </span>
            {m.label}
          </button>
        ))}
      </nav>

      {/* key: Beim Moduswechsel startet der jeweilige Ablauf frisch */}
      {mode === "barcode" && <BarcodeFlow key="barcode" {...props} />}
      {mode === "datum" && <DateFlow key="datum" />}
      {(mode === "lose-ware" || mode === "kassenbon") && <ListFlow key={mode} mode={mode} {...props} />}
    </div>
  );
}

/* ---------- Barcode: scannen → prüfen → speichern → nächstes ---------- */

type BarcodeState =
  | { step: "scan" }
  | { step: "loading"; barcode: string }
  | { step: "unknown"; barcode: string }
  | { step: "confirm"; candidate: ScanCandidate; acknowledged: boolean };

function BarcodeFlow({ categories, locations }: Props) {
  const [state, setState] = useState<BarcodeState>({ step: "scan" });
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function lookup(barcode: string) {
    setError(null);
    setState({ step: "loading", barcode });
    try {
      const response = await fetch(`/api/products/${barcode}`);
      const result = await response.json();
      if (result.error) {
        setError(result.error);
        setState({ step: "scan" });
      } else if (!result.found) {
        setState({ step: "unknown", barcode });
      } else {
        setState({ step: "confirm", candidate: result.candidate, acknowledged: false });
      }
    } catch {
      setError("Keine Verbindung. Prüf das Internet und scanne noch einmal.");
      setState({ step: "scan" });
    }
  }

  async function save(candidate: ScanCandidate) {
    setSaving(true);
    const result = await saveScanned([candidate]);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setLastSaved(candidate.name);
    setState({ step: "scan" });
  }

  if (state.step === "scan") {
    return (
      <div className="flex flex-col gap-3">
        {lastSaved && (
          <p className="rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            ✓ {lastSaved} ist im Vorrat. Nächstes Produkt?
          </p>
        )}
        {error && <p className={errorBox}>{error}</p>}
        <BarcodeCamera onDetected={lookup} />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{8,14}$/.test(manual)) lookup(manual);
          }}
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Barcode von Hand eingeben"
            aria-label="Barcode von Hand eingeben"
            className={input}
          />
          <button type="submit" className={buttonSecondary}>
            Suchen
          </button>
        </form>
        <p className="text-center text-xs text-stone-500">Produktdaten: Open Food Facts (ODbL)</p>
      </div>
    );
  }

  if (state.step === "loading") {
    return <p className="py-12 text-center text-stone-500">Suche {state.barcode} …</p>;
  }

  if (state.step === "unknown") {
    return (
      <div className={`${card} flex flex-col gap-3`}>
        <p>
          Den Barcode <strong>{state.barcode}</strong> kennt die Datenbank noch nicht. Fotografiere die Vorderseite der
          Packung, dann erkennt die KI das Produkt und merkt es sich für das nächste Mal.
        </p>
        <PhotoButton
          mode="produkt"
          barcode={state.barcode}
          label="📷 Packung fotografieren"
          onResult={(result) => {
            const [candidate] = result.candidates as ScanCandidate[];
            setState({ step: "confirm", candidate, acknowledged: false });
          }}
        />
        <button type="button" onClick={() => setState({ step: "scan" })} className={buttonSecondary}>
          Abbrechen
        </button>
      </div>
    );
  }

  // Schritt „prüfen“: rot gewarnte Produkte müssen erst bestätigt werden
  const { candidate, acknowledged } = state;
  const blocked = candidate.peanut === "erdnuss" && !acknowledged;
  return (
    <div className={`${card} flex flex-col gap-3`}>
      <CandidateCard
        candidate={candidate}
        categories={categories}
        locations={locations}
        onChange={(next) => setState({ ...state, candidate: next })}
      />
      <PhotoButton
        mode="datum"
        label="📷 Datum fotografieren"
        onResult={(result) => {
          if (!result.date) return setError("Kein Datum lesbar – das geschätzte Datum bleibt stehen.");
          setError(null);
          setState({
            ...state,
            candidate: {
              ...candidate,
              date: result.date as string,
              dateType: (result.dateType as ScanCandidate["dateType"]) ?? candidate.dateType,
              dateEstimated: false,
            },
          });
        }}
      />
      {error && <p className={errorBox}>{error}</p>}
      {candidate.peanut === "erdnuss" && (
        <label className="flex items-center gap-2 rounded-xl border-2 border-red-600 p-3 font-semibold text-red-700 dark:text-red-400">
          <input type="checkbox" checked={acknowledged} onChange={(e) => setState({ ...state, acknowledged: e.target.checked })} className="size-5" />
          Ich habe die Erdnuss-Warnung gelesen
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setState({ step: "scan" })} className={buttonSecondary}>
          Verwerfen
        </button>
        <button type="button" disabled={blocked || saving || !candidate.name.trim()} onClick={() => save(candidate)} className={buttonPrimary}>
          {saving ? "Speichere …" : "In den Vorrat"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Datum: Foto → Datum → neuer Eintrag mit diesem Datum ---------- */

function DateFlow() {
  const [result, setResult] = useState<{ date: string | null; dateType: string | null; readText: string | null } | null>(null);

  return (
    <div className={`${card} flex flex-col gap-3`}>
      <p className="text-stone-600 dark:text-stone-400">Fotografiere den Datumsaufdruck. Die KI liest das Datum und erkennt, ob es ein MHD oder ein Verbrauchsdatum ist.</p>
      <PhotoButton mode="datum" label="📷 Datum fotografieren" onResult={(r) => setResult(r as typeof result)} />
      {result && !result.date && <p className={errorBox}>Kein Datum lesbar. Versuch es mit einem schärferen Foto oder gib es von Hand ein.</p>}
      {result?.date && (
        <>
          <p className="text-lg">
            Erkannt: <strong>{formatDateDe(result.date)}</strong>
            {result.dateType && ` (${result.dateType === "verbrauch" ? "Verbrauchsdatum" : "MHD"})`}
          </p>
          {result.readText && <p className="text-sm text-stone-500">Gelesen: „{result.readText}“</p>}
          <Link href={`/vorrat/neu?datum=${result.date}&art=${result.dateType ?? "mhd"}`} className={buttonPrimary}>
            Weiter: Eintrag mit diesem Datum anlegen
          </Link>
        </>
      )}
    </div>
  );
}

/* ---------- Lose Ware und Kassenbon: Foto → Liste zum Abhaken → übernehmen ---------- */

function ListFlow({ mode, categories, locations }: Props & { mode: "lose-ware" | "kassenbon" }) {
  const [candidates, setCandidates] = useState<(ScanCandidate & { selected: boolean })[] | null>(null);
  const [matches, setMatches] = useState<{ id: string; name: string; selected: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  if (saved !== null) {
    return (
      <div className={`${card} flex flex-col gap-3`}>
        <p className="text-lg">✓ {saved} {saved === 1 ? "Eintrag" : "Einträge"} im Vorrat.</p>
        <Link href="/vorrat" className={buttonPrimary}>
          Zum Vorrat
        </Link>
      </div>
    );
  }

  if (!candidates) {
    return (
      <div className={`${card} flex flex-col gap-3`}>
        <p className="text-stone-600 dark:text-stone-400">
          {mode === "kassenbon"
            ? "Fotografiere den Kassenbon möglichst gerade und vollständig. Die KI macht daraus eine Liste zum Abhaken."
            : "Fotografiere Obst, Gemüse oder andere lose Sachen, gern mehrere auf einem Bild."}
        </p>
        <PhotoButton
          mode={mode}
          label={mode === "kassenbon" ? "📷 Kassenbon fotografieren" : "📷 Lose Ware fotografieren"}
          onResult={(result) => {
            const list = (result.candidates as ScanCandidate[]).map((c) => ({ ...c, selected: c.peanut !== "erdnuss" }));
            if (list.length === 0) return setError("Auf dem Foto wurde nichts Essbares erkannt.");
            setCandidates(list);
            setMatches(((result.shoppingMatches as { id: string; name: string }[]) ?? []).map((m) => ({ ...m, selected: true })));
          }}
        />
        {error && <p className={errorBox}>{error}</p>}
      </div>
    );
  }

  const selected = candidates.filter((c) => c.selected);

  async function save() {
    setSaving(true);
    // Das Feld „selected“ ignoriert der Server, er übernimmt nur bekannte Felder
    const result = await saveScanned(
      selected,
      matches.filter((m) => m.selected).map((m) => m.id),
    );
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setSaved(result.count);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-stone-600 dark:text-stone-400">Häkchen weg bei allem, was nicht in den Vorrat soll. Daten mit ≈ sind geschätzt.</p>
      {candidates.map((candidate, index) => (
        <div key={candidate.key} className={`${card} flex flex-col gap-2 ${candidate.selected ? "" : "opacity-50"}`}>
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={candidate.selected}
              onChange={(e) => setCandidates(candidates.map((c, i) => (i === index ? { ...c, selected: e.target.checked } : c)))}
              className="size-5"
            />
            Übernehmen
          </label>
          {candidate.selected && (
            <CandidateCard
              candidate={candidate}
              categories={categories}
              locations={locations}
              showPeanutDetails={false}
              onChange={(next) => setCandidates(candidates.map((c, i) => (i === index ? { ...next, selected: true } : c)))}
            />
          )}
          {!candidate.selected && <p>{candidate.name}</p>}
        </div>
      ))}

      {matches.length > 0 && (
        <div className={card}>
          <p className="mb-2 font-semibold">Von der Einkaufsliste streichen (gekauft):</p>
          {matches.map((match, index) => (
            <label key={match.id} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={match.selected}
                onChange={(e) => setMatches(matches.map((m, i) => (i === index ? { ...m, selected: e.target.checked } : m)))}
                className="size-5"
              />
              {match.name}
            </label>
          ))}
        </div>
      )}

      {error && <p className={errorBox}>{error}</p>}
      <button type="button" disabled={saving || selected.length === 0} onClick={save} className={`${buttonPrimary} sticky bottom-24 shadow-lg`}>
        {saving ? "Speichere …" : `${selected.length} in den Vorrat übernehmen`}
      </button>
    </div>
  );
}
