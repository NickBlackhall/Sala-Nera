/**
 * A listing's URL segment from its street address: lowercase, accents folded,
 * the house number dropped so the link reads as the street
 * ("4200 Preston Hollow Lane" → "preston-hollow-lane").
 *
 * Shared by the admin listing form and the listing a booking makes, so both
 * produce the same link for the same address.
 */
export function slugify(address: string): string {
  return address
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^\s*\d+\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
