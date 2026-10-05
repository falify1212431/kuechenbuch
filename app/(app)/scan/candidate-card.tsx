"use client";

import { PeanutBanner } from "@/components/peanut-banner";
import { input, label } from "@/components/styles";
import type { Category, Location } from "@/lib/data/basics";
import { UNITS, type Unit } from "@/lib/pantry/quantity";
import type { ScanCandidate } from "@/lib/scan/candidate";

/** Ein erkannter Eintrag zum Prüfen und Korrigieren vor dem Speichern */
export function CandidateCard({
  candidate,
  categories,
  locations,
  onChange,
  showPeanutDetails = true,
}: {
  candidate: ScanCandidate;
  categories: Category[];
  locations: Location[];
  onChange: (next: ScanCandidate) => void;
  showPeanutDetails?: boolean;
}) {
  const set = (changes: Partial<ScanCandidate>) => onChange({ ...candidate, ...changes });

  function changeCategory(categoryId: string) {
    const suggested = categories.find((c) => c.id === categoryId)?.default_location_id;
    set({ categoryId: categoryId || null, locationId: suggested ?? candidate.locationId });
  }

  return (
    <div className="flex flex-col gap-2">
      {candidate.peanut && <PeanutBanner status={candidate.peanut} compact={!showPeanutDetails} />}

      <div className="flex gap-2">
        {candidate.imageUrl && (
          // Produktbild von Open Food Facts (normales img, weil es von einer fremden Adresse kommt)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={candidate.imageUrl} alt="" className="size-16 shrink-0 rounded-lg bg-white object-contain" />
        )}
        <label className="flex flex-1 flex-col gap-1">
          <span className={label}>Name</span>
          <input value={candidate.name} onChange={(e) => set({ name: e.target.value })} maxLength={100} className={input} />
        </label>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="any"
          value={candidate.quantity}
          onChange={(e) => set({ quantity: Number(e.target.value) })}
          aria-label="Menge"
          className={`${input} w-24`}
        />
        <select value={candidate.unit} onChange={(e) => set({ unit: e.target.value as Unit })} aria-label="Einheit" className={`${input} w-28`}>
          {UNITS.map((unit) => (
            <option key={unit}>{unit}</option>
          ))}
        </select>
        <select value={candidate.categoryId ?? ""} onChange={(e) => changeCategory(e.target.value)} aria-label="Kategorie" className={input}>
          <option value="">– Kategorie –</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <label className="flex w-1/2 flex-col gap-1">
          <span className={label}>Datum {candidate.dateEstimated && "(≈ geschätzt)"}</span>
          <input
            type="date"
            value={candidate.date ?? ""}
            onChange={(e) => set({ date: e.target.value || null, dateEstimated: false })}
            className={input}
          />
        </label>
        <label className="flex w-1/2 flex-col gap-1">
          <span className={label}>Art</span>
          <select
            value={candidate.dateType}
            onChange={(e) => set({ dateType: e.target.value as ScanCandidate["dateType"] })}
            className={input}
          >
            <option value="mhd">MHD</option>
            <option value="verbrauch">Verbrauchsdatum</option>
          </select>
        </label>
      </div>

      <select value={candidate.locationId ?? ""} onChange={(e) => set({ locationId: e.target.value || null })} aria-label="Lagerort" className={input}>
        <option value="">– Lagerort –</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.icon} {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}
