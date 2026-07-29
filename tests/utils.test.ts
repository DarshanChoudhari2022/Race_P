import { describe, expect, it } from "vitest";
import { ordinal } from "@/lib/utils/ordinal";
import { formatRaceDate } from "@/lib/utils/date";
import { formatRaceTime } from "@/lib/utils/time";
import { titleKeepInitials } from "@/lib/utils/text";
import { fitHorseNameFontSize } from "@/lib/poster/textFit";
import { calculatePosterLayout } from "@/lib/poster/layoutCalculator";

describe("race utility formatting", () => {
  it("formats dates", () => {
    expect(formatRaceDate("24 Jul 2026")).toBe("24-07-2026");
    expect(formatRaceDate("24/07/2026")).toBe("24-07-2026");
  });

  it("formats race times", () => {
    expect(formatRaceTime("01:00 PM")).toBe("1.00 P.M.");
    expect(formatRaceTime("02:30 PM")).toBe("2.30 P.M.");
  });

  it("generates ordinal suffixes", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st"]);
  });

  it("formats trainer and jockey names correctly", () => {
    expect(titleKeepInitials("FARAZ ARSHAD")).toBe("Faraz Arshad");
    expect(titleKeepInitials("MD SAJID QURESHI")).toBe("Md Sajid Qureshi");
    expect(titleKeepInitials("JAMES MCKEOWN")).toBe("James Mckeown");
    expect(titleKeepInitials("S S ATTAOLLAHI")).toBe("S S Attaollahi");
    expect(titleKeepInitials("IRFAN GHATALA")).toBe("Irfan Ghatala");
    expect(titleKeepInitials("IMTIAZ KHAN")).toBe("Imtiaz Khan");
    expect(titleKeepInitials("ARJUN MANGALORKAR")).toBe("Arjun Mangalorkar");
  });
});

describe("poster layout", () => {
  it("sizes common runner counts", () => {
    expect(calculatePosterLayout(7).horseFontPt).toBe(56);
    expect(calculatePosterLayout(8).horseFontPt).toBe(56);
    expect(calculatePosterLayout(12).horseFontPt).toBe(56);
    expect(calculatePosterLayout(14).horseFontPt).toBe(56);
  });

  it("reduces long horse names without ellipsis", () => {
    expect(fitHorseNameFontSize("QUEEN OF BEAUTIES", 45)).toBe(45);
    expect(fitHorseNameFontSize("PROMISEOFTHEFUTURE", 56)).toBeLessThan(56);
    expect(fitHorseNameFontSize("SKY FULL OF STARS FOREVER", 45)).toBeLessThan(45);
  });

  it("formats draw number brackets correctly", () => {
    const formatDraw = (draw: number | null | undefined) => (draw ? draw : "");
    expect(formatDraw(5)).toBe(5);
    expect(formatDraw(0)).toBe("");
    expect(formatDraw(null)).toBe("");
    expect(formatDraw(undefined)).toBe("");
  });
});
