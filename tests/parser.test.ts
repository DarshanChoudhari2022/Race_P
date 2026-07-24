import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { extractPdfText } from "@/lib/pdf/extractText";
import { parseRaceCard } from "@/lib/pdf/parseRaceCard";

const samplePdf = "C:/Users/choud/Desktop/Indiarace.com - india's first & foremost horse racing portal.pdf";

describe("IndiaRace PDF parser", () => {
  it.runIf(existsSync(samplePdf))("extracts all races and matches attached sample races", async () => {
    const buffer = readFileSync(samplePdf);
    const extracted = await extractPdfText(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    const result = parseRaceCard(extracted);
    expect(result.races).toHaveLength(9);

    const race4 = result.races.find((race) => race.raceNumber === 4);
    expect(race4?.time).toBe("2.30 P.M.");
    expect(race4?.distanceMetres).toBe(1400);
    expect(race4?.runners).toHaveLength(7);
    expect(race4?.runners[0]).toMatchObject({
      horseNumber: 1,
      drawNumber: 6,
      horseName: "MATISSE",
      trainer: "P Shroff",
      jockey: "S Siddharth",
    });

    const race7 = result.races.find((race) => race.raceNumber === 7);
    expect(race7?.runners.at(-1)).toMatchObject({
      horseNumber: 8,
      drawNumber: 7,
      horseName: "LIAM",
      trainer: "Nazak Chenoy",
      jockey: "Omkar Akhade",
    });
  });
});
