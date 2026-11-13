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

type Cell = { label: string; value: React.ReactNode };

/**
 * The Details section, laid out like a printed property brochure (Nick,
 * Nov 13: "more deliberate and designed"). The address stands as a headline
 * beside the agent's description, whose first paragraph reads as the lede.
 * Under them sits a ruled specification table, opened by one short oxblood
 * rule, the red bar of the Sala Nera mark. The last cell, Location, always
 * has the Google Maps link, so the table is never empty. It is a link and
 * not an embedded map, so nothing of Google's sits on the page.
 * A blank fact is simply left out; the MLS version arrives with no price.
 */
export default function PropertyDetails({
  details,
  address,
  city,
}: {
  details: Details;
  address: string;
  city: string | null;
}) {
  const paragraphs = (details.description ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Two ruled rows: the figures, large, then the setting, quieter. Each row
  // shares its width equally, so neither is ever left half-filled.
  const figures = ([
    details.price !== null && { label: 'Offered at', value: `$${thousands(details.price)}` },
    details.beds !== null && { label: 'Bedrooms', value: String(details.beds) },
    details.baths && { label: 'Bathrooms', value: details.baths },
    details.sqft !== null && {
      label: 'Interior',
      value: (
        <>
          {thousands(details.sqft)}
          <span className="pdet-unit">sq ft</span>
        </>
      ),
    },
  ] as Array<Cell | false | null | ''>).filter((c): c is Cell => Boolean(c));

  const setting = ([
    details.schoolDistrict && { label: 'School district', value: details.schoolDistrict },
    {
      label: 'Location',
      value: (
        <>
          {city && <span className="pdet-place">{city}</span>}
          <a
            className="pdet-map"
            href={details.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${address} on Google Maps (opens in a new tab)`}
          >
            View on map <span aria-hidden="true">↗</span>
          </a>
        </>
      ),
    },
  ] as Array<Cell | false | null | ''>).filter((c): c is Cell => Boolean(c));

  return (
    <section id="details" className="psite-details pdet" aria-labelledby="details-title">
      <div className={paragraphs.length > 0 ? 'pdet-intro' : 'pdet-intro pdet-intro--solo'}>
        <div className="pdet-head">
          <h2 className="pdet-kicker" id="details-title">Details</h2>
          <p className="pdet-address">{address}</p>
        </div>
        {paragraphs.length > 0 && (
          <div className="pdet-copy">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </div>
      <div className="pdet-ledger">
        {[figures, setting]
          .filter((row) => row.length > 0)
          .map((row, i) => (
            <dl key={i} className={i === 0 && figures.length > 0 ? 'pdet-row pdet-row--figures' : 'pdet-row'}>
              {row.map((c) => (
                <div key={c.label}>
                  <dt>{c.label}</dt>
                  <dd>{c.value}</dd>
                </div>
              ))}
            </dl>
          ))}
      </div>
    </section>
  );
}
