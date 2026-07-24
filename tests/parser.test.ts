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

    const referenceRaces = [
      {
        raceNumber: 4,
        time: "2.30 P.M.",
        distanceMetres: 1400,
        runners: [
          [1, 6, "MATISSE", "P Shroff", "S Siddharth"],
          [2, 3, "QUEEN OF BEAUTIES", "Aman Hussain", "Akshay Kumar"],
          [3, 1, "DIEGO GARCIA", "Adhiraj S Jodha", "Ramswarup"],
          [4, 7, "CALIPH", "Karthik Ganapathy", "Bharat Singh"],
          [5, 2, "HEAVEN'S RHYTHM", "M Narredu", "S J Sunil"],
          [6, 4, "WINGS OF FURY", "Adhiraj S Jodha", "Shrikant Kamble"],
          [7, 5, "DEDICATION", "Shazaan Shah", "Neeraj Rawal"],
        ],
      },
      {
        raceNumber: 5,
        time: "3.00 P.M.",
        distanceMetres: 1000,
        runners: [
          [1, 2, "ELEVATE", "Deepesh Narredu", "S J Sunil"],
          [2, 5, "BLUE JET", "Deepesh Narredu", "P Trevor"],
          [3, 6, "ROCK ARMOUR", "P S Chouhan", "C S Jodha"],
          [4, 3, "AMELIA EARHART", "P S Chouhan", "P P Dhebe"],
          [5, 1, "BLUE EYED GIRL", "M Narredu", "P Vinod"],
          [6, 4, "SAFFRON GLOW", "Deepesh Narredu", "A S Peter"],
          [7, 7, "TRANQUILA", "P S Chouhan", "Shrikant Kamble"],
        ],
      },
      {
        raceNumber: 6,
        time: "3.30 P.M.",
        distanceMetres: 1200,
        runners: [
          [1, 2, "CHELSEA", "P S Chouhan", "Bharat Singh"],
          [2, 6, "NEPTUNE", "Adhiraj S Jodha", "Ramswarup"],
          [3, 4, "STORM MAJESTY", "Aman Hussain", "A Sandesh"],
          [4, 5, "PINNACLE", "M Narredu", "P Trevor"],
          [5, 10, "TREASURE GOLD", "Bezan Chenoy", "T S Jodha"],
          [6, 11, "LORD MURPHY", "Shazaan Shah", "S Mosin"],
          [7, 9, "ALEXANDRIA", "Altamash A Ahmed", "S Siddharth"],
          [8, 7, "MARATHA ADMIRAL", "M K Jadhav", "N S Parmar"],
          [9, 8, "GIANT GOLD", "Shazaan Shah", "Aditya Waydande"],
          [10, 12, "LORENZO", "P Shroff", "R Ajinkya"],
          [11, 3, "EMPOWER", "Nazak Chenoy", "Omkar Akhade"],
          [12, 1, "MAJESTICUS", "Narendra Lagad", "K Nazil"],
        ],
      },
      {
        raceNumber: 7,
        time: "4.00 P.M.",
        distanceMetres: 1400,
        runners: [
          [1, 5, "ZAFFERANO", "Adhiraj S Jodha", "R Ajinkya"],
          [2, 8, "ROSARIO", "P Shroff", "Kirtish Bhagat"],
          [3, 4, "AXLROD", "Nosher Cama", "T S Jodha"],
          [4, 2, "EMPEROR RODERIC", "Shazaan Shah", "S Mosin"],
          [5, 3, "SPANISH EYES", "Dallas Todywalla", "Akshay Kumar"],
          [6, 6, "ASHWA BRAZIL", "S N Joshi", "S Siddharth"],
          [7, 1, "TYRANNUS", "Imtiaz A Sait", "P Trevor"],
          [8, 7, "LIAM", "Nazak Chenoy", "Omkar Akhade"],
        ],
      },
    ];

    for (const expected of referenceRaces) {
      const race = result.races.find((item) => item.raceNumber === expected.raceNumber);
      expect(race).toMatchObject({
        date: "24-07-2026",
        venue: "PUNE",
        raceNumber: expected.raceNumber,
        time: expected.time,
        distanceMetres: expected.distanceMetres,
      });
      expect(race?.runners.map((runner) => [
        runner.horseNumber,
        runner.drawNumber,
        runner.horseName,
        runner.trainer,
        runner.jockey,
      ])).toEqual(expected.runners);
    }

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
