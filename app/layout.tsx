import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Küchenbuch",
  description: "Vorrat, Kochideen und Einkaufsliste an einem Ort",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
