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

  let horseFontPt = 48;
  if (count >= 8) horseFontPt = 44;
  if (count >= 11) horseFontPt = 36;
  if (count >= 13) horseFontPt = 32;
  if (count >= 15) horseFontPt = Math.max(25, 420 / count);

  return {
    headerHeightMm,
    runnerTopMm,
    runnerHeightMm,
    footerTopMm,
    horseFontPt,
    detailFontPt: Math.max(18, horseFontPt * 0.44),
    numberFontPt: horseFontPt,
  };
}
