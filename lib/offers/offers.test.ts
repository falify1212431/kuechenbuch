import { describe, expect, it } from "vitest";
import { z } from "zod";
import { offerDrafts, offerPageSchema, offerPageTask, parsePrice } from "./extract";
import { bestOffer, formatPrice, isCurrent, offerMatches, offersForAi, offerShortLabel, validityLabel, type Offer } from "./offers";

const TODAY = "2026-10-07"; // Mittwoch

const offer = (overrides: Partial<Offer>): Offer => ({
  id: "o",
  storeName: "Aldi Süd",
  product: "Produkt",
  brand: null,
  price: 1.99,
  unitPrice: null,
  discount: null,
  validFrom: "2026-10-06",
  validTo: "2026-10-11",
  ...overrides,
});

describe("parsePrice", () => {
  it("versteht deutsche Preise", () => {
    expect(parsePrice("1,99")).toBe(1.99);
    expect(parsePrice("1,99 €")).toBe(1.99);
    expect(parsePrice("-.99")).toBe(0.99);
    expect(parsePrice(".79")).toBe(0.79);
    expect(parsePrice("2.-")).toBe(2);
    expect(parsePrice("1.299,00")).toBe(1299);
    expect(parsePrice(3.49)).toBe(3.49);
  });

  it("lehnt Unsinn ab", () => {
    expect(parsePrice("gratis")).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(0)).toBeNull();
    expect(parsePrice("-5")).toBeNull();
  });
});

describe("offerDrafts", () => {
  it("nimmt nur Lebensmittel mit Preis und übernimmt die Gültigkeit", () => {
    const page = offerPageSchema.parse({
      valid_from: "2026-10-13",
      valid_to: "2026-10-18",
      offers: [
        { product: "Hähnchenbrustfilet", brand: "Mühlenhof", price: "4,99", unit_price: "1 kg = 9,98 €", discount: "-25 %", is_food: true },
        { product: "Akkuschrauber", price: 29.99, is_food: false },
        { product: "Äpfel", price: null, is_food: true },
        { kaputt: true },
      ],
    });
    expect(offerDrafts(page, TODAY)).toEqual([
      { product: "Hähnchenbrustfilet", brand: "Mühlenhof", price: 4.99, unitPrice: "1 kg = 9,98 €", discount: "-25 %", validFrom: "2026-10-13", validTo: "2026-10-18" },
    ]);
  });

  it("ergänzt ein fehlendes Enddatum und verwirft unplausible Daten", () => {
    const noEnd = offerPageSchema.parse({ valid_from: null, valid_to: null, offers: [{ product: "Milch", price: 0.99 }] });
    expect(offerDrafts(noEnd, TODAY)[0]).toMatchObject({ validFrom: null, validTo: "2026-10-13" });
    const weird = offerPageSchema.parse({ valid_from: "2024-01-01", valid_to: "2030-01-01", offers: [{ product: "Milch", price: 0.99 }] });
    expect(offerDrafts(weird, TODAY)[0]).toMatchObject({ validFrom: null, validTo: "2026-10-13" });
  });

  it("lässt sich als JSON-Schema beschreiben und nennt den Markt im Prompt", () => {
    expect(JSON.stringify(z.toJSONSchema(offerPageSchema))).toContain("unit_price");
    expect(offerPageTask("Lidl", TODAY).prompt).toContain("Prospekt von Lidl");
  });
});

describe("Gültigkeit und Anzeige", () => {
  it("zeigt nur aktuelle Angebote", () => {
    expect(isCurrent(offer({ validTo: "2026-10-07" }), TODAY)).toBe(true);
    expect(isCurrent(offer({ validTo: "2026-10-06" }), TODAY)).toBe(false);
  });

  it("beschreibt die Gültigkeit kurz", () => {
    expect(validityLabel(offer({}), TODAY)).toBe("bis So");
    expect(validityLabel(offer({ validTo: "2026-10-07" }), TODAY)).toBe("nur noch heute");
    expect(validityLabel(offer({ validFrom: "2026-10-13", validTo: "2026-10-18" }), TODAY)).toBe("ab Di 13.10.");
    expect(validityLabel(offer({ validTo: "2026-10-20" }), TODAY)).toBe("bis Di 20.10.");
    expect(offerShortLabel(offer({ price: 0.99, validTo: "2026-10-10" }), TODAY)).toBe(`Aldi Süd: ${formatPrice(0.99)} bis Sa`);
  });
});

describe("offerMatches und bestOffer", () => {
  it("findet Produkte mit Zusätzen im Namen", () => {
    expect(offerMatches("Haferflocken", offer({ product: "Bio Haferflocken zart" }))).toBe(true);
    expect(offerMatches("Zwiebeln", offer({ product: "Gemüsezwiebeln 1 kg" }))).toBe(true);
    expect(offerMatches("Hähnchenbrust", offer({ product: "Hähnchenbrustfilet" }))).toBe(true);
    expect(offerMatches("Passierte Tomaten", offer({ product: "Tomaten passiert" }))).toBe(true);
  });

  it("findet keine falschen Treffer", () => {
    expect(offerMatches("Milch", offer({ product: "Hähnchenbrust" }))).toBe(false);
    expect(offerMatches("Passierte Tomaten", offer({ product: "Tomatenmark" }))).toBe(false);
    expect(offerMatches("Ei", offer({ product: "Reis" }))).toBe(false);
  });

  it("nimmt das günstigste aktuelle Angebot", () => {
    const offers = [
      offer({ id: "teuer", product: "Haferflocken", price: 1.29 }),
      offer({ id: "billig", product: "Haferflocken kernig", price: 0.89 }),
      offer({ id: "alt", product: "Haferflocken", price: 0.49, validTo: "2026-10-01" }),
    ];
    expect(bestOffer("Haferflocken", offers, TODAY)?.id).toBe("billig");
    expect(bestOffer("Butter", offers, TODAY)).toBeNull();
  });
});

describe("offersForAi", () => {
  it("lässt Abgelaufenes, Gesperrtes und weit Entferntes weg", () => {
    const lines = offersForAi(
      [
        offer({ product: "Hackfleisch gemischt", price: 3.99 }),
        offer({ product: "Erdnussbutter", price: 1.49 }),
        offer({ product: "Kokosmilch", price: 0.99 }),
        offer({ product: "Matjesfilets", price: 2.49 }),
        offer({ product: "Butter", validTo: "2026-10-05" }),
        offer({ product: "Spargel", validFrom: "2026-10-20", validTo: "2026-10-25" }),
        offer({ product: "Lachs", validFrom: "2026-10-12", validTo: "2026-10-17" }),
      ],
      TODAY,
      ["Rosenkohl"],
    );
    expect(lines).toEqual([
      `Aldi Süd: Hackfleisch gemischt ${formatPrice(3.99)} – bis 11.10.2026`,
      `Aldi Süd: Lachs ${formatPrice(1.99)} – ab 12.10.2026, bis 17.10.2026`,
    ]);
  });
});
