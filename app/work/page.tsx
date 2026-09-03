import type { Metadata } from 'next';
import Footer from '../components/Footer';
import Nav from '../components/Nav';

const MARK = '/brand/mark.svg';

export const metadata: Metadata = {
  title: 'Work — Sala Nera',
  description: 'Selected cinematic property films, editorial stills, aerial work, and social cuts from Sala Nera by Blackhall Media Group.',
  alternates: { canonical: '/work' },
  openGraph: { title: 'Work — Sala Nera', description: 'Selected cinematic property work from Sala Nera.', url: '/work' },
};

const disciplines = [
  { id: 'films', type: 'Motion', title: 'Feature Films', copy: 'Cinematic property stories, scored and cut with restraint.' },
  { id: 'stills', type: 'Photography', title: 'Editorial Stills', copy: 'Architecture, atmosphere, and detail held true.' },
  { id: 'aerial', type: 'Perspective', title: 'Aerial', copy: 'The property and its setting, considered as one frame.' },
  { id: 'social', type: 'Short Form', title: 'Social Cuts', copy: 'Focused edits made for the pace of the feed.' },
] as const;

const process = [
  ['01', 'Consider', 'We walk the property, study its light, and find the details that give the story its point of view.'],
  ['02', 'Capture', 'Production is paced around the home and the conditions it needs — measured, discreet, and never reduced to a standard pass.'],
  ['03', 'Finish', 'Film, color, sound, stills, and campaign cuts are completed as one coherent body of work, personally reviewed before delivery.'],
] as const;

const experience = [
  ['01', 'Before', 'Clear preparation guidance, thoughtful timing, and a plan shared before production begins.'],
  ['02', 'During', 'A small, respectful crew and a production day paced around the property rather than the clock.'],
  ['03', 'After', 'Personally reviewed films and imagery, delivered in the formats needed to bring the property to market.'],
] as const;

export default function WorkPage() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav solid />
      <main id="main" className="page-main">
        <header className="work-hero"><div className="wrap"><span className="kicker kicker--accent">The Collection</span><h1>Work that holds the room.</h1><p>Feature films and editorial imagery shaped around a property&apos;s architecture, atmosphere, and point of view.</p></div></header>
        <div className="work-main">
          <nav className="subnav" aria-label="Work categories"><div className="wrap subnav-inner"><a href="#all">All Work</a><a href="#films">Films</a><a href="#stills">Editorial Stills</a><a href="#aerial">Aerial</a><a href="#social">Social Cuts</a><a href="#process">Process</a><a href="#experience">Experience</a></div></nav>
          <section className="wrap" id="all" aria-labelledby="work-index-h">
            <div className="work-intro"><h2 id="work-index-h">Four disciplines. One visual standard.</h2><p>Each property will bring film, stills, aerial work, and campaign cuts together as one considered presentation.</p></div>
            <div className="work-grid">
              {disciplines.map((item) => <article className="work-card" id={item.id} key={item.id}><span className="work-card-media">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="work-card-mark" src={MARK} alt="" aria-hidden="true" /></span><span className="work-card-shade" /><span className="work-card-copy"><span className="work-card-type">{item.type}</span><h3>{item.title}</h3><p>{item.copy}</p></span></article>)}
            </div>
          </section>
        </div>
        <section className="detail-section" id="process" aria-labelledby="process-h"><div className="wrap"><div className="detail-head"><span className="kicker kicker--accent">The Process</span><h2 id="process-h">Nothing begins with a shot list.</h2><p>We begin by learning how the home is lived in, when its light is right, and what its next owner should feel.</p></div><div className="process-list">{process.map(([number, title, copy]) => <div className="process-row" key={number}><span className="idx">{number}</span><h3>{title}</h3><p>{copy}</p></div>)}</div></div></section>
        <section className="detail-section experience-section" id="experience" aria-labelledby="experience-h"><div className="wrap experience-grid"><div className="experience-copy"><span className="kicker kicker--accent">The Experience</span><h2 id="experience-h">Quiet on set. Exacting in the edit.</h2><p>One point of contact carries the property from preparation through delivery. The process is clear, considered, and respectful of the home.</p></div><div className="experience-list">{experience.map(([number, title, copy]) => <div className="experience-item" key={number}><span className="idx">{number}</span><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div></div></section>
        <section className="availability"><div className="wrap"><span className="kicker kicker--accent">Private Commissions</span><h2>Tell us about the property.</h2><p>Share the address, timing, and what makes it distinctive.</p><a href="/contact" className="btn btn-outline">Begin a Conversation</a></div></section>
      </main>
      <Footer compact />
    </>
  );
}
