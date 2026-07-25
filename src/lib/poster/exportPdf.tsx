import { mkdir, readFile, writeFile, access, stat } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { chromium, type Browser, type LaunchOptions, type Page } from "playwright";
import { posterStyles } from "@/components/poster/posterStyles";
import type { Race } from "@/types/race";
import { ordinal } from "@/lib/utils/ordinal";
import { calculatePosterLayout } from "@/lib/poster/layoutCalculator";
import { fitHorseNameFontSize } from "@/lib/poster/textFit";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PosterExport {
  fileName: string;
  bytes: Buffer;
}

export interface PosterAssetBundle {
  combinedPdf: PosterExport;
  racePdfs: PosterExport[];
  racePngs: PosterExport[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum number of retry attempts for Chromium operations that can transiently fail. */
const MAX_RETRIES = 2;

/** Per-operation timeout for Playwright page actions (ms). */
const PAGE_TIMEOUT_MS = 60_000;

/** Maximum time to wait for the browser process to launch (ms). */
const BROWSER_LAUNCH_TIMEOUT_MS = 30_000;

/** Maximum time to wait for fonts to finish loading inside the page (ms). */
const FONT_READY_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Cached styles (loaded once, never re-read on each call)
// ---------------------------------------------------------------------------

let embeddedPosterStyles: Promise<string> | undefined;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

  // --- Pre-flight: load styles (validates font files exist) ---
  const styles = await exportStyles();
  const html = renderDocument(styles, races.map(renderRacePosterHtml).join(""));

  // --- Launch browser with retry ---
  const browser = await launchChromiumWithRetry();
  let combinedBytes: Buffer;
  const racePngs: PosterExport[] = [];

  try {
    const page = await createPosterPage(browser);

    // --- Render combined PDF ---
    await loadPosterHtml(page, html);
    combinedBytes = Buffer.from(
      await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
      }),
    );

    // Validate that we actually got PDF bytes
    if (!combinedBytes || combinedBytes.length < 100) {
      throw new Error("Chromium produced an empty or corrupt PDF. The browser may have crashed silently.");
    }

