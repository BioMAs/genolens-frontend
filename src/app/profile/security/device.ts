/**
 * A device named the way a person would: "Chrome on macOS" rather than the
 * `User-Agent` string the browser sent when the session opened. Only the common
 * browsers and systems are recognised; anything else is shown as it came.
 *
 * The order of the tests matters: Edge and Opera also say "Chrome", Chrome also
 * says "Safari", an iPhone says "like Mac OS X" and Android says "Linux".
 */
const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

function firstMatch(table: [RegExp, string][], userAgent: string): string | null {
  return table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser = firstMatch(BROWSERS, userAgent);
  const system = firstMatch(SYSTEMS, userAgent);
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? userAgent;
}
