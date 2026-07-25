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

  let horseFontPt = 56;
  if (count > 14) {
    horseFontPt = Math.max(30, Math.round((450 / count) * 10) / 10);
  }

  return {
    headerHeightMm,
    runnerTopMm,
    runnerHeightMm,
    footerTopMm,
    horseFontPt,
    detailFontPt: Math.max(19.5, Math.round(horseFontPt * 0.46 * 10) / 10),
    numberFontPt: horseFontPt,
  };
}
