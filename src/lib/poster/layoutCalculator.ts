export interface PosterLayout {
  headerHeightMm: number;
  runnerTopMm: number;
  runnerHeightMm: number;
  footerTopMm: number;
  horseFontPt: number;
  detailFontPt: number;
  numberFontPt: number;
}

export function calculatePosterLayout(runnerCount: number): PosterLayout {
  const count = Math.max(1, runnerCount);
  const headerHeightMm = count <= 8 ? 92 : 82;
  const footerTopMm = 700;
  const runnerTopMm = count <= 8 ? 108 : 92;
  const available = footerTopMm - runnerTopMm;
  const runnerHeightMm = available / count;

  const calculatedFontPt = runnerHeightMm * 0.76;
  const horseFontPt = Math.min(56, Math.max(26, Math.round(calculatedFontPt * 10) / 10));

  return {
    headerHeightMm,
    runnerTopMm,
    runnerHeightMm,
    footerTopMm,
    horseFontPt,
    detailFontPt: Math.max(16, Math.round(horseFontPt * 0.46 * 10) / 10),
    numberFontPt: horseFontPt,
  };
}
