import { describe, expect, it } from "vitest";
import { findPantryMatch, formatAmount, ingredientStatus, isStaple, scaleAmount, toShoppingLine } from "./ingredients";

describe("scaleAmount", () => {
  it("rechnet auf andere Portionen um und rundet sinnvoll", () => {
    expect(scaleAmount(200, "g", 1.5)).toBe(300);
    expect(scaleAmount(250, "g", 1 / 3)).toBe(85); // 83,3 → auf 5 gerundet
    expect(scaleAmount(12, "g", 0.5)).toBe(6);
    expect(scaleAmount(1, "Stück", 1.5)).toBe(1.5);
    expect(scaleAmount(1, "EL", 1.3)).toBe(1.5);
    expect(scaleAmount(1, "Zehe", 0.25)).toBe(0.5); // nie weniger als eine halbe
  });

  it("lässt Prisen und Mengen ohne Angabe in Ruhe", () => {
    expect(scaleAmount(1, "Prise", 3)).toBe(1);
    expect(scaleAmount(null, "g", 2)).toBeNull();
  });
});

describe("formatAmount", () => {
  it("schreibt deutsche Zahlen und Mehrzahl", () => {
    expect(formatAmount(1.5, "EL")).toBe("1,5 EL");
    expect(formatAmount(2, "Zehe")).toBe("2 Zehen");
    expect(formatAmount(1, "Dose")).toBe("1 Dose");
    expect(formatAmount(null, "Prise")).toBe("1 Prise");
    expect(formatAmount(null, null)).toBe("");
  });
});

describe("isStaple", () => {
  const staples = ["Salz", "Pfeffer", "Öl", "Gemüsebrühe", "getrocknete Kräuter"];

  it("erkennt Grundvorrat auch in längeren Namen", () => {
    expect(isStaple("Olivenöl", staples)).toBe(true);
    expect(isStaple("Salz und Pfeffer", staples)).toBe(true);
    expect(isStaple("Gemüsebrühe (Pulver)", staples)).toBe(true);
    expect(isStaple("Kräuter", staples)).toBe(true);
  });

  it("nimmt sonst nichts als vorhanden an", () => {
    expect(isStaple("Sahne", staples)).toBe(false);
    expect(isStaple("Hähnchenbrust", staples)).toBe(false);
  });
});

describe("findPantryMatch und ingredientStatus", () => {
  const pantry = [
    { id: "a", name: "Zwiebel" },
    { id: "b", name: "Tomatenmark" },
    { id: "c", name: "Tomaten" },
    { id: "d", name: "Hackfleisch gemischt" },
  ];

  it("findet Einzahl/Mehrzahl und bevorzugt gleiche Namen", () => {
    expect(findPantryMatch("Zwiebeln", pantry)?.id).toBe("a");
    expect(findPantryMatch("Tomate", pantry)?.id).toBe("c");
    expect(findPantryMatch("Hackfleisch", pantry)?.id).toBe("d");
    expect(findPantryMatch("Sahne", pantry)).toBeNull();
    expect(findPantryMatch("Ei", pantry)).toBeNull();
  });

  it("vergibt vorrat, grundvorrat oder fehlt", () => {
    expect(ingredientStatus({ name: "Hack", pantryItemId: "d", staple: false }, pantry)).toBe("vorrat");
    expect(ingredientStatus({ name: "Salz", pantryItemId: null, staple: true }, pantry)).toBe("grundvorrat");
    expect(ingredientStatus({ name: "Zwiebeln", pantryItemId: null, staple: false }, pantry)).toBe("vorrat");
    // Verknüpfter Eintrag ist inzwischen verbraucht und nichts Passendes mehr da
    expect(ingredientStatus({ name: "Sahne", pantryItemId: "weg", staple: false }, pantry)).toBe("fehlt");
  });
});

describe("toShoppingLine", () => {
  it("übernimmt Mengen in Einheiten der Einkaufsliste", () => {
    expect(toShoppingLine({ name: "Hackfleisch", amount: 250, unit: "g" }, 2)).toEqual({ name: "Hackfleisch", quantity: 500, unit: "g" });
    expect(toShoppingLine({ name: "Kichererbsen", amount: 1, unit: "Dose" }, 1)).toEqual({ name: "Kichererbsen", quantity: 1, unit: "Packung" });
    expect(toShoppingLine({ name: "Petersilie", amount: 1, unit: "Bund" }, 1)).toEqual({ name: "Petersilie", quantity: 1, unit: "Stück" });
  });

  it("macht aus Löffeln und Zehen etwas, das man kaufen kann", () => {
    expect(toShoppingLine({ name: "Tomatenmark", amount: 2, unit: "EL" }, 1)).toEqual({ name: "Tomatenmark", quantity: 1, unit: "Packung" });
    expect(toShoppingLine({ name: "Knoblauch", amount: 3, unit: "Zehe" }, 1)).toEqual({ name: "Knoblauch", quantity: 1, unit: "Stück" });
    expect(toShoppingLine({ name: "Zitrone", amount: 1, unit: null }, 2)).toEqual({ name: "Zitrone", quantity: 2, unit: "Stück" });
    expect(toShoppingLine({ name: "Muskat", amount: null, unit: "Prise" }, 1)).toEqual({ name: "Muskat", quantity: 1, unit: "Packung" });
  });
});
