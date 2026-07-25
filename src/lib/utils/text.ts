export function normalizeText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleKeepInitials(value: string): string {
  return normalizeText(value)
    .split(" ")
    .map((part) => {
      if (/^[A-Z]$/.test(part)) return part;
      if (/^Md\.?$/i.test(part)) return "Md";
      if (/^[A-Z]{2,3}$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}
