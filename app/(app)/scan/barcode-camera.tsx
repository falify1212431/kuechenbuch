"use client";

import { useEffect, useRef, useState } from "react";

// Die im Browser eingebaute Barcode-Erkennung (gibt es nicht überall, deshalb selbst beschrieben)
interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (options: { formats: string[] }): NativeDetector;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

/**
 * Kamera-Vorschau, die laufend nach Barcodes sucht. Nutzt die eingebaute Erkennung des
 * Browsers, wenn vorhanden, sonst die Bibliothek ZXing (läuft z. B. auch auf dem iPhone).
 */
export function BarcodeCamera({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  // onDetected kann sich bei jedem Neuzeichnen ändern; wir merken uns immer die neueste Version
  const callback = useRef(onDetected);
  useEffect(() => {
    callback.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let zxingControls: { stop: () => void } | undefined;

    const found = (code: string) => {
      if (stopped || !/^\d{8,14}$/.test(code)) return;
      stopped = true;
      navigator.vibrate?.(80);
      callback.current(code);
    };

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      try {
        const native = window.BarcodeDetector;
        const supported = native ? await native.getSupportedFormats() : [];
        if (native && FORMATS.some((format) => supported.includes(format))) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 } },
          });
          video.srcObject = stream;
          await video.play();
          const detector = new native({ formats: FORMATS.filter((f) => supported.includes(f)) });
          timer = setInterval(async () => {
            if (stopped || video.readyState < 2) return;
            const codes = await detector.detect(video).catch(() => []);
            if (codes[0]) found(codes[0].rawValue);
          }, 150);
        } else {
          // Ersatz: ZXing wird nur geladen, wenn es gebraucht wird
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromConstraints(
            { video: { facingMode: "environment" } },
            video,
            (result) => {
              if (result) found(result.getText());
            },
          );
        }
      } catch (cause) {
        console.error("Kamera-Fehler:", cause);
        setError("Die Kamera lässt sich nicht öffnen. Erlaube den Kamera-Zugriff oder gib den Barcode unten von Hand ein.");
      }
    }

    start();
    return () => {
      stopped = true;
      clearInterval(timer);
      zxingControls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
        {/* Zielrahmen als Hilfe */}
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-white/80" />
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
