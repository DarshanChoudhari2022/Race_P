import type { ExtractionResult } from "@/types/race";

export async function ocrFallback(): Promise<ExtractionResult> {
  return {
    races: [],
    source: "ocr_fallback",
    warnings: ["OCR fallback is reserved for image-only PDFs. Native text extraction should be used whenever text is present."],
  };
}
