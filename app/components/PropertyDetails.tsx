import type { PropertyDetails as Details } from '@/lib/property-site';

/** "4250" → "4,250". */
const thousands = (n: number) => n.toLocaleString('en-US');

/**
 * The headline facts, for the line under the address on the cover:
 * "$3,450,000 · 5 Beds · 4.5 Baths · 6,120 Sq Ft". Blank ones are left out.
 */
export function coverFacts(details: Details): { price: string | null; facts: string[] } {
  const price = details.price !== null ? `$${thousands(details.price)}` : null;
  const facts = [
    details.beds !== null && `${details.beds} ${details.beds === 1 ? 'Bed' : 'Beds'}`,
    details.baths && `${details.baths} ${details.baths === '1' ? 'Bath' : 'Baths'}`,
    details.sqft !== null && `${thousands(details.sqft)} Sq Ft`,
  ].filter((s): s is string => Boolean(s));
  return { price, facts };
}

/**
 * The Details section of the property website: the school district, the
 * description, and a link out to Google Maps. Price, beds, baths and square
 * feet sit on the cover instead (Nick, Nov 13), so they are not repeated here.
 * A link and not an embedded map, so nothing of Google's sits on the page or
 * changes its look. A blank field is simply left out.
 */
export default function PropertyDetails({ details, address }: { details: Details; address: string }) {
  return (
    <section id="details" className="psite-details" aria-label="Details">
      <h2 className="psite-group-title">Details</h2>
      <div className="psite-details-inner">
        {details.schoolDistrict && (
          <p className="psite-detail-line">
            <span>School district</span>
            {details.schoolDistrict}
          </p>
        )}
        {details.description && <p className="psite-description">{details.description}</p>}
        <a
          className="psite-map"
          href={details.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${address} on Google Maps (opens in a new tab)`}
        >
          View on map
        </a>
      </div>
    </section>
  );
}
