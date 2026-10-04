import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sicherheits-Header für alle Seiten (Empfehlung aus der Next.js-Anleitung für PWAs)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Der Browser soll Dateitypen nicht erraten, sondern uns glauben
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Keine fremde Seite darf die App einbetten (Schutz vor untergeschobenen Klicks)
          { key: "X-Frame-Options", value: "DENY" },
          // Fremde Seiten erfahren bei einem Link-Klick nur unsere Adresse, nicht die genaue Unterseite
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
