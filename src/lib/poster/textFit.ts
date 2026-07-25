export function fitHorseNameFontSize(name: string, targetPt: number, maxChars?: number): number {
  const trimmed = name.trim();
  const limit = maxChars ?? Math.max(12, Math.floor(560 / (targetPt * 0.68)));
  if (trimmed.length <= limit) return targetPt;
  const over = trimmed.length - limit;
  return Math.max(targetPt - over * 2.0, targetPt * 0.72, 26);
}

