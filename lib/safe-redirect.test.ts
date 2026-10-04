import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("erlaubt Pfade innerhalb der App", () => {
    expect(safeRedirectPath("/")).toBe("/");
    expect(safeRedirectPath("/vorrat")).toBe("/vorrat");
    expect(safeRedirectPath("/vorrat?ansicht=lagerort#kuehlschrank")).toBe(
      "/vorrat?ansicht=lagerort#kuehlschrank",
    );
  });

  it("nimmt die Startseite, wenn kein Ziel angegeben ist", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
  });

  it("blockiert fremde Websites", () => {
    expect(safeRedirectPath("https://boese.example")).toBe("/");
    expect(safeRedirectPath("http://boese.example/login")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
  });

  it("blockiert versteckte Tricks, die Browser als fremde Adresse lesen", () => {
    expect(safeRedirectPath("//boese.example")).toBe("/");
    expect(safeRedirectPath("/\\boese.example")).toBe("/");
    expect(safeRedirectPath("/\t/boese.example")).toBe("/");
  });

  it("nutzt auf Wunsch ein anderes Ersatzziel", () => {
    expect(safeRedirectPath("https://boese.example", "/login")).toBe("/login");
  });
});
