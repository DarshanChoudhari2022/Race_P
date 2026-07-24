import { readFileSync } from "node:fs";
import path from "node:path";
import { extractPdfText } from "@/lib/pdf/extractText";
import { parseRaceCard } from "@/lib/pdf/parseRaceCard";
import { writeSampleOutputs } from "@/lib/poster/exportPdf";

async function main() {
  const pdf = process.argv[2] ?? "C:/Users/choud/Desktop/Indiarace.com - india's first & foremost horse racing portal.pdf";
  const bytes = readFileSync(pdf);
  const extracted = await extractPdfText(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const parsed = parseRaceCard(extracted);
  await writeSampleOutputs(parsed.races, path.join(process.cwd(), "output", "pdf"));
  console.log(`Generated ${parsed.races.length} race PDFs in output/pdf`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
