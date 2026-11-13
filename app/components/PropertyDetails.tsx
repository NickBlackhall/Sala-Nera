import type { PropertyDetails as Details } from '@/lib/property-site';

/** "4250" → "4,250". */
const thousands = (n: number) => n.toLocaleString('en-US');

/**
 * The Details section of the property website: the agent's facts in a quiet
 * row, the description, and a link out to Google Maps. A link and not an
 * embedded map, so nothing of Google's sits on the page or changes its look.
 * A blank field is simply left out.
 */
export default function PropertyDetails({ details, address }: { details: Details; address: string }) {
  const stats = [
    details.beds !== null && { label: details.beds === 1 ? 'Bedroom' : 'Bedrooms', value: String(details.beds) },
    details.baths && { label: details.baths === '1' ? 'Bathroom' : 'Bathrooms', value: details.baths },
    details.sqft !== null && { label: 'Square feet', value: thousands(details.sqft) },
  ].filter((s): s is { label: string; value: string } => Boolean(s));

  return (
    <section id="details" className="psite-details" aria-label="Details">
      <h2 className="psite-group-title">Details</h2>
      <div className="psite-details-inner">
        {stats.length > 0 && (
          <dl className="psite-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dd>{s.value}</dd>
                <dt>{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
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
