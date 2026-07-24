export function fitHorseNameFontSize(name: string, targetPt: number, maxChars = 20): number {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return targetPt;
  const over = trimmed.length - maxChars;
  return Math.max(targetPt - over * 1.3, targetPt * 0.72, 24);
}
