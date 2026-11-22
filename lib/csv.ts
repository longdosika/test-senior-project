/**
 * Serialises rows to RFC 4180 CSV. Cells beginning with = + - @ are prefixed
 * with an apostrophe so spreadsheet apps do not evaluate them as formulas.
 */
export function toCsv(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
