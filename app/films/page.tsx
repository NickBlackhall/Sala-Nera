import type { Metadata } from 'next';

const LOGO = '/brand/sala nera logo cropped dark.svg';

export const metadata: Metadata = {
  title: 'Films — Sala Nera',
  description: 'Cinematic property films from the Sala Nera collection by Blackhall Media Group.',
  alternates: { canonical: '/films' },
  openGraph: {
    title: 'Films — Sala Nera',
    description: 'Cinematic property films from the Sala Nera collection.',
    url: '/films',
  },
};

export default function Films() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="topstrip" aria-hidden="true">
        <span /><span className="lit" /><span /><span /><span /><span />
      </div>

      <nav className="nav films-nav" aria-label="Primary">
        <div className="wrap nav-inner">
          <a href="/" className="nav-mark" aria-label="Sala Nera — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo brand-logo--nav" src={LOGO} alt="Sala Nera" width={1669} height={1070} />
          </a>
          <div className="nav-links">
            <a href="/#process">Process</a>
            <a href="/#access">Request Availability</a>
          </div>
        </div>
      </nav>

      <main id="main" className="films-main">
        <div className="wrap">
          <span className="kicker kicker--accent">The Films</span>
          {/*
            PLACEHOLDER. Replace with the real films page once the reels are cut.
            Films should be embedded from Vimeo rather than self-hosted: adaptive
            streaming means an agent on hotel wifi sees the work, not a spinner.
          */}
          <h1 className="mt-16">The films are being cut.</h1>
          <p className="lede">
            Selected property films from the collection are going up here shortly. In the meantime,
            reach out and we&rsquo;ll send a private link to the reel.
          </p>
          <a href="/#access" className="btn btn-outline mt-32">Request Availability</a>
        </div>
      </main>

      <footer className="foot">
        <div className="wrap">
          <div className="foot-bottom">
            <span>&copy; {new Date().getFullYear()} Sala Nera. A Blackhall Media Group collection.</span>
            <span>Dallas–Fort Worth, TX</span>
          </div>
        </div>
      </footer>
    </>
  );
}
