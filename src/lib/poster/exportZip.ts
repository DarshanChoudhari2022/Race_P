import JSZip from "jszip";
import type { Race } from "@/types/race";
import { exportPosterAssets } from "./exportPdf";

export async function exportPosterZip(races: Race[]): Promise<{ fileName: string; bytes: Buffer }> {
  const zip = new JSZip();
  const first = races[0];
  const base = `${slug(first?.venue ?? "race")}-race-posters-${first?.date ?? "output"}`;

  const assets = await exportPosterAssets(races);
  zip.file(assets.combinedPdf.fileName, assets.combinedPdf.bytes);
  for (const pdf of assets.racePdfs) {
    zip.file(pdf.fileName, pdf.bytes);
  }
  for (const png of assets.racePngs) {
    zip.file(png.fileName, png.bytes);
  }

  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { fileName: `${base}.zip`, bytes };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
