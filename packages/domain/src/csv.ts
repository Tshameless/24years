export function csvText(value: string): string {
  // Intentionally detect control characters that can precede spreadsheet formulas.
  // eslint-disable-next-line no-control-regex
  const formula = /^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f]*[=+@-]/u.test(value);
  const control = /^[\t\r\n]/u.test(value);
  const safe = formula || control ? "'" + value : value;

  return '"' + safe.replace(/"/g, '""') + '"';
}
