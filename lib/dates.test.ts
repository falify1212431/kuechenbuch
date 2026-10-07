import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDateDe, isWeekend, todayInBerlin } from "./dates";

describe("todayInBerlin", () => {
  it("nimmt die deutsche Zeit, nicht die Weltzeit", () => {
    // 23:30 Uhr Weltzeit am 4.10. ist in Berlin (Sommerzeit) schon 01:30 Uhr am 5.10.
    expect(todayInBerlin(new Date("2026-10-04T23:30:00Z"))).toBe("2026-10-05");
    // 22:30 Uhr Weltzeit im Winter ist in Berlin 23:30 Uhr, also noch derselbe Tag
    expect(todayInBerlin(new Date("2026-12-24T22:30:00Z"))).toBe("2026-12-24");
  });
});

describe("addDays und daysBetween", () => {
  it("rechnet über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("verliert bei der Zeitumstellung keinen Tag", () => {
    // In der Nacht zum 25.10.2026 wird die Uhr zurückgestellt
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("ist negativ, wenn das Ziel in der Vergangenheit liegt", () => {
    expect(daysBetween("2026-10-05", "2026-10-03")).toBe(-2);
    expect(daysBetween("2026-10-05", "2026-10-05")).toBe(0);
  });
});

describe("formatDateDe", () => {
  it("zeigt Daten als TT.MM.JJJJ", () => {
    expect(formatDateDe("2026-10-05")).toBe("05.10.2026");
  });
});

describe("isWeekend", () => {
  it("erkennt Samstag und Sonntag", () => {
    expect(isWeekend("2026-10-10")).toBe(true); // Samstag
    expect(isWeekend("2026-10-11")).toBe(true); // Sonntag
    expect(isWeekend("2026-10-12")).toBe(false); // Montag
    expect(isWeekend("2026-10-09")).toBe(false); // Freitag
  });
});
