export function fitHorseNameFontSize(name: string, targetPt: number, maxChars = 18): number {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return targetPt;
  const over = trimmed.length - maxChars;
  return Math.max(targetPt - over * 1.0, targetPt * 0.75, 28);
}
