export type Confidence = "high" | "medium" | "needs_review";

export interface Runner {
  horseNumber: number;
  drawNumber: number | null;
  horseName: string;
  trainer: string;
  jockey: string;
  confidence?: Confidence;
  warnings?: string[];
}

export interface Race {
  date: string;
  venue: string;
  raceNumber: number;
  time: string;
  distanceMetres: number;
  runners: Runner[];
  confidence?: Confidence;
  warnings?: string[];
}

export interface ExtractionResult {
  races: Race[];
  source: "native_pdf_text" | "ocr_fallback";
  warnings: string[];
}
