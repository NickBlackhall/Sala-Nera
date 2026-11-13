import PropertyBar, { type BarTab } from '@/app/components/PropertyBar';
import PropertyDetails from '@/app/components/PropertyDetails';
import PropertyGallery, { type PhotoGroup } from '@/app/components/PropertyGallery';
import PropertyPlans from '@/app/components/PropertyPlans';
import VideoPlayer from '@/app/components/VideoPlayer';
import type { PropertySite as Site, PropertyVideo } from '@/lib/property-site';

/** The mark on the cover. Branded only: its very filename says whose it is. */
const LOGO = '/brand/sala nera logo cropped dark.svg';

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

  // Drone shots get a section of their own, in Nick's order within it — but
  // only beside ground photos. A set that is all one kind stays one section.
  const ground = site.photos.filter((p) => !p.aerial);
  const aerials = site.photos.filter((p) => p.aerial);
  const groups: PhotoGroup[] =
    ground.length > 0 && aerials.length > 0
      ? [
          { id: 'photos', label: 'Photos', photos: ground },
          { id: 'aerials', label: aerials.length > 1 ? 'Aerials' : 'Aerial', photos: aerials },
        ]
      : site.photos.length > 0
        ? [{ id: 'photos', label: 'Photos', photos: site.photos }]
        : [];

  // A tab per section this page actually has; one section alone needs no tabs.
  const tabs: BarTab[] = [];
  if (site.videos.length > 0) tabs.push({ id: 'film', label: site.videos.length > 1 ? 'Films' : 'Film' });
  for (const group of groups) tabs.push({ id: group.id, label: group.label });
  tabs.push({ id: 'details', label: 'Details' });
  const plansLabel = site.plans.length > 1 ? 'Floor plans' : 'Floor plan';
  if (site.plans.length > 0) tabs.push({ id: 'floorplan', label: plansLabel });
  if (agent) tabs.push({ id: 'contact', label: 'Contact' });

  return (
    <div className="psite">
      <header className="pcover" style={site.coverUrl ? { backgroundImage: `url(${site.coverUrl})` } : undefined}>
        <div className="pcover-scrim" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {branded && <img className="pcover-logo" src={LOGO} alt="Sala Nera" width={1669} height={1072} />}
        <div className="pcover-inner">
          {site.city && <p className="pcover-kicker">{site.city}</p>}
          <h1>{site.address}</h1>
          {agent?.name && <p className="pcover-by">Presented by {agent.name}</p>}
          {agent?.company && <p className="pcover-by">{agent.company}</p>}
          <a className="pcover-enter" href="#gallery">View gallery</a>
        </div>
      </header>

      <PropertyBar title={site.address} sub={branded ? 'Sala Nera' : site.city} tabs={tabs} />

      <main className="psite-body">
        {site.videos.length > 0 && (
          <section className="psite-films" id="film" aria-label="Film">
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
        {groups.length > 0 && <PropertyGallery groups={groups} address={site.address} />}
        {/* The price is left off the MLS version, like the agent (Nick, Nov 13). */}
        <PropertyDetails details={branded ? site.details : { ...site.details, price: null }} address={site.address} />
        {site.plans.length > 0 && <PropertyPlans plans={site.plans} heading={plansLabel} address={site.address} />}
      </main>

      {branded && (
        <footer className="psite-foot">
          {agent && (
            <div className="psite-agent" id="contact">
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
