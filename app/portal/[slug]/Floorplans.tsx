import { floorplanTitle } from '@/lib/floorplans';
import type { Floorplan } from '@/lib/schema';
import { isLocalKey, previewUrl } from '@/lib/storage';

/**
 * The floor plans on a delivery page.
 *
 * Paid: each plan with a Download link for the file Nick uploaded. Locked: a
 * line saying they are waiting, and no picture — a plan at screen size is the
 * whole product, so a preview would give it away in a way a watermarked photo
 * does not.
 */
export default function Floorplans({
  slug,
  plans,
  locked,
}: {
  slug: string;
  plans: Floorplan[];
  locked: boolean;
}) {
  if (plans.length === 0) return null;
  const heading = plans.length > 1 ? 'Floor plans' : 'Floor plan';

  return (
    <section className="pplans wrap" id="floorplans">
      <p className="kicker">{heading}</p>
      {locked ? (
        <p className="pplans-note">
          {plans.length > 1 ? `${plans.length} floor plans are` : 'Your floor plan is'} ready and will
          be available to download here once the invoice is paid.
        </p>
      ) : (
        <ul className="pplans-list">
          {plans.map((plan, i) => {
            const title = floorplanTitle(plan, i, plans);
            const picture = plan.gridKey ?? (isLocalKey(plan.r2Key) ? plan.r2Key : null);
            return (
              <li key={plan.id}>
                {picture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={isLocalKey(picture) ? picture : previewUrl(picture)} alt={title} loading="lazy" />
                )}
                <div>
                  <strong>{title}</strong>
                  <a
                    className="btn btn-outline"
                    href={`/api/portal/download/floorplan?slug=${encodeURIComponent(slug)}&id=${plan.id}`}
                    download={plan.filename}
                  >
                    Download
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
