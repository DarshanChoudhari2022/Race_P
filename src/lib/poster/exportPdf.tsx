import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { chromium, type Browser, type LaunchOptions, type Page } from "playwright";
import { posterStyles } from "@/components/poster/posterStyles";
import type { Race } from "@/types/race";
import { ordinal } from "@/lib/utils/ordinal";
import { calculatePosterLayout } from "@/lib/poster/layoutCalculator";
import { fitHorseNameFontSize } from "@/lib/poster/textFit";

export interface PosterExport {
  fileName: string;
  bytes: Buffer;
}

export interface PosterAssetBundle {
  combinedPdf: PosterExport;
  racePdfs: PosterExport[];
  racePngs: PosterExport[];
}

let embeddedPosterStyles: Promise<string> | undefined;

export async function exportRacePdf(race: Race): Promise<PosterExport> {
  const assets = await exportPosterAssets([race], false);
  return assets.racePdfs[0];
}

export async function exportCombinedPdf(races: Race[]): Promise<PosterExport> {
  const assets = await exportPosterAssets(races, false);
  return assets.combinedPdf;
}

export async function exportRacePng(race: Race): Promise<PosterExport> {
  const assets = await exportPosterAssets([race], true);
  return assets.racePngs[0];
}

export async function exportPosterAssets(races: Race[], includePngs = true): Promise<PosterAssetBundle> {
  if (races.length === 0) {
    throw new Error("At least one race is required for poster generation.");
  }

  const styles = await exportStyles();
  const html = renderDocument(styles, races.map(renderRacePosterHtml).join(""));
  const browser = await launchChromium();
  let combinedBytes: Buffer;
  const racePngs: PosterExport[] = [];

  try {
    const page = await browser.newPage({
      viewport: { width: 945, height: 2873 },
      deviceScaleFactor: 3.125,
    });
    page.setDefaultTimeout(30_000);
    await loadPosterHtml(page, html);
    combinedBytes = Buffer.from(
      await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
      }),
    );

    if (includePngs) {
      for (let index = 0; index < races.length; index += 1) {
        await loadPosterHtml(page, renderDocument(styles, renderRacePosterHtml(races[index])));
        const bytes = await page.locator(".race-poster").screenshot({
          type: "png",
          animations: "disabled",
        });
        racePngs.push({ fileName: raceFileName(races[index], "png"), bytes });
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  const first = races[0];
  return {
    combinedPdf: {
      fileName: `${slug(first.venue)}-race-posters-${first.date}.pdf`,
      bytes: combinedBytes,
    },
    racePdfs: await splitRacePdfs(combinedBytes, races),
    racePngs,
  };
}

export async function writeSampleOutputs(races: Race[], outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const assets = await exportPosterAssets(races, false);
  await writeFile(path.join(outputDir, assets.combinedPdf.fileName), assets.combinedPdf.bytes);
  for (const pdf of assets.racePdfs) {
    await writeFile(path.join(outputDir, pdf.fileName), pdf.bytes);
  }
}

async function loadPosterHtml(page: Page, html: string): Promise<void> {
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
  });
}

async function splitRacePdfs(combinedBytes: Buffer, races: Race[]): Promise<PosterExport[]> {
  const source = await PDFDocument.load(combinedBytes);
  if (source.getPageCount() !== races.length) {
    throw new Error(`Poster PDF page count mismatch: expected ${races.length}, generated ${source.getPageCount()}.`);
  }

  return Promise.all(
    races.map(async (race, index) => {
      const document = await PDFDocument.create();
      const [page] = await document.copyPages(source, [index]);
      document.addPage(page);
      return {
        fileName: raceFileName(race, "pdf"),
        bytes: Buffer.from(await document.save()),
      };
    }),
  );
}

async function launchChromium(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch (localError) {
    const serverlessChromium = (await import("@sparticuz/chromium")).default;
    const executablePath = await serverlessChromium.executablePath();
    if (!executablePath) {
      throw new Error(
        `Chromium is not available for poster generation. Local Playwright failed: ${errorMessage(localError)}. The serverless Chromium fallback could not find its executable. Ensure @sparticuz/chromium is externalized and its bin folder is included in the deployment.`,
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

function renderDocument(styles: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${styles}</style></head><body>${body}</body></html>`;
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
    <footer class="poster-footer"><div>PRINTED BY</div><strong>CHANKA NEWS</strong><span>POWERED BY BRACKETDEX</span></footer>
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
  embeddedPosterStyles ??= loadExportStyles();
  return embeddedPosterStyles;
}

async function loadExportStyles(): Promise<string> {
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
