import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type LaunchOptions } from "playwright";
import serverlessChromium from "@sparticuz/chromium";
import { posterStyles } from "@/components/poster/posterStyles";
import type { Race } from "@/types/race";
import { ordinal } from "@/lib/utils/ordinal";
import { calculatePosterLayout } from "@/lib/poster/layoutCalculator";
import { fitHorseNameFontSize } from "@/lib/poster/textFit";

export interface PosterExport {
  fileName: string;
  bytes: Buffer;
}

export async function exportRacePdf(race: Race): Promise<PosterExport> {
  const html = await renderHtml([race]);
  const bytes = await printHtmlToPdf(html);
  return { fileName: raceFileName(race, "pdf"), bytes };
}

export async function exportCombinedPdf(races: Race[]): Promise<PosterExport> {
  const html = await renderHtml(races);
  const bytes = await printHtmlToPdf(html);
  const first = races[0];
  return { fileName: `${slug(first?.venue ?? "race")}-race-posters-${first?.date ?? "output"}.pdf`, bytes };
}

export async function exportRacePng(race: Race): Promise<PosterExport> {
  const html = await renderHtml([race]);
  const browser = await launchChromium();
  try {
    const page = await browser.newPage({
      viewport: { width: 945, height: 2873 },
      deviceScaleFactor: 3.125,
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const locator = page.locator(".race-poster").first();
    const bytes = await locator.screenshot({ type: "png" });
    return { fileName: raceFileName(race, "png"), bytes };
  } finally {
    await browser.close();
  }
}

export async function writeSampleOutputs(races: Race[], outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const combined = await exportCombinedPdf(races);
  await writeFile(path.join(outputDir, combined.fileName), combined.bytes);
  for (const race of races) {
    const pdf = await exportRacePdf(race);
    await writeFile(path.join(outputDir, pdf.fileName), pdf.bytes);
  }
}

async function printHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const bytes = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(bytes);
  } finally {
    await browser.close();
  }
}

async function launchChromium(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch (localError) {
    const executablePath = await serverlessChromium.executablePath();
    if (!executablePath) {
      throw new Error(
        `Chromium is not available for poster generation. Local Playwright failed: ${errorMessage(localError)}. Run "npx playwright install chromium" locally or deploy with the bundled serverless Chromium dependency.`,
      );
    }

    const options: LaunchOptions = {
      args: [...serverlessChromium.args, "--font-render-hinting=none"],
      executablePath,
      headless: true,
    };
    return chromium.launch(options);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function renderHtml(races: Race[]): Promise<string> {
  const body = races.map(renderRacePosterHtml).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${await exportStyles()}</style></head><body>${body}</body></html>`;
}

function renderRacePosterHtml(race: Race): string {
  const layout = calculatePosterLayout(race.runners.length);
  const runners = race.runners
    .map((runner, index) => {
      const horseFont = fitHorseNameFontSize(runner.horseName, layout.horseFontPt);
      return `<div class="poster-runner" style="top:${index * layout.runnerHeightMm}mm;height:${layout.runnerHeightMm}mm">
        <div class="runner-main">
          <span class="runner-number" style="font-size:${layout.numberFontPt}pt">${runner.horseNumber}</span>
          <span class="runner-name" style="font-size:${horseFont}pt">${escapeHtml(runner.horseName)}</span>
        </div>
        <div class="runner-detail" style="font-size:${layout.detailFontPt}pt">
          <span class="runner-trainer">${escapeHtml(runner.trainer)}</span>
          <span class="runner-jockey">${escapeHtml(runner.jockey)} <span class="runner-draw">(${runner.drawNumber ?? "?"})</span></span>
        </div>
      </div>`;
    })
    .join("");

  return `<section class="race-poster">
    <header class="poster-header" style="height:${layout.headerHeightMm}mm">
      <div class="poster-date">${escapeHtml(race.date)}</div>
      <div class="poster-venue">${escapeHtml(race.venue)} RACE ${escapeHtml(race.time)}</div>
      <div class="poster-race-line"><span>${ordinal(race.raceNumber)} RACE</span><span class="poster-bracket">(${race.raceNumber})</span><span>${race.distanceMetres}M</span></div>
    </header>
    <main class="poster-runners" style="top:${layout.runnerTopMm}mm">${runners}</main>
    <footer class="poster-footer"><div>PRINTED BY</div><strong>CHANKA NEWS</strong></footer>
  </section>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function exportStyles(): Promise<string> {
  const publicDir = path.join(process.cwd(), "public", "fonts");
  const [regular, bold, extraBold] = await Promise.all([
    readFile(path.join(publicDir, "poppins-regular.woff2")),
    readFile(path.join(publicDir, "poppins-bold.woff2")),
    readFile(path.join(publicDir, "poppins-extrabold.woff2")),
  ]);
  return posterStyles
    .replace('url("/fonts/poppins-regular.woff2")', `url("data:font/woff2;base64,${regular.toString("base64")}")`)
    .replace('url("/fonts/poppins-bold.woff2")', `url("data:font/woff2;base64,${bold.toString("base64")}")`)
    .replace('url("/fonts/poppins-extrabold.woff2")', `url("data:font/woff2;base64,${extraBold.toString("base64")}")`);
}

function raceFileName(race: Race, extension: "pdf" | "png"): string {
  return `race-${String(race.raceNumber).padStart(2, "0")}-${slug(race.venue)}-${race.date}.${extension}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
