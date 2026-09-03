const LOGO = '/brand/sala nera logo cropped dark.svg';

export default function Footer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="foot foot--compact">
        <div className="wrap foot-bottom">
          <span>&copy; {new Date().getFullYear()} Sala Nera. A Blackhall Media Group collection.</span>
          <span><a href="/privacy">Privacy</a> &nbsp; Dallas–Fort Worth, TX</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-top">
          <div className="foot-brand">
            <a href="/" className="nav-mark" aria-label="Sala Nera — home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo brand-logo--footer" src={LOGO} alt="Sala Nera" width={1669} height={1072} loading="lazy" />
            </a>
            <p>A limited collection of cinematic property films and imagery by Blackhall Media Group.</p>
          </div>
          <div>
            <h2>Collection</h2>
            <ul><li><a href="/work">Selected Work</a></li><li><a href="/#services">Services</a></li><li><a href="/contact">Contact</a></li></ul>
          </div>
          <div>
            <h2>Connect</h2>
            <ul><li><a href="mailto:nick@blackhallmediagroup.com">Email</a></li><li><a href="https://www.blackhallmediagroup.com" target="_blank" rel="noopener">Blackhall Media Group</a></li></ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>&copy; {new Date().getFullYear()} Sala Nera. A Blackhall Media Group collection.</span>
          <span><a href="/privacy">Privacy</a> &nbsp; Dallas–Fort Worth, TX</span>
        </div>
      </div>
    </footer>
  );
}
