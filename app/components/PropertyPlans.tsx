'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PropertyPlan } from '@/lib/property-site';

/**
 * The property website's floor plans: each one large on a white sheet, since
 * a plan is a drawing on white and would otherwise float as a bright slab on
 * the dark page. Click to enlarge. Nothing here downloads; the agent's copies
 * are on the delivery page.
 *
 * Both versions of the page use this, so it must never show a name. The
 * captions are Nick's labels or "Floor plan".
 */
export default function PropertyPlans({
  plans,
  heading,
  address,
}: {
  plans: PropertyPlan[];
  heading: string;
  address: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (dir: number) => setOpen((i) => (i === null ? i : (i + dir + plans.length) % plans.length)),
    [plans.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('menu-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('menu-open');
    };
  }, [open, close, step]);

  const current = open === null ? null : plans[open];
  const many = plans.length > 1;

  return (
    <section id="floorplan" aria-label={heading}>
      <h2 className="psite-group-title">{heading}</h2>
      <div className="psite-plans">
        {plans.map((plan, i) => (
          <figure className="psite-plan" key={plan.id}>
            <button onClick={() => setOpen(i)} aria-label={`Enlarge ${plan.title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={plan.gridUrl}
                alt={`${address}, ${plan.title.toLowerCase()}`}
                width={plan.width}
                height={plan.height}
                loading="lazy"
              />
            </button>
            {/* One unlabelled plan sits under the section's own heading and needs no caption. */}
            {(many || plan.title !== 'Floor plan') && <figcaption>{plan.title}</figcaption>}
          </figure>
        ))}
      </div>

      {current && open !== null && (
        <div className="lb" role="dialog" aria-modal="true" aria-label={current.title}>
          <button className="lb-close" onClick={close} aria-label="Close">✕</button>
          {many && <button className="lb-prev" onClick={() => step(-1)} aria-label="Previous">‹</button>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lb-img lb-img--plan" src={current.largeUrl} alt={`${address}, ${current.title.toLowerCase()}`} />
          {many && <button className="lb-next" onClick={() => step(1)} aria-label="Next">›</button>}
          <div className="lb-meta">
            <span>{current.title}</span>
          </div>
        </div>
      )}
    </section>
  );
}
