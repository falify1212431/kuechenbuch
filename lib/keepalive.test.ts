import { describe, expect, it } from "vitest";
import { isCronRequest } from "./keepalive";

describe("isCronRequest", () => {
  const secret = "ein-langes-geheimnis-123";

  it("lässt den richtigen Schlüssel durch", () => {
    expect(isCronRequest(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("lehnt falsche oder fehlende Schlüssel ab", () => {
    expect(isCronRequest("Bearer falsch", secret)).toBe(false);
    expect(isCronRequest(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isCronRequest(secret, secret)).toBe(false);
    expect(isCronRequest(null, secret)).toBe(false);
  });

  it("lehnt alles ab, wenn kein (oder ein zu kurzes) Geheimnis eingestellt ist", () => {
    expect(isCronRequest("Bearer undefined", undefined)).toBe(false);
    expect(isCronRequest("Bearer kurz", "kurz")).toBe(false);
  });
});
