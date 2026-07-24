export function formatRaceTime(input: string): string {
  const clean = input.trim().toUpperCase().replace(/\s+/g, " ");
  const match = clean.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM|A\.M\.|P\.M\.)$/);
  if (!match) return clean;
  const hour = String(Number(match[1]));
  const minute = match[2];
  const meridiem = match[3].startsWith("A") ? "A.M." : "P.M.";
  return `${hour}.${minute} ${meridiem}`;
}
