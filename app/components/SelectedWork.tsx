import type { FeaturedWork } from '@/lib/featured';

/**
 * The Selected Work cards on / and /work: one cover photo per property, with
 * its address and city, opening the property website. Which listings appear
 * is Nick's choice in admin (lib/featured.ts).
 *
 * The layout follows the count, so one property reads as a wide frame and
 * not as the first cell of an empty grid.
 */
export default function SelectedWork({ work }: { work: FeaturedWork[] }) {
  const layout = work.length === 1 ? 'one' : work.length === 2 ? 'two' : 'many';

  return (
    <div className={`selected-grid selected-grid--${layout}`}>
      {work.map((item, i) => (
        <a className="work-card selected-card" href={item.href} key={item.slug}>
          <span className="work-card-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="selected-card-photo" src={item.coverPath} alt={item.address} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
          </span>
          <span className="work-card-shade" />
          <span className="work-card-copy">
            {item.city && <span className="work-card-type">{item.city}</span>}
            <h3>{item.address}</h3>
          </span>
        </a>
      ))}
    </div>
  );
}