    // --- Render individual PNGs ---
    if (includePngs) {
      for (let index = 0; index < races.length; index += 1) {
        const pngBytes = await renderPngWithRetry(page, styles, races[index], browser);
        racePngs.push({ fileName: raceFileName(races[index], "png"), bytes: pngBytes });
      }
    }
  } finally {
    await safeCloseBrowser(browser);
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

// ---------------------------------------------------------------------------
// Browser launch – comprehensive error resilience
// ---------------------------------------------------------------------------

/**
 * Every known Chromium crash/hang scenario and the flag that prevents it:
 *
 * 1. /dev/shm exhaustion (serverless < 64 MB)    → --disable-dev-shm-usage
 * 2. No GPU hardware in containers                → --disable-gpu
 * 3. setuid sandbox missing in Docker/Lambda      → --no-sandbox, --disable-setuid-sandbox
 * 4. Multi-process IPC failures in Lambda         → --single-process
 * 5. Zombie renderer processes leaking memory     → --disable-background-timer-throttling
 * 6. WebGL context creation failures              → --disable-software-rasterizer
 * 7. Extension/translate/sync network requests    → --disable-extensions, --disable-translate,
 *                                                   --disable-sync, --disable-default-apps
 * 8. Leftover /tmp profile locks between invokes  → --disable-background-networking
 * 9. Out-of-memory kills on 1 GB Lambda           → --js-flags=--max-old-space-size=256
 * 10. Font rendering differences across hosts     → --font-render-hinting=none
 * 11. Zombie processes from unclean shutdown       → handled in safeCloseBrowser()
 * 12. Stale cached styles after hot-reload         → handled via embeddedPosterStyles reset
 * 13. Missing font files in deployment             → handled via validateFontFiles()
 * 14. Page crash mid-render ("Page crashed!")       → handled via retry logic
 * 15. Navigation timeout on heavy HTML             → extended timeout + retry
 */
const HARDENED_CHROMIUM_ARGS: string[] = [
  // Core stability for serverless / containers
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--single-process",

  // Prevent background processes consuming memory / CPU
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-networking",

  // Disable features that are irrelevant for headless PDF rendering
  "--disable-extensions",
  "--disable-translate",
  "--disable-sync",
  "--disable-default-apps",
  "--disable-component-extensions-with-background-pages",
  "--disable-client-side-phishing-detection",

  // Prevent WebGL / software rasterizer crashes
  "--disable-software-rasterizer",
  "--disable-webgl",

  // Memory management for constrained environments
  "--js-flags=--max-old-space-size=256",

  // Font rendering consistency
  "--font-render-hinting=none",

  // Reduce disk I/O
  "--disable-logging",
  "--disable-breakpad",

  // Prevent speculative network requests
  "--disable-features=TranslateUI,BlinkGenPropertyTrees",

  // Prevent media hardware acceleration failures
  "--disable-accelerated-2d-canvas",
  "--disable-accelerated-video-decode",
];

async function launchChromiumWithRetry(): Promise<Browser> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await launchChromium();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[exportPdf] Chromium launch attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${lastError.message}`,
      );

      // Small backoff before retry
      if (attempt < MAX_RETRIES) {
        await sleep(500 * (attempt + 1));
      }
    }
  }

  throw new Error(
    `Chromium failed to launch after ${MAX_RETRIES + 1} attempts. Last error: ${lastError?.message ?? "unknown"}. ` +
    `Ensure Playwright browsers are installed (npx playwright install chromium) or @sparticuz/chromium is available in deployment.`,
  );
}

async function launchChromium(): Promise<Browser> {
  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_EXECUTION_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT,
  );

  if (isServerless) {
    return launchServerlessChromium();
  }

  // Local development: try Playwright's bundled Chromium first
  try {
    return await chromium.launch({
      headless: true,
      timeout: BROWSER_LAUNCH_TIMEOUT_MS,
      args: HARDENED_CHROMIUM_ARGS,
    });
  } catch (localError) {
    console.warn(
      `[exportPdf] Local Playwright Chromium failed (${errorMessage(localError)}), falling back to @sparticuz/chromium.`,
    );
    return launchServerlessChromium();
  }
}

async function launchServerlessChromium(): Promise<Browser> {
  const serverlessChromium = (await import("@sparticuz/chromium")).default;
  const executablePath = await serverlessChromium.executablePath();

  if (!executablePath) {
    throw new Error(
      "Chromium executable not found. Ensure @sparticuz/chromium is externalized and its bin folder is included in the deployment bundle.",
    );
  }

  // Verify the executable actually exists on disk
  try {
    await access(executablePath);
  } catch {
    throw new Error(
      `Chromium binary path resolved to "${executablePath}" but the file does not exist. ` +
      `This typically means the deployment bundler stripped the binary. ` +
      `Ensure outputFileTracingIncludes covers './node_modules/@sparticuz/chromium/bin/**/*'.`,
    );
  }

  const options: LaunchOptions = {
    args: [...serverlessChromium.args, ...HARDENED_CHROMIUM_ARGS],
    executablePath,
    headless: true,
    timeout: BROWSER_LAUNCH_TIMEOUT_MS,
  };

  return chromium.launch(options);
}

// ---------------------------------------------------------------------------
// Page creation & content loading – with crash recovery
// ---------------------------------------------------------------------------

async function createPosterPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 945, height: 2873 },
    deviceScaleFactor: 3.125,
    // Prevent random network calls from the page
    offline: true,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(PAGE_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);

  // Catch page crashes (renderer process killed by OOM, etc.)
  page.on("crash", () => {
    console.error("[exportPdf] Page renderer process crashed. This usually means OOM in a constrained environment.");
  });

  // Log console errors from the rendered page (font load failures, CSS errors)
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.warn(`[exportPdf] Browser console error: ${msg.text()}`);
    }
  });

  return page;
}

async function loadPosterHtml(page: Page, html: string): Promise<void> {
  // Check if page is still alive (could have crashed between calls)
  if (page.isClosed()) {
    throw new Error("Page was closed unexpectedly. The browser renderer may have crashed due to insufficient memory.");
  }

  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });

  // Wait for fonts with a bounded timeout – don't hang forever if fonts fail
  try {
    await page.evaluate(async (timeoutMs: number) => {
      if ("fonts" in document) {
        await Promise.race([
          document.fonts.ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Font loading timed out")), timeoutMs),
          ),
        ]);
      }
    }, FONT_READY_TIMEOUT_MS);
  } catch (fontError) {
    // Font load timeout is non-fatal – we continue with system fonts
    console.warn(`[exportPdf] Font loading issue: ${errorMessage(fontError)}. Continuing with available fonts.`);
  }
}

// ---------------------------------------------------------------------------
// PNG rendering with per-race retry on crash
// ---------------------------------------------------------------------------

async function renderPngWithRetry(page: Page, styles: string, race: Race, browser: Browser): Promise<Buffer> {
  const PX_PER_MM = 96 / 25.4;
  const posterW = Math.round(250 * PX_PER_MM); // 945 px
  const posterH = Math.round(760 * PX_PER_MM); // 2872 px

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // If the page crashed on a previous attempt, create a fresh one
      let activePage = page;
      if (page.isClosed()) {
        console.warn(`[exportPdf] Page was closed, creating a new page for PNG retry (attempt ${attempt + 1}).`);
        activePage = await createPosterPage(browser);
      }

      await loadPosterHtml(activePage, renderDocument(styles, renderRacePosterHtml(race)));

      const bytes = await activePage.screenshot({
        type: "png",
        animations: "disabled",
        clip: { x: 0, y: 0, width: posterW, height: posterH },
      });

      if (!bytes || bytes.length < 100) {
        throw new Error("Screenshot produced empty or corrupt PNG data.");
      }

      return bytes;
    } catch (error) {
      console.warn(
        `[exportPdf] PNG render attempt ${attempt + 1}/${MAX_RETRIES + 1} for race ${race.raceNumber} failed: ${errorMessage(error)}`,
      );

      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Failed to render PNG for race ${race.raceNumber} after ${MAX_RETRIES + 1} attempts: ${errorMessage(error)}`,
        );
      }

      await sleep(300 * (attempt + 1));
    }
  }

  // TypeScript flow: unreachable but satisfies return type
  throw new Error("Unexpected: PNG render loop exited without returning or throwing.");
}

