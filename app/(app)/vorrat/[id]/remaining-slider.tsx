"use client";

import { useState } from "react";
import { buttonSecondary } from "@/components/styles";
import { formatQuantity, sliderStep, type Unit } from "@/lib/pantry/quantity";

/** Schieberegler für „Teilweise verbraucht“: Wie viel ist noch übrig? */
export function RemainingSlider({
  action,
  quantity,
  unit,
}: {
  action: (formData: FormData) => Promise<void>;
  quantity: number;
  unit: Unit;
}) {
  const [remaining, setRemaining] = useState(quantity);

  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="remaining" className="flex justify-between text-sm">
        <span>Noch übrig:</span>
        <strong>
          {formatQuantity(remaining, unit)} von {formatQuantity(quantity, unit)}
        </strong>
      </label>
      <input
        id="remaining"
        name="remaining"
        type="range"
        min={0}
        max={quantity}
        step={sliderStep(unit, quantity)}
        value={remaining}
        onChange={(event) => setRemaining(Number(event.target.value))}
        className="w-full accent-emerald-700"
      />
      <button type="submit" disabled={remaining === quantity} className={buttonSecondary}>
        {remaining === 0 ? "Alles verbraucht" : "Restmenge speichern"}
      </button>
    </form>
  );
}
