import { defineConfig } from "vitest/config";

// Einstellungen für unsere Tests (Vitest)
export default defineConfig({
  resolve: {
    // Versteht die Kurzpfade aus tsconfig.json, z. B. "@/lib/..."
    tsconfigPaths: true,
  },
  test: {
    // Wir testen reine Logik ohne Browser, dafür reicht Node.js
    environment: "node",
  },
});
