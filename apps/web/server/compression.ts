// Prefer Brotli on equal quality; explicit exclusions override wildcard values.
export function compressionEncoding(header: string | string[] = ''): 'br' | 'gzip' | undefined {
  const qualities = new Map<string, number>();

  for (const part of (Array.isArray(header) ? header.join(',') : header).split(',')) {
    const [name, ...parameters] = part.trim().toLowerCase().split(';');
    const parameter = parameters
      .map((value) => value.trim())
      .find((value) => value.startsWith('q='));
    const quality = parameter === undefined ? 1 : Number(parameter.slice(2));
    qualities.set(name!, Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0);
  }

  const quality = (name: string) => qualities.get(name) ?? qualities.get('*') ?? 0;
  const identity = qualities.get('identity') ?? 0;
  const br = quality('br');
  const gzip = quality('gzip');

  if (br > 0 && br >= gzip && br >= identity) {
    return 'br';
  }

  if (gzip > 0 && gzip >= identity) {
    return 'gzip';
  }

  return undefined;
}