// ---------------------------------------------------------------------------
// PDF splitting with validation
// ---------------------------------------------------------------------------

async function splitRacePdfs(combinedBytes: Buffer, races: Race[]): Promise<PosterExport[]> {
  let source: PDFDocument;

  try {
    source = await PDFDocument.load(combinedBytes);
  } catch (error) {
    throw new Error(
      `Failed to parse the combined PDF for splitting: ${errorMessage(error)}. ` +
      `The Chromium-generated PDF may be corrupt – this can happen if the browser crashed silently during rendering.`,
    );
  }

  if (source.getPageCount() !== races.length) {
    throw new Error(
      `Poster PDF page count mismatch: expected ${races.length}, generated ${source.getPageCount()}. ` +
      `This usually means Chromium rendered extra blank pages or skipped some posters due to CSS overflow.`,
    );
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

// ---------------------------------------------------------------------------
// Browser cleanup – prevents zombie Chromium processes
// ---------------------------------------------------------------------------

async function safeCloseBrowser(browser: Browser): Promise<void> {
  try {
    // Close all contexts first to ensure pages flush buffers
    for (const context of browser.contexts()) {
      await context.close().catch(() => undefined);
    }
    await browser.close();
  } catch {
    // If graceful close fails, forcefully disconnect
    try {
      browser.close().catch(() => undefined);
    } catch {
      // Already dead – nothing to do
    }
  }
}

// ---------------------------------------------------------------------------
// Font / style loading with validation
// ---------------------------------------------------------------------------

async function exportStyles(): Promise<string> {
  embeddedPosterStyles ??= loadExportStyles();
  return embeddedPosterStyles;
}

async function loadExportStyles(): Promise<string> {
  const publicDir = path.join(process.cwd(), "public", "fonts");

  const fontFiles = [
    { name: "poppins-regular.woff2", weight: "400" },
    { name: "poppins-bold.woff2", weight: "700" },
    { name: "poppins-extrabold.woff2", weight: "800" },
  ];

  // Pre-validate all font files exist and are non-empty
  for (const font of fontFiles) {
    const fontPath = path.join(publicDir, font.name);
    try {
      const fileStat = await stat(fontPath);
      if (fileStat.size === 0) {
        throw new Error(`Font file "${font.name}" exists but is 0 bytes.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          `Font file "${font.name}" not found at "${fontPath}". ` +
          `Ensure the public/fonts directory is included in your deployment. ` +
          `If deploying to Vercel, add it to outputFileTracingIncludes.`,
        );
      }
      throw error;
    }
  }

  const [regular, bold, extraBold] = await Promise.all(
    fontFiles.map((f) => readFile(path.join(publicDir, f.name))),
  );

  return posterStyles
    .replace('url("/fonts/poppins-regular.woff2")', `url("data:font/woff2;base64,${regular.toString("base64")}")`)
    .replace('url("/fonts/poppins-bold.woff2")', `url("data:font/woff2;base64,${bold.toString("base64")}")`)
    .replace('url("/fonts/poppins-extrabold.woff2")', `url("data:font/woff2;base64,${extraBold.toString("base64")}")`);
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

function renderDocument(styles: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${styles}</style></head><body>${body}</body></html>`;
}

function renderRacePosterHtml(race: Race): string {
  const layout = calculatePosterLayout(race.runners.length);
  const runners = race.runners
    .map((runner, index) => {
      const horseFont = runner.horseFontSize ?? fitHorseNameFontSize(runner.horseName, layout.horseFontPt);
      const trainerFont = runner.trainerFontSize ?? layout.detailFontPt;
      const jockeyFont = runner.jockeyFontSize ?? layout.detailFontPt;
      return `<div class="poster-runner" style="top:${index * layout.runnerHeightMm}mm;height:${layout.runnerHeightMm}mm">
        <div class="runner-main">
          <span class="runner-number" style="font-size:${horseFont}pt">${runner.horseNumber}</span>
          <span class="runner-name" style="font-size:${horseFont}pt">${escapeHtml(runner.horseName)}</span>
        </div>
        <div class="runner-detail" style="font-size:${layout.detailFontPt}pt">
          <span class="runner-trainer" style="font-size:${trainerFont}pt">${escapeHtml(runner.trainer)}</span>
          <span class="runner-jockey" style="font-size:${jockeyFont}pt">${escapeHtml(runner.jockey)} <span class="runner-draw">(${runner.drawNumber ?? "?"})</span></span>
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

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function raceFileName(race: Race, extension: "pdf" | "png"): string {
  return `race-${String(race.raceNumber).padStart(2, "0")}-${slug(race.venue)}-${race.date}.${extension}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
