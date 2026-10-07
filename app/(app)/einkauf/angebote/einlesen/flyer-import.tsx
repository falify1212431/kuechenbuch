"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonPrimary, buttonSecondary, card, errorBox, input, label } from "@/components/styles";
import { mentionsPeanut } from "@/lib/allergens/peanut";
import { pdfToImages } from "@/lib/image/pdf";
import { resizeImage } from "@/lib/image/resize";
import type { OfferDraft } from "@/lib/offers/extract";
import { saveOffers } from "../actions";

interface Page {
  id: number;
  file: File;
  url: string;
  selected: boolean;
}

interface Row extends OfferDraft {
  key: string;
  page: number;
  keep: boolean;
}

type Phase = "auswahl" | "lesen" | "pruefen";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Prospekt einlesen in drei Schritten:
 * 1. Fotos oder PDF wählen, Seiten mit Lebensmitteln antippen
 * 2. Die App schickt Seite für Seite zur KI (bei „ausgelastet“ wartet sie kurz und versucht es nochmal)
 * 3. Ergebnis durchsehen, korrigieren, speichern
 */
export function FlyerImport({ stores }: { stores: { id: string; name: string }[] }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [pages, setPages] = useState<Page[]>([]);
  const [phase, setPhase] = useState<Phase>("auswahl");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const nextId = useRef(1);
  const urls = useRef<string[]>([]);

  // Vorschaubilder wieder freigeben, wenn die Seite verlassen wird
  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function addPages(files: File[], selected: boolean) {
    const added = files.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { id: nextId.current++, file, url, selected };
    });
    setPages((current) => [...current, ...added]);
  }

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError("");
    const files = [...list];
    try {
      for (const file of files) {
        if (file.type === "application/pdf") {
          setStatus("PDF wird in Seiten zerlegt …");
          const images = await pdfToImages(file, (done, total) => setStatus(`PDF wird zerlegt: Seite ${done} von ${total} …`));
          // Bei PDFs wählst du die Seiten selbst aus (spart KI-Kontingent)
          addPages(images, false);
        } else if (file.type.startsWith("image/")) {
          setStatus("Foto wird vorbereitet …");
          addPages([await resizeImage(file, 1800, 0.85)], true);
        }
      }
    } catch (e) {
      console.error(e);
      setError("Die Datei ließ sich nicht öffnen. Ist es ein Foto oder ein PDF?");
    }
    setStatus("");
  }

  const selected = pages.filter((page) => page.selected);

  async function readPages() {
    setPhase("lesen");
    setError("");
    const found: Row[] = [];
    for (const [index, page] of selected.entries()) {
      for (let attempt = 1; attempt <= 4; attempt++) {
        setStatus(`Seite ${index + 1} von ${selected.length} wird gelesen …`);
        const form = new FormData();
        form.set("store_id", storeId);
        form.set("image", page.file);
        const response = await fetch("/api/offers/import", { method: "POST", body: form });
        const body = await response.json().catch(() => ({ error: "Keine Antwort vom Server." }));
        if (response.ok) {
          (body.drafts as OfferDraft[]).forEach((draft, i) => found.push({ ...draft, key: `${page.id}-${i}`, page: index + 1, keep: true }));
          break;
        }
        if (response.status === 429 && attempt < 4) {
          // Groq-Gratis-Limit pro Minute: kurz warten
          for (let s = 30; s > 0; s--) {
            setStatus(`Die KI ist ausgelastet – weiter in ${s} Sekunden (Seite ${index + 1} von ${selected.length}) …`);
            await sleep(1000);
          }
          continue;
        }
        setError(`${body.error ?? "Fehler beim Lesen."} (Seite ${index + 1})`);
        if (response.status === 402) {
          // Tageslimit erreicht: Was schon da ist, kann trotzdem gespeichert werden
          setRows(found);
          setPhase("pruefen");
          setStatus("");
          return;
        }
        break;
      }
    }
    setRows(found);
    setPhase("pruefen");
    setStatus("");
  }

  function update(key: string, change: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  async function save() {
    setSaving(true);
    setError("");
    const drafts = rows
      .filter((row) => row.keep)
      .map(({ product, brand, price, unitPrice, discount, validFrom, validTo }) => ({ product, brand, price, unitPrice, discount, validFrom, validTo }));
    const result = await saveOffers(storeId, Math.max(1, selected.length), drafts);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/einkauf/angebote?gespeichert=${result.saved}`);
  }

  if (stores.length === 0) return <p className={errorBox}>Bitte zuerst unter Mehr → Märkte einen Markt anlegen.</p>;

  return (
    <div className="flex flex-col gap-4">
      {phase === "auswahl" && (
        <>
          <label className="flex flex-col gap-1">
            <span className={label}>Markt</span>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={input}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>

          <label className={`${buttonSecondary} cursor-pointer`}>
            📄 Fotos oder PDF wählen
            <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => onFiles(e.target.files).then(() => (e.target.value = ""))} />
          </label>
          {status && <p className="text-sm text-stone-500">{status}</p>}

          {pages.length > 0 && (
            <>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Tipp die Seiten mit Lebensmitteln an. Jede Seite kostet 1 KI-Aufruf (Limit 50 pro Tag).
              </p>
              <div className="grid grid-cols-3 gap-2">
                {pages.map((page, index) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setPages((current) => current.map((p) => (p.id === page.id ? { ...p, selected: !p.selected } : p)))}
                    className={`relative overflow-hidden rounded-lg border-4 ${page.selected ? "border-emerald-600" : "border-transparent opacity-60"}`}
                    aria-pressed={page.selected}
                    aria-label={`Seite ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- lokales Vorschaubild, kein Bild aus dem Netz */}
                    <img src={page.url} alt="" className="aspect-[3/4] w-full object-cover" />
                    <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">
                      {index + 1}
                      {page.selected && " ✓"}
                    </span>
                  </button>
                ))}
              </div>
              <button type="button" disabled={selected.length === 0 || !storeId} onClick={readPages} className={buttonPrimary}>
                {selected.length === 0 ? "Seiten antippen" : `🔍 ${selected.length} ${selected.length === 1 ? "Seite" : "Seiten"} lesen lassen`}
              </button>
            </>
          )}
        </>
      )}

      {phase === "lesen" && (
        <div className={`${card} flex flex-col items-center gap-2 py-8 text-center`}>
          <p className="text-3xl" aria-hidden>
            🔍
          </p>
          <p aria-live="polite">{status}</p>
          <p className="text-xs text-stone-500">Bitte die Seite offen lassen.</p>
        </div>
      )}

      {phase === "pruefen" && (
        <>
          <p className="text-stone-600 dark:text-stone-400">
            {rows.length} {rows.length === 1 ? "Angebot" : "Angebote"} erkannt. Prüf kurz Namen, Preise und „gültig bis“, entferne Falsches und speichere.
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((row) => {
              const peanut = mentionsPeanut(`${row.product} ${row.brand ?? ""}`);
              return (
                <li key={row.key} className={`${card} flex flex-col gap-2 ${row.keep ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={row.keep} onChange={(e) => update(row.key, { keep: e.target.checked })} className="size-5 accent-emerald-700" aria-label="Übernehmen" />
                    <input value={row.product} onChange={(e) => update(row.key, { product: e.target.value })} aria-label="Produkt" className={`${input} min-w-0 flex-1`} />
                  </div>
                  {peanut && <p className="rounded bg-red-600 px-2 py-1 text-sm font-bold text-white">⚠️ Enthält laut Name Erdnuss</p>}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex items-center gap-1">
                      €
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        value={row.price}
                        onChange={(e) => update(row.key, { price: Number(e.target.value) })}
                        aria-label="Preis"
                        className={`${input} w-24`}
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      bis
                      <input type="date" value={row.validTo} onChange={(e) => update(row.key, { validTo: e.target.value })} aria-label="Gültig bis" className={`${input} w-40`} />
                    </label>
                    <span className="text-stone-500">
                      {[row.brand, row.unitPrice, row.discount, `S. ${row.page}`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPhase("auswahl")} className={`${buttonSecondary} flex-1`}>
              ← Seiten
            </button>
            <button type="button" disabled={saving || !rows.some((r) => r.keep)} onClick={save} className={`${buttonPrimary} flex-[2]`}>
              {saving ? "Speichert …" : `💾 ${rows.filter((r) => r.keep).length} speichern`}
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
    </div>
  );
}
