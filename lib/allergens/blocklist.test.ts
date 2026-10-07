import { describe, expect, it } from "vitest";
import { findBlocked } from "./blocklist";

const reason = (texts: string[], custom?: string[]) => findBlocked(texts, custom)?.reason ?? null;

describe("Sperrliste: Erdnuss", () => {
  it.each([
    "Erdnussöl",
    "2 EL Erdnussbutter",
    "Hähnchen mit Erdnusssauce",
    "geröstete Erdnüsse",
    "ERDNUSSMUS",
    "Peanut butter",
    "Arachis-Öl",
    "Hähnchen-Saté-Spieße",
    "Satay-Sauce",
    "Gado-Gado",
    "Gado Gado Salat",
    "Kung-Pao-Hähnchen",
    "Pad Thai",
    "Mafé mit Huhn",
    "Erdnussflips",
    "Studentenfutter",
    "1 Handvoll Nussmischung",
    "gemischte Nüsse",
    "Snickers-Kuchen",
  ])("sperrt „%s“", (text) => {
    expect(reason([text])).toBe("erdnuss");
  });

  it("sperrt auch „ohne Erdnüsse“ – lieber ein Vorschlag weniger", () => {
    expect(reason(["Pad Thai ohne Erdnüsse"])).toBe("erdnuss");
    expect(reason(["Curry", "Tipp: statt Erdnüssen Cashews nehmen"])).toBe("erdnuss");
  });

  it("findet Erdnuss irgendwo in Zutaten oder Schritten", () => {
    expect(reason(["Gemüsepfanne", "Paprika", "Zwiebel", "Mit gehackten Erdnüssen bestreuen."])).toBe("erdnuss");
  });
});

describe("Sperrliste: Kokos", () => {
  it.each(["Kokosmilch", "1 Dose Kokosnussmilch", "Kokosöl", "Kokosraspeln", "Kokosblütenzucker", "coconut milk", "Piña Colada", "Laksa", "Tom Kha Gai", "Raffaello-Torte"])(
    "sperrt „%s“",
    (text) => {
      expect(reason([text])).toBe("kokos");
    },
  );
});

describe("Sperrliste: saurer/eingelegter Fisch", () => {
  it.each([
    "Rollmops",
    "Bratrollmops",
    "Bismarckhering",
    "Brathering",
    "saurer Hering",
    "sauren Hering",
    "marinierter Hering",
    "eingelegter Fisch",
    "Hering, sauer eingelegt",
    "Heringssalat",
    "Matjesfilet",
    "Matjes nach Hausfrauenart",
    "Sardellenfilets",
    "Anchovis",
    "1 TL Worcestershiresauce",
    "Ceviche",
    "Sauerlappen",
  ])("sperrt „%s“", (text) => {
    expect(reason([text])).toBe("fisch");
  });

  it.each(["Graved Lachs", "gebeizter Lachs", "Räucherlachs", "Thunfisch in Öl", "Sardinen in Tomatensauce", "Lachsfilet aus dem Ofen", "Fischstäbchen"])(
    "lässt „%s“ durch",
    (text) => {
      expect(reason([text])).toBeNull();
    },
  );
});

describe("Sperrliste: harmlose Gerichte", () => {
  it.each([
    ["Spaghetti Bolognese", "Hackfleisch", "Tomaten", "Zwiebel"],
    ["Gemüse-Curry", "Kichererbsen", "Spinat", "Sahne", "Currypulver"],
    ["Ofenkartoffeln mit Quark", "Kartoffeln", "Kräuterquark"],
    ["Satt und zufrieden: Linseneintopf", "Linsen", "Möhren"],
    ["Cashew-Hähnchen", "Cashewkerne", "Paprika"],
    ["Mandel-Brokkoli", "Mandeln", "Brokkoli"],
  ])("lässt „%s“ durch", (...texts) => {
    expect(findBlocked(texts)).toBeNull();
  });
});

describe("Sperrliste: eigene Begriffe aus den Vorlieben", () => {
  it("sperrt eigene Begriffe, auch in zusammengesetzten Wörtern", () => {
    expect(findBlocked(["Knollensellerie-Püree"], ["Sellerie"])).toEqual({ reason: "eigene", term: "Sellerie" });
    expect(reason(["Rosenkohl-Auflauf"], ["Rosenkohl"])).toBe("eigene");
  });

  it("vergleicht ohne Groß-/Kleinschreibung und mit Umlauten", () => {
    expect(reason(["Gefüllte Pilze"], ["PILZE"])).toBe("eigene");
    expect(reason(["Rührei"], ["rührei"])).toBe("eigene");
  });

  it("kurze Begriffe zählen nur am Wortanfang", () => {
    expect(reason(["Rührei mit Speck", "2 Eier"], ["Ei"])).toBe("eigene");
    expect(reason(["Reis mit Gemüse"], ["Ei"])).toBeNull();
  });

  it("ignoriert leere Begriffe und solche mit Sonderzeichen sicher", () => {
    expect(reason(["Nudeln"], ["", " ", "a"])).toBeNull();
    expect(reason(["Nudeln (Vollkorn)"], ["(Vollkorn)"])).toBe("eigene");
  });

  it("feste Sperren gelten auch ohne eigene Begriffe", () => {
    expect(reason(["Kokos-Curry"], [])).toBe("kokos");
  });
});
