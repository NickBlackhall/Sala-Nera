/**
 * A listing's Details: the facts on the property website's Details tab.
 *
 * The agent fills them in on their delivery page and Nick can in admin; both
 * use one form and this one reader. The rule agreed with Nick (Nov 13): the
 * agent controls the facts, Sala Nera controls the look. So there are no
 * settings here, only facts, and every one is optional. Square feet starts
 * as the number the agent gave when booking.
 *
 * Pure: the form (a client component) shares the limits.
 */

export type ListingDetails = {
  /** The asking price, in whole dollars. */
  price: number | null;
  beds: number | null;
  baths: string | null;
  sqft: number | null;
  schoolDistrict: string | null;
  description: string | null;
};

export const DETAIL_LIMITS = {
  baths: 40,
  schoolDistrict: 120,
  description: 4000,
} as const;

const text = (value: FormDataEntryValue | null, max: number): string | null => {
  const s = String(value ?? '').replace(/\r\n/g, '\n').trim();
  return s ? s.slice(0, max) : null;
};

/** "4,250", "4250 sq ft" → 4250. Blank → null. Anything else → undefined (refused). */
function whole(value: FormDataEntryValue | null, max: number): number | null | undefined {
  const s = String(value ?? '').replace(/,|sq\.? ?ft\.?|beds?|bedrooms?/gi, '').trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return n <= max ? n : undefined;
}

/**
 * "$1,250,000" or "1250000" → whole dollars. Blank → null. Only plain dollar
 * amounts (Nick, Nov 13: no "1.25M" shorthand). Anything else → undefined (refused).
 */
function dollars(value: FormDataEntryValue | null): number | null | undefined {
  const s = String(value ?? '').replace(/[$,\s]/g, '');
  if (!s) return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 1 && n <= 1_000_000_000 ? n : undefined;
}

export function readDetailsForm(form: FormData): { details: ListingDetails } | { error: string } {
  const beds = whole(form.get('beds'), 50);
  if (beds === undefined) return { error: 'Bedrooms should be a whole number, like 4.' };
  const price = dollars(form.get('price'));
  if (price === undefined) return { error: 'Price should be a dollar amount, like $1,250,000.' };
  const sqft = whole(form.get('sqft'), 100_000);
  if (sqft === undefined) return { error: 'Square feet should be a number, like 4,250.' };
  return {
    details: {
      price,
      beds,
      baths: text(form.get('baths'), DETAIL_LIMITS.baths),
      sqft: sqft === 0 ? null : sqft,
      schoolDistrict: text(form.get('schoolDistrict'), DETAIL_LIMITS.schoolDistrict),
      description: text(form.get('description'), DETAIL_LIMITS.description),
    },
  };
}

/** Just the Details, so a form gets these and no other column of the listing. */
export function pickDetails(row: ListingDetails): ListingDetails {
  return {
    price: row.price,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    schoolDistrict: row.schoolDistrict,
    description: row.description,
  };
}

export function hasDetails(d: ListingDetails): boolean {
  return d.price !== null || d.beds !== null || Boolean(d.baths) || d.sqft !== null || Boolean(d.schoolDistrict) || Boolean(d.description);
}

/**
 * A Google Maps link for the address: opens the Maps app on a phone, the
 * website elsewhere. A search link, so it needs no key and no account, and
 * nothing of Google's is loaded onto the page.
 */
export function mapUrl(address: string, city: string | null): string {
  const query = [address, city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
