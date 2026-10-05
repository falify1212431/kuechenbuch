"use client";

import { useEffect, useState } from "react";

// Das Ereignis, mit dem Chrome meldet: „Diese App kann installiert werden“
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

/**
 * Zeigt einen Knopf „App installieren“, sobald Chrome die App für installierbar hält.
 * Klappt nicht in jedem Browser (z. B. nicht in Safari), auf Android mit Chrome aber schon.
 */
export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault(); // Chrome soll nicht selbst fragen, wir zeigen unseren Knopf
      setPromptEvent(event as InstallPromptEvent);
    }
    function onInstalled() {
      setPromptEvent(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return <p className="text-emerald-700 dark:text-emerald-400">Installiert! Du findest die App jetzt auf dem Startbildschirm.</p>;
  }

  if (!promptEvent) {
    return (
      <p className="text-sm text-stone-500">
        Der Knopf „App installieren“ erscheint hier, sobald Chrome die App als installierbar erkennt.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => promptEvent.prompt()}
      className="rounded-xl bg-emerald-700 px-4 py-3 text-lg font-semibold text-white hover:bg-emerald-800"
    >
      App installieren
    </button>
  );
}
