import Nav from './components/Nav';
import HeroVideo from './components/HeroVideo';
import InquiryForm from './components/InquiryForm';

const LOGO = '/brand/sala nera logo cropped dark.svg';

const WORK = [
  ['01', 'Pre-Production Strategy',
    "A walk-through of the property's strongest angles, light, and story before a single frame is shot — the same prep a broadcast production gets, applied to a single home."],
  ['02', 'The Feature Film',
    'A cinematic marketing film treating the property as a character, not a checklist — graded to match, scored, and cut for the audience it’s built to move.'],
  ['03', 'Enhanced Aerial Coverage',
    "Extended drone coverage of the property and its setting, shot for the film's pacing rather than a standard listing pass."],
  ['04', 'Editorial Stills',
    'A full gallery, color held true, framed with the same eye as the film — not an afterthought shot alongside it.'],
  ['05', 'Social Cuts',
    'Short-form edits drawn from the same footage — built to move on a feed without diluting what the feature film does.'],
] as const;

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav />

      <main id="main">
        <header className="hero" id="top">
          <HeroVideo src="/media/sala-nera-hero.mp4" />
          <div className="hero-overlay" />
          <div className="wrap hero-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo hero-logo" src={LOGO} alt="Sala Nera" width={1669} height={1070} fetchPriority="high" />
            <h1>Not every listing<br />earns this.</h1>
            <p className="lede">
              Sala Nera is the cinematic collection from Blackhall Media Group — a select body of
              work for the properties that can&rsquo;t afford to look ordinary.
            </p>
            <div className="hero-ctas">
              <a href="#access" className="btn btn-primary">Request Availability</a>
              <a href="/films" className="btn btn-outline">See the Work</a>
            </div>
          </div>
        </header>

        <section className="pad">
          <div className="wrap positioning-inner positioning">
            <blockquote>
              A curated collection, built from twenty years behind a broadcast camera — not a stock
              drone package.
            </blockquote>
            <p>
              Sala Nera exists for the shoots where the standard listing package isn&rsquo;t enough.
              Every frame is selected, not just captured — the same discipline behind a broadcast
              production applied to a single home.
            </p>
            <p>
              Access is limited by design. A small number of properties are accepted each month, and
              each begins with a conversation about the property itself, not a package off a menu.
            </p>
          </div>
        </section>

        <section className="pad" id="process" aria-labelledby="process-h">
          <div className="wrap">
            <div className="section-head">
              <span className="kicker kicker--accent">The Work</span>
              <h2 id="process-h">What&rsquo;s included is a conversation, not a checklist.</h2>
              <p>
                Every Sala Nera property receives the same core discipline. What changes is how far
                the story needs to go — that&rsquo;s decided together, before anything is scheduled.
              </p>
            </div>
            <div className="work-list">
              {WORK.map(([idx, title, body]) => (
                <div className="work-row" key={idx}>
                  <div className="idx">{idx}</div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pad approach" aria-labelledby="approach-h">
          <div className="wrap approach-grid">
            <div>
              <span className="kicker kicker--accent">The Approach</span>
              <h2 id="approach-h" className="mt-16">
                We wait for the hour the light is on the property&rsquo;s side.
              </h2>
              <div className="body">
                <p>
                  A house has a version of itself that only shows up under the right conditions — the
                  right hour, the right lens, the right restraint. Sala Nera exists to wait for that
                  version and shoot it properly.
                </p>
                <p>
                  Nothing here is aspirational. It&rsquo;s the same craft behind twenty years of
                  broadcast work, pointed at one property at a time.
                </p>
              </div>
              <a href="#access" className="btn btn-outline mt-32">Start a Conversation</a>
            </div>
            <div className="approach-visual" aria-hidden="true">
              <div className="stripe">
                <span /><span className="lit" /><span /><span /><span /><span />
              </div>
              <span className="note">Featured film still</span>
            </div>
          </div>
        </section>

        <section className="pad proof" aria-labelledby="proof-h">
          <div className="wrap">
            <h2 id="proof-h" className="lbl">Past clients include</h2>
            {/* TODO: replace with the brokerages and builders you have actually shot for. */}
            <ul className="proof-row">
              <li>D.R. Horton</li><li>KB Home</li><li>Lennar</li>
              <li>Briggs Freeman</li><li>Sotheby&rsquo;s</li>
            </ul>
          </div>
        </section>

        <section className="pad">
          <figure className="wrap quote-box">
            <div className="mark bars" aria-hidden="true">
              <span /><span className="lit" /><span /><span /><span /><span />
            </div>
            <blockquote>
              Sala Nera didn&rsquo;t just photograph the house — it made buyers feel like they
              already knew it before they walked in.
            </blockquote>
            {/* TODO: replace with a real name + brokerage, or remove this section entirely. */}
            <figcaption><b>Referring Agent</b> · Dallas–Fort Worth</figcaption>
          </figure>
        </section>

        <section className="pad contact" id="access" aria-labelledby="access-h">
          <div className="wrap contact-grid">
            <div>
              <span className="kicker kicker--accent">Request Availability</span>
              <h2 id="access-h" className="mt-16">Tell us about the property.</h2>
              <p className="sub">
                A small number of properties are accepted each month. Share a few details and
                we&rsquo;ll follow up to talk it through.
              </p>
              <div className="contact-info">
                <a href="mailto:nick@blackhallmediagroup.com">
                  <span className="k">Email</span> nick@blackhallmediagroup.com
                </a>
                {/* TODO: real number, or delete this line */}
                <a href="tel:+12145550000"><span className="k">Call</span> (214) 555-0000</a>
              </div>
            </div>
            <div><InquiryForm /></div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-brand">
              <a href="#top" className="nav-mark" aria-label="Sala Nera — home">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="brand-logo brand-logo--footer" src={LOGO} alt="Sala Nera" width={1669} height={1070} loading="lazy" />
              </a>
              <p>
                A curated collection from Blackhall Media Group. Cinematic real estate media for the
                properties that earn it.
              </p>
            </div>
            <div>
              <h2>Collection</h2>
              <ul>
                <li><a href="#process">The Work</a></li>
                <li><a href="#access">Request Availability</a></li>
              </ul>
            </div>
            <div>
              <h2>Connect</h2>
              <ul>
                <li><a href="mailto:nick@blackhallmediagroup.com">Email</a></li>
                <li>
                  <a href="https://www.blackhallmediagroup.com" target="_blank" rel="noopener">
                    Blackhall Media Group
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <span>&copy; {new Date().getFullYear()} Sala Nera. A Blackhall Media Group collection.</span>
            <span>Dallas–Fort Worth, TX</span>
          </div>
        </div>
      </footer>
    </>
  );
}
