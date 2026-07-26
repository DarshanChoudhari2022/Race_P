import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { extractPdfText } from "@/lib/pdf/extractText";
import { parseRaceCard } from "@/lib/pdf/parseRaceCard";

const samplePdf = "C:/Users/choud/Desktop/Indiarace.com - india's first & foremost horse racing portal.pdf";

describe("IndiaRace PDF parser", () => {
  it.runIf(existsSync(samplePdf))("extracts all races and preserves trainer initials", async () => {
    const buffer = readFileSync(samplePdf);
    const extracted = await extractPdfText(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    const result = parseRaceCard(extracted);
    expect(result.races).toHaveLength(8);

    const race1 = result.races.find((race) => race.raceNumber === 1);
    expect(race1?.time).toBe("1.10 P.M.");
    expect(race1?.distanceMetres).toBe(1100);
    expect(race1?.runners).toHaveLength(13);

    const speedyQueen = race1?.runners.find((r) => r.horseName === "SPEEDY QUEEN");
    expect(speedyQueen).toMatchObject({
      horseNumber: 11,
      drawNumber: 2,
      horseName: "SPEEDY QUEEN",
      trainer: "L V R Deshmukh",
      jockey: "Akshay Kumar",
    });

    const missLovelyAngel = race1?.runners.find((r) => r.horseName === "MISS LOVELY ANGEL");
    expect(missLovelyAngel).toMatchObject({
      horseNumber: 9,
      drawNumber: 13,
      horseName: "MISS LOVELY ANGEL",
      trainer: "G Shashikanth",
      jockey: "Rafique Sk",
    });

    const race7 = result.races.find((race) => race.raceNumber === 7);
    expect(race7).toBeDefined();
    expect(race7?.time).toBe("4.30 P.M.");
    expect(race7?.distanceMetres).toBe(1200);
    expect(race7?.runners).toHaveLength(11);

    const lashka = race7?.runners.find((r) => r.horseName === "LASHKA");
    expect(lashka).toMatchObject({
      horseNumber: 6,
      drawNumber: 5,
      horseName: "LASHKA",
      trainer: "L V R Deshmukh",
      jockey: "P Trevor",
    });

    const race8 = result.races.find((race) => race.raceNumber === 8);
    expect(race8).toBeDefined();
    expect(race8?.runners).toHaveLength(16);
  });
});
