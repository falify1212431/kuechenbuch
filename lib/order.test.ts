import { describe, expect, it } from "vitest";
import { moveInList } from "./order";

describe("moveInList", () => {
  const ids = ["obst", "gemuese", "milch"];

  it("verschiebt nach oben und unten", () => {
    expect(moveInList(ids, "gemuese", -1)).toEqual(["gemuese", "obst", "milch"]);
    expect(moveInList(ids, "gemuese", 1)).toEqual(["obst", "milch", "gemuese"]);
  });

  it("geht nicht über den Rand hinaus", () => {
    expect(moveInList(ids, "obst", -1)).toBeNull();
    expect(moveInList(ids, "milch", 1)).toBeNull();
  });

  it("ignoriert Unbekanntes und ändert die Originalliste nicht", () => {
    expect(moveInList(ids, "tk", 1)).toBeNull();
    moveInList(ids, "obst", 1);
    expect(ids).toEqual(["obst", "gemuese", "milch"]);
  });
});
