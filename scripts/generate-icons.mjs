// Erzeugt alle App-Icons aus einer Zeichnung (SVG).
// Aufruf, wenn sich das Icon ändern soll: node scripts/generate-icons.mjs
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const GREEN = "#047857";

// Weißer Kochtopf mit Deckel, mittig auf 512 × 512 Pixeln.
// Alles liegt im inneren Kreis (Radius ca. 205 px), damit Android das Icon
// rund oder abgerundet zuschneiden kann, ohne etwas abzuschneiden.
const POT = `
  <g fill="#ffffff">
    <rect x="236" y="158" width="40" height="32" rx="12"/>
    <rect x="116" y="186" width="280" height="26" rx="13"/>
    <path d="M136 222 H376 V318 A36 36 0 0 1 340 354 H172 A36 36 0 0 1 136 318 Z"/>
    <rect x="96" y="236" width="52" height="24" rx="12"/>
    <rect x="364" y="236" width="52" height="24" rx="12"/>
  </g>`;

// rounded: abgerundete Ecken für normale Icons; ohne Rundung für „maskable“ (Android schneidet selbst zu)
function svg({ rounded }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${GREEN}"/>${POT}
</svg>
`;
}

async function png(svgText, size, file) {
  await sharp(Buffer.from(svgText)).resize(size, size).png().toFile(file);
  console.log("erstellt:", file);
}

await png(svg({ rounded: true }), 192, "public/icons/icon-192.png");
await png(svg({ rounded: true }), 512, "public/icons/icon-512.png");
await png(svg({ rounded: false }), 512, "public/icons/maskable-512.png");
// Icon fürs iPhone (iOS rundet die Ecken selbst ab)
await png(svg({ rounded: false }), 180, "app/apple-icon.png");
// Kleines Icon für den Browser-Tab
await writeFile("app/icon.svg", svg({ rounded: true }));
console.log("erstellt: app/icon.svg");
