import JSZip from "jszip";
import type { Race } from "@/types/race";
import { exportCombinedPdf, exportRacePdf, exportRacePng } from "./exportPdf";

export async function exportPosterZip(races: Race[]): Promise<{ fileName: string; bytes: Buffer }> {
  const zip = new JSZip();
  const first = races[0];
  const base = `${slug(first?.venue ?? "race")}-race-posters-${first?.date ?? "output"}`;

  const combined = await exportCombinedPdf(races);
  zip.file(combined.fileName, combined.bytes);

  for (const race of races) {
    const pdf = await exportRacePdf(race);
    zip.file(pdf.fileName, pdf.bytes);
    const png = await exportRacePng(race);
    zip.file(png.fileName, png.bytes);
  }

  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { fileName: `${base}.zip`, bytes };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
