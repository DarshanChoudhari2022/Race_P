const months: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function formatRaceDate(input: string): string {
  const trimmed = input.trim();
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}-${slash[3]}`;

  const textual = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (textual) {
    const month = months[textual[2].slice(0, 3).toLowerCase()];
    if (month) return `${textual[1].padStart(2, "0")}-${month}-${textual[3]}`;
  }

  const dashed = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashed) return `${dashed[1].padStart(2, "0")}-${dashed[2].padStart(2, "0")}-${dashed[3]}`;
  return trimmed;
}

export function slugDate(date: string): string {
  return date.replaceAll("/", "-").toLowerCase();
}
