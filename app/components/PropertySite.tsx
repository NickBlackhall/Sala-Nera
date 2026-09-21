import PropertyGallery from '@/app/components/PropertyGallery';
import VideoPlayer from '@/app/components/VideoPlayer';
import type { PropertySite as Site, PropertyVideo } from '@/lib/property-site';

const isVertical = (v: PropertyVideo) => Boolean(v.width && v.height && v.height > v.width);

/**
 * Consecutive vertical films share a row, side by side where the screen is
 * wide enough; each horizontal one gets the full width to itself.
 */
function filmRows(videos: PropertyVideo[]): PropertyVideo[][] {
  const rows: PropertyVideo[][] = [];
  for (const video of videos) {
    const last = rows[rows.length - 1];
    if (last && isVertical(video) && isVertical(last[0])) last.push(video);
    else rows.push([video]);
  }
  return rows;
}

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
      <header className="pcover" style={site.coverUrl ? { backgroundImage: `url(${site.coverUrl})` } : undefined}>
        <div className="pcover-scrim" />
        <div className="pcover-inner">
          {site.city && <p className="pcover-kicker">{site.city}</p>}
          <h1>{site.address}</h1>
          {agent?.name && <p className="pcover-by">Presented by {agent.name}</p>}
          {agent?.company && <p className="pcover-by">{agent.company}</p>}
        </div>
      </header>

      <main className="psite-body">
        {site.videos.length > 0 && (
          <section className="psite-films" aria-label="Film">
            {filmRows(site.videos).map((row) => (
              <div className="psite-film-row" key={row[0].id}>
                {row.map((video) => (
                  <VideoPlayer
                    key={video.id}
                    src={video.url}
                    poster={video.posterUrl}
                    width={video.width}
                    height={video.height}
                    label={site.videos.length > 1 ? `${site.address}, film ${site.videos.indexOf(video) + 1}` : `${site.address}, film`}
                  />
                ))}
              </div>
            ))}
          </section>
        )}
        {site.photos.length > 0 && <PropertyGallery photos={site.photos} address={site.address} />}
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
