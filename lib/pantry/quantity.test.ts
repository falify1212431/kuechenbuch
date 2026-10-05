import { describe, expect, it } from "vitest";
import { applyRemaining, formatQuantity, sliderStep } from "./quantity";

describe("applyRemaining: Menge abziehen", () => {
  it("setzt die Restmenge", () => {
    expect(applyRemaining(500, 200)).toEqual({ quantity: 200, usedUp: false });
    expect(applyRemaining(1, 0.5)).toEqual({ quantity: 0.5, usedUp: false });
  });

  it("bei 0 ist alles verbraucht", () => {
    expect(applyRemaining(3, 0)).toEqual({ quantity: 0, usedUp: true });
  });

  it("bleibt zwischen 0 und der bisherigen Menge", () => {
    expect(applyRemaining(2, 5)).toEqual({ quantity: 2, usedUp: false });
    expect(applyRemaining(2, -1)).toEqual({ quantity: 0, usedUp: true });
  });

  it("rundet auf zwei Nachkommastellen", () => {
    expect(applyRemaining(1, 1 / 3).quantity).toBe(0.33);
  });
});

describe("sliderStep und formatQuantity", () => {
  it("wählt passende Schritte", () => {
    expect(sliderStep("g", 500)).toBe(10);
    expect(sliderStep("ml", 50)).toBe(1);
    expect(sliderStep("Packung", 1)).toBe(0.25);
  });

  it("schreibt Mengen auf Deutsch", () => {
    expect(formatQuantity(1.5, "Packung")).toBe("1,5 Packung");
    expect(formatQuantity(500, "g")).toBe("500 g");
    expect(formatQuantity(3, "Stück")).toBe("3 Stück");
  });
});
