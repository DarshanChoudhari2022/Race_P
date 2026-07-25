import JSZip from "jszip";
import type { Race } from "@/types/race";
import { exportPosterAssets } from "./exportPdf";

export async function exportPosterZip(races: Race[]): Promise<{ fileName: string; bytes: Buffer }> {
  if (!races || races.length === 0) {
    throw new Error("Cannot generate ZIP: no races provided.");
  }

  const zip = new JSZip();
  const first = races[0];
  const base = `${slug(first?.venue ?? "race")}-race-posters-${first?.date ?? "output"}`;

  let assets;
  try {
    assets = await exportPosterAssets(races);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Poster asset generation failed: ${msg}`);
  }

  // Validate assets before zipping
  if (!assets.combinedPdf.bytes || assets.combinedPdf.bytes.length === 0) {
    throw new Error("Combined PDF is empty — Chromium may have produced corrupt output.");
  }

  zip.file(assets.combinedPdf.fileName, assets.combinedPdf.bytes);

  for (const pdf of assets.racePdfs) {
    if (pdf.bytes.length > 0) {
      zip.file(pdf.fileName, pdf.bytes);
    } else {
      console.warn(`[exportZip] Skipping empty PDF: ${pdf.fileName}`);
    }
  }

  for (const png of assets.racePngs) {
    if (png.bytes.length > 0) {
      zip.file(png.fileName, png.bytes);
    } else {
      console.warn(`[exportZip] Skipping empty PNG: ${png.fileName}`);
    }
  }

  let bytes: Buffer;
  try {
    bytes = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 1 },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`ZIP compression failed: ${msg}. This may indicate insufficient memory.`);
  }

  if (!bytes || bytes.length === 0) {
    throw new Error("Generated ZIP file is empty.");
  }

  return { fileName: `${base}.zip`, bytes };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
