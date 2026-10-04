import type { MetadataRoute } from "next";

// Das Manifest sagt dem Handy, wie die installierte App heißt, aussieht und startet.
// Next.js liefert es unter /manifest.webmanifest aus.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Küchenbuch",
    short_name: "Küchenbuch",
    description: "Vorrat, Kochideen und Einkaufsliste an einem Ort",
    lang: "de",
    start_url: "/",
    scope: "/",
    // „standalone“ = ohne Adressleiste, wie eine normale App
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#047857",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
