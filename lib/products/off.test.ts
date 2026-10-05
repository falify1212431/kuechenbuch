import { describe, expect, it } from "vitest";
import { mapCategory, mapOffProduct, mapQuantity } from "./off";

// Gekürzte, typische Antwort von Open Food Facts
const MILK = {
  product_name: "Fresh milk",
  product_name_de: "Frische Vollmilch 3,5%",
  brands: "Milsani, Aldi",
  product_quantity: 1,
  product_quantity_unit: "l",
  categories_tags: ["en:dairies", "en:milks", "en:whole-milks"],
  allergens_tags: ["en:milk"],
  traces_tags: [],
  ingredients_text_de: "Vollmilch",
  image_front_small_url: "https://images.openfoodfacts.org/milk.jpg",
  nutriments: {
    "energy-kcal_100g": 64,
    fat_100g: 3.5,
    "saturated-fat_100g": 2.3,
    carbohydrates_100g: 4.8,
    sugars_100g: 4.8,
    proteins_100g: 3.3,
    salt_100g: 0.13,
  },
};

describe("mapOffProduct", () => {
  it("übernimmt deutschen Namen, erste Marke, Menge in ml und Kategorie", () => {
    const product = mapOffProduct(MILK)!;
    expect(product.name).toBe("Frische Vollmilch 3,5%");
    expect(product.brand).toBe("Milsani");
    expect(product).toMatchObject({ quantity: 1000, unit: "ml", categoryName: "Milchprodukte & Eier" });
  });

  it("übernimmt Nährwerte pro 100 ml", () => {
    expect(mapOffProduct(MILK)!.nutriments).toEqual({
      kcal: 64,
      fat: 3.5,
      saturatedFat: 2.3,
      carbohydrates: 4.8,
      sugars: 4.8,
      fiber: null,
      proteins: 3.3,
      salt: 0.1,
    });
  });

  it("unterscheidet „keine Allergene“ von „keine Angabe“", () => {
    expect(mapOffProduct(MILK)!.allergens).toEqual(["en:milk"]);
    const { allergens_tags, ...withoutAllergens } = MILK;
    void allergens_tags;
    expect(mapOffProduct(withoutAllergens)!.allergens).toBeNull();
  });

  it("ohne Namen ist das Produkt unbrauchbar", () => {
    expect(mapOffProduct({ ...MILK, product_name: "", product_name_de: "" })).toBeNull();
  });

  it("ohne Nährwerte bleibt das Feld leer", () => {
    expect(mapOffProduct({ ...MILK, nutriments: {} })!.nutriments).toBeNull();
  });
});

describe("mapQuantity", () => {
  it("rechnet kg und l in g und ml um", () => {
    expect(mapQuantity(0.5, "kg")).toEqual({ quantity: 500, unit: "g" });
    expect(mapQuantity(75, "cl")).toEqual({ quantity: 750, unit: "ml" });
    expect(mapQuantity("250", "g")).toEqual({ quantity: 250, unit: "g" });
  });

  it("unbekannte Einheiten oder Unsinn ergeben nichts", () => {
    expect(mapQuantity(6, "Stück")).toEqual({ quantity: null, unit: null });
    expect(mapQuantity(0, "g")).toEqual({ quantity: null, unit: null });
  });
});

describe("mapCategory", () => {
  it("Tiefkühl schlägt die eigentliche Lebensmittel-Art", () => {
    expect(mapCategory(["en:vegetables", "en:frozen-foods"])).toBe("Tiefkühlware");
  });

  it("süße Aufstriche (z. B. Nutella) sind Süßes, keine Konserve", () => {
    expect(mapCategory(["en:spreads", "en:sweet-spreads", "en:hazelnut-spreads"])).toBe("Snacks & Süßes");
  });

  it("unbekannt ergibt keine Kategorie", () => {
    expect(mapCategory(["en:pet-foods"])).toBeNull();
    expect(mapCategory(undefined)).toBeNull();
  });
});
