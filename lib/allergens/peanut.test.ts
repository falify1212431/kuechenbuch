import { describe, expect, it } from "vitest";
import { checkPeanut, mentionsPeanut } from "./peanut";

// Vollständige, unauffällige Angaben aus Open Food Facts
const SAFE = {
  source: "off" as const,
  allergens: ["en:milk"],
  traces: [],
  ingredientsText: "Vollmilch, Zucker, Kakao",
};

describe("checkPeanut: rote Warnung (enthält Erdnuss)", () => {
  it("erkennt den Allergen-Eintrag der Datenbank", () => {
    expect(checkPeanut({ ...SAFE, allergens: ["en:milk", "en:peanuts"] })).toBe("erdnuss");
  });

  it("erkennt Erdnuss im Zutatentext, auch als Wortteil und in Mehrzahl", () => {
    expect(checkPeanut({ ...SAFE, ingredientsText: "Mais, ERDNÜSSE (25 %), Salz" })).toBe("erdnuss");
    expect(checkPeanut({ ...SAFE, ingredientsText: "Weizenmehl, Erdnussöl, Salz" })).toBe("erdnuss");
    expect(checkPeanut({ ...SAFE, ingredientsText: "Sonnenblumenöl, Erdnußbutter" })).toBe("erdnuss");
  });

  it("erkennt andere Sprachen und Fachbegriffe", () => {
    expect(checkPeanut({ ...SAFE, ingredientsText: "sugar, roasted peanuts, salt" })).toBe("erdnuss");
    expect(checkPeanut({ ...SAFE, ingredientsText: "huile d'arachide" })).toBe("erdnuss");
    expect(checkPeanut({ ...SAFE, ingredientsText: "cacahuètes grillées" })).toBe("erdnuss");
    expect(checkPeanut({ ...SAFE, ingredientsText: "Arachis hypogaea Öl" })).toBe("erdnuss");
  });

  it("erkennt Erdnuss im Produktnamen, auch wenn sonst nichts bekannt ist", () => {
    expect(checkPeanut({ name: "Erdnussflips", source: "ki" })).toBe("erdnuss");
    expect(checkPeanut({ name: "Peanut Butter Cups", source: "off" })).toBe("erdnuss");
  });

  it("enthält gewinnt über Spuren", () => {
    expect(
      checkPeanut({ ...SAFE, ingredientsText: "Erdnüsse, Salz. Kann Spuren von Erdnüssen enthalten." }),
    ).toBe("erdnuss");
  });

  it("warnt im Zweifel lieber: „ohne Erdnuss“ zählt trotzdem als Treffer", () => {
    expect(checkPeanut({ ...SAFE, ingredientsText: "Mandeln, Zucker, ohne Erdnüsse" })).toBe("erdnuss");
  });
});

describe("checkPeanut: gelbe Warnung (Spuren)", () => {
  it("erkennt den Spuren-Eintrag der Datenbank", () => {
    expect(checkPeanut({ ...SAFE, traces: ["en:nuts", "en:peanuts"] })).toBe("spuren");
  });

  it("erkennt Spuren-Hinweise im Zutatentext", () => {
    expect(checkPeanut({ ...SAFE, ingredientsText: "Kakao, Zucker. Kann Spuren von Erdnüssen enthalten." })).toBe("spuren");
    expect(checkPeanut({ ...SAFE, ingredientsText: "Kakao, Zucker. Kann Erdnüsse enthalten." })).toBe("spuren");
    expect(checkPeanut({ ...SAFE, ingredientsText: "Sugar, cocoa. May contain peanuts." })).toBe("spuren");
    expect(
      checkPeanut({ ...SAFE, ingredientsText: "Mehl, Zucker. Hergestellt in einem Betrieb, der auch Erdnüsse verarbeitet." }),
    ).toBe("spuren");
  });

  it("Spuren von Schalenfrüchten allein sind keine Erdnuss-Warnung", () => {
    expect(checkPeanut({ ...SAFE, traces: ["en:nuts"] })).toBe("frei");
  });
});

describe("checkPeanut: nicht geprüft", () => {
  it("Produkte, die nur die KI erkannt hat, gelten nie als geprüft", () => {
    expect(checkPeanut({ ...SAFE, source: "ki" })).toBe("ungeprueft");
  });

  it("fehlende Allergen-Angaben oder Zutaten heißen: Packung lesen", () => {
    expect(checkPeanut({ ...SAFE, allergens: null })).toBe("ungeprueft");
    expect(checkPeanut({ ...SAFE, ingredientsText: null })).toBe("ungeprueft");
    expect(checkPeanut({ ...SAFE, ingredientsText: "   " })).toBe("ungeprueft");
  });

  it("nur mit vollständigen Datenbank-Angaben ohne Treffer: frei", () => {
    expect(checkPeanut(SAFE)).toBe("frei");
  });
});

describe("mentionsPeanut", () => {
  it("findet Erdnuss in Namen von Einkäufen oder Gerichten", () => {
    expect(mentionsPeanut("Erdnusssauce")).toBe(true);
    expect(mentionsPeanut("ERDNÜSSE gesalzen")).toBe(true);
    expect(mentionsPeanut("Haselnüsse")).toBe(false);
    expect(mentionsPeanut(null)).toBe(false);
  });
});
