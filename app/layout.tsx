import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Unterseiten setzen nur ihren Teil, z. B. "Anmelden" → "Anmelden – Küchenbuch"
  title: { default: "Küchenbuch", template: "%s – Küchenbuch" },
  description: "Vorrat, Kochideen und Einkaufsliste an einem Ort",
  // Damit die App auch auf dem iPhone ohne Adressleiste vom Homescreen startet
  appleWebApp: { capable: true, title: "Küchenbuch" },
};

// Farbe der Statusleiste am Handy
export const viewport: Viewport = {
  themeColor: "#047857",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
