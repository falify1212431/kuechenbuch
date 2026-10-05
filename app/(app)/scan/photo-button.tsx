"use client";

import { useRef, useState } from "react";
import { buttonPrimary } from "@/components/styles";
import { resizeImage } from "@/lib/image/resize";
import type { ScanMode } from "@/lib/scan/ai-tasks";

/**
 * Knopf, der die Kamera öffnet, das Foto verkleinert und an /api/scan schickt.
 * Das Ergebnis (JSON) bekommt der Aufrufer über onResult.
 */
export function PhotoButton({
  mode,
  barcode,
  label,
  onResult,
}: {
  mode: ScanMode;
  barcode?: string;
  label: string;
  onResult: (result: Record<string, unknown>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("mode", mode);
      form.set("image", await resizeImage(file));
      if (barcode) form.set("barcode", barcode);
      const response = await fetch("/api/scan", { method: "POST", body: form });
      const result = await response.json();
      if (result.error) setError(result.error);
      else onResult(result);
    } catch (cause) {
      console.error(cause);
      setError("Das hat nicht geklappt. Prüf die Internetverbindung und versuch es noch einmal.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) send(file);
        }}
      />
      <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={buttonPrimary}>
        {busy ? "KI liest das Foto …" : label}
      </button>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
    </div>
  );
}
