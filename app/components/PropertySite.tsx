import PropertyGallery from '@/app/components/PropertyGallery';
import type { PropertySite as Site } from '@/lib/property-site';

/** "15123632928" → "(512) 363-2928". Anything that is not a US number is shown as typed. */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : phone;
}

/**
 * One page, two versions. Branded carries the agent's contact and Nick's
 * credit; unbranded, for MLS, carries neither — no agent, brokerage,
 * photographer or contact detail anywhere a viewer can see. The agent is not
 * even passed to the client when unbranded, so it is not in the page source.
 */
export default function PropertySite({ site, branded }: { site: Site; branded: boolean }) {
  const agent = branded ? site.agent : null;

  return (
    <div className="psite">
      <header className="pcover" style={{ backgroundImage: `url(${site.coverUrl})` }}>
        <div className="pcover-scrim" />
        <div className="pcover-inner">
          {site.city && <p className="pcover-kicker">{site.city}</p>}
          <h1>{site.address}</h1>
          {agent?.name && <p className="pcover-by">Presented by {agent.name}</p>}
          {agent?.company && <p className="pcover-by">{agent.company}</p>}
        </div>
      </header>

      <main className="psite-body">
        <PropertyGallery photos={site.photos} address={site.address} />
      </main>

      {branded && (
        <footer className="psite-foot">
          {agent && (
            <div className="psite-agent">
              <span className="kicker">Presented by</span>
              {agent.name && <h2>{agent.name}</h2>}
              {agent.company && <p>{agent.company}</p>}
              <p className="psite-contact">
                {agent.phone && <a href={`tel:${agent.phone.replace(/[^\d+]/g, '')}`}>{formatPhone(agent.phone)}</a>}
                <a href={`mailto:${agent.email}`}>{agent.email}</a>
              </p>
            </div>
          )}
          <a className="psite-credit" href="https://salanera.com">Photography by Sala Nera</a>
        </footer>
      )}
    </div>
  );
}
