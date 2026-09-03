import Footer from './components/Footer';
import HeroVideo from './components/HeroVideo';
import Nav from './components/Nav';

const LOGO = '/brand/sala nera logo cropped dark.svg';
const MARK = '/brand/mark.svg';

const services = [
  { href: '/work#films', type: 'Motion', title: 'Feature Films', copy: 'Cinematic property stories, scored and cut with restraint.' },
  { href: '/work#stills', type: 'Photography', title: 'Editorial Stills', copy: 'Architecture, atmosphere, and detail held true.' },
  { href: '/work#aerial', type: 'Perspective', title: 'Aerial', copy: 'The property and its setting, considered as one frame.' },
  { href: '/work#social', type: 'Short Form', title: 'Social Cuts', copy: 'Focused edits made for the pace of the feed.' },
] as const;

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav />

      <main id="main">
        <header className="hero" id="top">
          <HeroVideo desktopSrc="/media/sala-nera-hero.mp4" mobileSrc="/media/sala-nera-hero-mobile.mp4" poster="/media/hero-poster.jpg" />
          <div className="hero-overlay" />
          <div className="wrap hero-inner">
            <h1>For properties that stand apart.</h1>
            <p className="lede">Film and imagery shaped by architecture, atmosphere, and light.</p>
            <div className="hero-ctas">
              <a href="/work" className="btn btn-primary">View the Collection</a>
              <a href="/contact" className="text-link">Begin a Conversation</a>
            </div>
            <div className="hero-signature">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo hero-logo" src={LOGO} alt="Sala Nera" width={1669} height={1072} fetchPriority="high" />
              <p>A Blackhall Media Group collection.</p>
            </div>
          </div>
        </header>

        <section className="pad work-showcase" id="work" aria-labelledby="work-h">
          <div className="wrap">
            <div className="work-showcase-head">
              <div><span className="kicker">Selected Work</span><h2 id="work-h">A collection, deliberately concise.</h2></div>
              <a className="work-showcase-link" href="/work">Explore the work &rarr;</a>
            </div>
            <div className="work-empty">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MARK} alt="" aria-hidden="true" />
              <p>A handful of properties will be presented here as the Sala Nera collection is photographed and filmed.</p>
            </div>
          </div>
        </section>

        <section className="pad services" id="services" aria-labelledby="services-h">
          <div className="wrap">
            <div className="section-head">
              <span className="kicker kicker--accent">Services</span>
              <h2 id="services-h">Everything the story needs. Nothing it doesn&apos;t.</h2>
              <p>Each commission is shaped around the property, with the disciplines selected to serve one coherent point of view.</p>
            </div>
            <div className="work-showcase-grid">
              {services.map((service) => (
                <a className="work-card" href={service.href} key={service.title}>
                  <span className="work-card-media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="work-card-mark" src={MARK} alt="" aria-hidden="true" />
                  </span>
                  <span className="work-card-shade" />
                  <span className="work-card-copy"><span className="work-card-type">{service.type}</span><h3>{service.title}</h3><p>{service.copy}</p></span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="pad contact-tease" id="contact" aria-labelledby="contact-h">
          <div className="wrap contact-tease-inner">
            <div><span className="kicker kicker--accent">Private Commissions</span><h2 id="contact-h">Tell us about the property.</h2><p>Share the address, timing, and what makes it distinctive. Every inquiry is reviewed personally.</p></div>
            <a href="/contact" className="btn btn-outline">Begin a Conversation</a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
