const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
}

export function slugify(input: string): string {
  const withoutUmlauts = input.replace(/[äöüÄÖÜß]/g, (ch) => UMLAUT_MAP[ch] ?? ch)
  return withoutUmlauts
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip remaining accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
