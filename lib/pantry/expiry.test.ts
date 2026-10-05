import { describe, expect, it } from "vitest";
import { countDue, effectiveDate, expiryInfo } from "./expiry";

const TODAY = "2026-10-05";

describe("expiryInfo: Farben laut SPEC", () => {
  it("rot, wenn heute oder schon abgelaufen", () => {
    expect(expiryInfo("2026-10-05", "mhd", TODAY).level).toBe("rot");
    expect(expiryInfo("2026-10-01", "mhd", TODAY).level).toBe("rot");
  });

  it("gelb bei 1 bis 3 Tagen", () => {
    expect(expiryInfo("2026-10-06", "mhd", TODAY).level).toBe("gelb");
    expect(expiryInfo("2026-10-08", "mhd", TODAY).level).toBe("gelb");
  });

  it("grün ab 4 Tagen", () => {
    expect(expiryInfo("2026-10-09", "mhd", TODAY).level).toBe("gruen");
  });

  it("grau ohne Datum", () => {
    expect(expiryInfo(null, "mhd", TODAY)).toEqual({ level: "grau", daysLeft: null, label: "ohne Datum" });
  });

  it("schreibt verständliche Texte", () => {
    expect(expiryInfo("2026-10-06", "mhd", TODAY).label).toBe("morgen");
    expect(expiryInfo("2026-10-07", "mhd", TODAY).label).toBe("in 2 Tagen");
    expect(expiryInfo("2026-10-04", "mhd", TODAY).label).toBe("seit gestern abgelaufen");
    expect(expiryInfo("2026-10-02", "mhd", TODAY).label).toBe("seit 3 Tagen abgelaufen");
    expect(expiryInfo("2026-10-20", "mhd", TODAY).label).toBe("noch 15 Tage");
  });
});

describe("expiryInfo: MHD vs. Verbrauchsdatum", () => {
  it("MHD abgelaufen: meist noch gut, prüfen", () => {
    expect(expiryInfo("2026-10-03", "mhd", TODAY).hint).toBe("Abgelaufen, aber meist noch gut – prüfen");
  });

  it("Verbrauchsdatum abgelaufen: nicht mehr essen", () => {
    expect(expiryInfo("2026-10-03", "verbrauch", TODAY).hint).toBe("Nicht mehr essen");
  });

  it("Verbrauchsdatum heute: heute verbrauchen", () => {
    expect(expiryInfo("2026-10-05", "verbrauch", TODAY).hint).toBe("Heute verbrauchen");
  });
});

describe("effectiveDate: „Geöffnet“ verkürzt die Haltbarkeit", () => {
  it("nimmt die Faustregel, wenn sie früher endet als das aufgedruckte Datum", () => {
    // Milch: MHD in 10 Tagen, geöffnet heute, hält offen 3 Tage
    expect(effectiveDate({ date: "2026-10-15", openedAt: "2026-10-05", daysOpened: 3 })).toBe("2026-10-08");
  });

  it("behält das aufgedruckte Datum, wenn das früher ist", () => {
    expect(effectiveDate({ date: "2026-10-06", openedAt: "2026-10-05", daysOpened: 3 })).toBe("2026-10-06");
  });

  it("ändert nichts, solange nicht geöffnet oder keine Regel bekannt", () => {
    expect(effectiveDate({ date: "2026-10-15", openedAt: null, daysOpened: 3 })).toBe("2026-10-15");
    expect(effectiveDate({ date: "2026-10-15", openedAt: "2026-10-05", daysOpened: null })).toBe("2026-10-15");
  });

  it("nimmt die Faustregel, wenn gar kein Datum eingetragen ist", () => {
    expect(effectiveDate({ date: null, openedAt: "2026-10-05", daysOpened: 4 })).toBe("2026-10-09");
    expect(effectiveDate({ date: null, openedAt: null, daysOpened: 4 })).toBeNull();
  });
});

describe("countDue: Leiste oben", () => {
  it("zählt heute/abgelaufen und die nächsten 3 Tage getrennt", () => {
    const infos = ["2026-10-01", "2026-10-05", "2026-10-06", "2026-10-08", "2026-10-09"].map((d) =>
      expiryInfo(d, "mhd", TODAY),
    );
    infos.push(expiryInfo(null, "mhd", TODAY));
    expect(countDue(infos)).toEqual({ dueNow: 2, dueSoon: 2 });
  });
});
