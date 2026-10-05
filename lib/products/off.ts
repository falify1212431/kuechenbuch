// Anbindung an Open Food Facts (freie Lebensmittel-Datenbank, Lizenz ODbL).
// Doku: https://openfoodfacts.github.io/openfoodfacts-server/api/
// Regeln: eigener User-Agent mit Kontakt, höchstens 15 Produkt-Abfragen pro Minute.

import type { Unit } from "@/lib/pantry/quantity";

const USER_AGENT = "Kuechenbuch/0.2 (xodela222@gmail.com)";
const FIELDS = [
  "product_name",
  "product_name_de",
  "brands",
  "quantity",
  "product_quantity",
  "product_quantity_unit",
  "categories_tags",
  "allergens_tags",
  "traces_tags",
  "ingredients_text_de",
  "ingredients_text",
  "image_front_small_url",
  "nutriments",
].join(",");

/** Nährwerte pro 100 g bzw. 100 ml */
export interface Nutriments {
  kcal: number | null;
  fat: number | null;
  saturatedFat: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  fiber: number | null;
  proteins: number | null;
  salt: number | null;
}

/** Was wir von einem Open-Food-Facts-Produkt brauchen */
export interface OffProduct {
  name: string;
  brand: string | null;
  quantity: number | null;
  unit: Unit | null;
  /** Name einer unserer Standard-Kategorien, oder null */
  categoryName: string | null;
  allergens: string[] | null;
  traces: string[] | null;
  ingredientsText: string | null;
  imageUrl: string | null;
  nutriments: Nutriments | null;
}

// Open-Food-Facts-Kategorien → unsere Standard-Kategorien. Die genaueren stehen oben.
const CATEGORY_MAP: [string[], string][] = [
  [["en:frozen-foods"], "Tiefkühlware"],
  [["en:sweet-spreads", "en:hazelnut-spreads", "en:jams", "en:honeys"], "Snacks & Süßes"],
  [["en:fruits", "en:fresh-fruits", "en:bananas", "en:apples", "en:berries", "en:citrus"], "Obst"],
  [["en:vegetables", "en:fresh-vegetables", "en:salads", "en:potatoes", "en:onions", "en:tomatoes"], "Gemüse & Salat"],
  [["en:dairies", "en:milks", "en:cheeses", "en:yogurts", "en:eggs", "en:butters", "en:creams"], "Milchprodukte & Eier"],
  [["en:meats", "en:poultries", "en:fishes", "en:seafood", "en:meat-alternatives", "en:tofu", "en:sausages"], "Fleisch, Fisch & Ersatz"],
  [["en:breads", "en:pastries", "en:viennoiseries", "en:cakes"], "Brot & Backwaren"],
  [["en:pastas", "en:rices", "en:cereals-and-potatoes", "en:breakfast-cereals", "en:flakes", "en:grains"], "Nudeln, Reis & Getreide"],
  [["en:canned-foods", "en:sauces", "en:soups", "en:legumes", "en:tomato-sauces", "en:spreads"], "Konserven & Saucen"],
  [["en:flours", "en:sugars", "en:vegetable-oils", "en:baking-aids", "en:vinegars"], "Backen & Grundzutaten"],
  [["en:condiments", "en:spices", "en:salts", "en:herbs", "en:mustards", "en:ketchup"], "Gewürze & Würzmittel"],
  [["en:snacks", "en:sweet-snacks", "en:salty-snacks", "en:chocolates", "en:confectioneries", "en:biscuits"], "Snacks & Süßes"],
  [["en:beverages", "en:waters", "en:juices", "en:sodas", "en:teas", "en:coffees"], "Getränke"],
];

export function mapCategory(tags: string[] | undefined): string | null {
  if (!tags?.length) return null;
  for (const [offTags, name] of CATEGORY_MAP) {
    if (offTags.some((tag) => tags.includes(tag))) return name;
  }
  return null;
}

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;

/** Menge aus Open Food Facts in unsere Einheiten: g oder ml (kg und l werden umgerechnet) */
export function mapQuantity(amount: unknown, unit: unknown): { quantity: number | null; unit: Unit | null } {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value) || value <= 0) return { quantity: null, unit: null };
  switch (String(unit ?? "").toLowerCase()) {
    case "g":
      return { quantity: value, unit: "g" };
    case "kg":
      return { quantity: value * 1000, unit: "g" };
    case "ml":
      return { quantity: value, unit: "ml" };
    case "cl":
      return { quantity: value * 10, unit: "ml" };
    case "l":
      return { quantity: value * 1000, unit: "ml" };
    default:
      return { quantity: null, unit: null };
  }
}

/** Wandelt die Antwort von Open Food Facts in unser Format um */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapOffProduct(raw: Record<string, any>): OffProduct | null {
  const name = String(raw.product_name_de || raw.product_name || "").trim();
  if (!name) return null;

  const n = raw.nutriments ?? {};
  const nutriments: Nutriments = {
    kcal: num(n["energy-kcal_100g"]),
    fat: num(n.fat_100g),
    saturatedFat: num(n["saturated-fat_100g"]),
    carbohydrates: num(n.carbohydrates_100g),
    sugars: num(n.sugars_100g),
    fiber: num(n.fiber_100g),
    proteins: num(n.proteins_100g),
    salt: num(n.salt_100g),
  };
  const hasNutriments = Object.values(nutriments).some((value) => value !== null);
  const { quantity, unit } = mapQuantity(raw.product_quantity, raw.product_quantity_unit);
  const ingredients = String(raw.ingredients_text_de || raw.ingredients_text || "").trim();

  return {
    name: name.slice(0, 100),
    brand: String(raw.brands ?? "").split(",")[0].trim() || null,
    quantity,
    unit,
    categoryName: mapCategory(raw.categories_tags),
    // Fehlt das Feld ganz, wissen wir nichts – das ist etwas anderes als „keine Allergene“
    allergens: Array.isArray(raw.allergens_tags) ? raw.allergens_tags : null,
    traces: Array.isArray(raw.traces_tags) ? raw.traces_tags : null,
    ingredientsText: ingredients || null,
    imageUrl: raw.image_front_small_url || null,
    nutriments: hasNutriments ? nutriments : null,
  };
}

/** Fragt Open Food Facts nach einem Barcode. null = nicht gefunden. */
export async function fetchOffProduct(barcode: string): Promise<OffProduct | null> {
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${FIELDS}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(6000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Open Food Facts antwortet mit ${response.status}`);
  const body = await response.json();
  if (body.status !== 1 || !body.product) return null;
  return mapOffProduct(body.product);
}
