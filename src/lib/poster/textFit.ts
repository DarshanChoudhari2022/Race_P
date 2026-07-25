export function fitHorseNameFontSize(name: string, targetPt: number, maxChars?: number): number {
  const trimmed = name.trim();
  const limit = maxChars ?? Math.max(10, Math.floor(580 / (targetPt * 0.68)));
  if (trimmed.length <= limit) return targetPt;
  const over = trimmed.length - limit;
  return Math.max(targetPt - over * 1.2, targetPt * 0.7, 26);
}

