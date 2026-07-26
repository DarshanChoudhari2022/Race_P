import type { ExtractionResult, Race, Runner } from "@/types/race";
import type { ExtractedPdf, PdfLine, PdfWord } from "./extractText";
import { formatRaceDate } from "@/lib/utils/date";
import { formatRaceTime } from "@/lib/utils/time";
import { normalizeText, titleKeepInitials } from "@/lib/utils/text";

interface PendingRunner extends Runner {
  trainerParts: string[];
  jockeyParts: string[];
  started: boolean;
}

export function parseRaceCard(extracted: ExtractedPdf): ExtractionResult {
  const warnings: string[] = [];
  const races: Race[] = [];
  let venue = "PUNE";
  let date = "";

  for (const line of extracted.lines) {
    const meta = line.text.match(/Race Card\s*-\s*([A-Za-z ]+)\s*-\s*(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i);
    if (meta) {
      venue = normalizeText(meta[1]).toUpperCase();
      date = formatRaceDate(meta[2]);
      break;
    }
  }

  let current: Race | null = null;
  let tableMode = false;
  let pending: PendingRunner | null = null;

  const finalizePending = () => {
    if (!current || !pending) return;
    pending.trainer = normalizeTrainerName(pending.trainerParts);
    pending.jockey = titleKeepInitials(pending.jockeyParts.join(" "));
    pending.horseName = normalizeText(pending.horseName).toUpperCase();
    const runnerWarnings = validateRunner(pending);
    current.runners.push({
      horseNumber: pending.horseNumber,
      drawNumber: pending.drawNumber,
      horseName: pending.horseName,
      trainer: pending.trainer,
      jockey: pending.jockey,
      confidence: runnerWarnings.length ? "needs_review" : "high",
      warnings: runnerWarnings,
    });
    pending = null;
  };

  for (let index = 0; index < extracted.lines.length; index += 1) {
    const line = extracted.lines[index];
    if (isPageChrome(line)) continue;
    const header = detectRaceHeader(extracted.lines, index);
    if (header) {
      finalizePending();
      current = {
        date: date || header.date || "",
        venue,
        raceNumber: header.raceNumber,
        time: header.time,
        distanceMetres: header.distanceMetres,
        runners: [],
      };
      races.push(current);
      tableMode = false;
      continue;
    }

    if (!current) continue;

    if (/^No\s+Silk\s+Horse\/Pedigree/i.test(line.text)) {
      finalizePending();
      tableMode = true;
      continue;
    }

    if (/^(INDIARACE SELECTIONS|Medical Reports|Go to Top)/i.test(line.text)) {
      finalizePending();
      tableMode = false;
      continue;
    }

    if (!tableMode) continue;

    const starter = getRunnerNumber(line);
    if (starter !== null) {
      finalizePending();
      pending = {
        horseNumber: starter,
        drawNumber: null,
        horseName: extractHorseName(line),
        trainer: "",
        jockey: "",
        trainerParts: [],
        jockeyParts: [],
        started: true,
      };
    }

    if (!pending) continue;
    collectRunnerLine(pending, line);
  }

  finalizePending();

  for (const race of races) {
    const raceWarnings = validateRace(race);
    race.warnings = raceWarnings;
    race.confidence = raceWarnings.length ? "needs_review" : "high";
  }

  if (races.length === 0) warnings.push("No races were detected from the native PDF text.");
  return { races, source: "native_pdf_text", warnings };
}

function detectRaceHeader(lines: PdfLine[], index: number): { raceNumber: number; time: string; distanceMetres: number; date?: string } | null {
  const line = lines[index];
  const single = line.words.length === 1 ? line.words[0] : null;
  if (!single || !/^\d{1,2}$/.test(single.text) || single.x0 < 80 || single.x0 > 155) return null;

  const window: PdfLine[] = [];
  for (let i = index + 1; i < lines.length && window.length < 12; i++) {
    if (!isPageChrome(lines[i])) {
      window.push(lines[i]);
    }
  }

  const distanceLine = window.find((candidate) => /\b(\d{3,4})\s*M\b/i.test(candidate.text));
  const timeLine = window.find((candidate) => /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i.test(candidate.text));
  if (!distanceLine || !timeLine) return null;

  const distance = distanceLine.text.match(/\b(\d{3,4})\s*M\b/i);
  const time = timeLine.text.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/i);
  if (!distance || !time) return null;

  return {
    raceNumber: Number(single.text),
    distanceMetres: Number(distance[1]),
    time: formatRaceTime(time[1]),
  };
}

