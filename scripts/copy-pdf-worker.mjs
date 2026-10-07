// Kopiert den Hilfs-Worker von pdf.js nach public/, damit der Browser ihn laden kann.
// Läuft automatisch nach „npm install“ (auch bei Vercel), siehe "postinstall" in package.json.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const source = "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
if (existsSync(source)) {
  mkdirSync("public", { recursive: true });
  copyFileSync(source, "public/pdf.worker.min.mjs");
  console.log("pdf.js-Worker nach public/ kopiert.");
}