function getRunnerNumber(line: PdfLine): number | null {
  const numberWord = line.words.find((word) => word.x0 >= 24 && word.x1 <= 55 && /^\d{1,2}$/.test(word.text));
  if (!numberWord) return null;
  const hasHorseText = line.words.some((word) => word.x0 >= 78 && word.x0 <= 260 && /^[A-Za-z0-9'().-]+$/.test(word.text));
  return hasHorseText ? Number(numberWord.text) : null;
}

function extractHorseName(line: PdfLine): string {
  const parts: string[] = [];
  for (const word of line.words) {
    if (word.x0 < 78 || word.x0 > 260) continue;
    if (isHorseDescriptor(word.text)) break;
    if (/^(Last|Ex-Name:)/i.test(word.text)) break;
    parts.push(word.text);
  }
  return parts.join(" ");
}

function collectRunnerLine(runner: PendingRunner, line: PdfLine): void {
  const draw = line.words.find((word) => word.x0 >= 20 && word.x1 <= 60 && /^\((\d{1,2})\)$/.test(word.text));
  if (draw) runner.drawNumber = Number(draw.text.replace(/\D/g, ""));

  const trainerWords = line.words.filter((word) => word.x0 >= 335 && word.x0 < 390 && isNameToken(word));
  const jockeyWords = line.words.filter((word) => word.x0 >= 390 && word.x0 < 450 && isNameToken(word));

  runner.trainerParts.push(...trainerWords.map((word) => word.text));
  runner.jockeyParts.push(...jockeyWords.map((word) => word.text));
}

function isPageChrome(line: PdfLine): boolean {
  return (
    /Indiarace\.com - india's first & foremost horse racing portal/i.test(line.text) ||
    /^https:\/\/www\.indiarace\.com\//i.test(line.text)
  );
}

function isHorseDescriptor(text: string): boolean {
  return /^(\d+y|[bcdghkmfs]{1,4}|dkb)$/i.test(text);
}

function isNameToken(word: PdfWord): boolean {
  if (!/^[A-Za-z'.-]+$/.test(word.text)) return false;
  if (/^(A|S|TS|BLK|CNB|HOOD|SSCP|Last|runs|Mr|Mrs|Ms|Dr|rep|rep\.|by|Pvt|Ltd|LLP|Co)$/i.test(word.text)) {
    return /^[A-Z]$/.test(word.text);
  }
  return true;
}

function validateRunner(runner: Runner): string[] {
  const warnings: string[] = [];
  if (!runner.horseName) warnings.push("Horse name missing.");
  if (!runner.trainer) warnings.push("Trainer missing.");
  if (!runner.jockey) warnings.push("Jockey missing.");
  if (!runner.drawNumber) warnings.push("Draw number missing.");
  return warnings;
}

function normalizeTrainerName(parts: string[]): string {
  const cleaned = parts.map((part) => part.replace(/[,\s]+$/g, "")).filter(Boolean);
  while (cleaned.length > 2 && /^([A-Z]|[A-Z]\.|Co|Ltd|LLP|Pvt)$/i.test(cleaned.at(-1) ?? "")) cleaned.pop();
  if (cleaned.length >= 4 && /^[A-Z]$/.test(cleaned[0]) && isFullNameToken(cleaned[1])) cleaned.shift();
  if (cleaned.length === 3 && cleaned[0] === "Z" && /^[A-Z]$/.test(cleaned[1]) && isFullNameToken(cleaned[2])) cleaned.shift();
  return titleKeepInitials(cleaned.join(" "));
}

function isFullNameToken(value: string): boolean {
  return /^[A-Za-z'.-]{3,}$/.test(value) && !/^[A-Z]{2,}$/.test(value);
}

function validateRace(race: Race): string[] {
  const warnings: string[] = [];
  if (!race.date) warnings.push("Race date missing.");
  if (!race.time) warnings.push("Race time missing.");
  if (!race.distanceMetres) warnings.push("Distance missing.");
  if (race.runners.length === 0) warnings.push("No runners detected.");
  const horseNumbers = new Set<number>();
  for (const runner of race.runners) {
    if (horseNumbers.has(runner.horseNumber)) warnings.push(`Duplicate horse number ${runner.horseNumber}.`);
    horseNumbers.add(runner.horseNumber);
  }
  return warnings;
}
