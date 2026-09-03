import type { Metadata } from 'next';
import Footer from '../components/Footer';
import Nav from '../components/Nav';

export const metadata: Metadata = { title: 'Films — Sala Nera', description: 'Cinematic property films from the Sala Nera collection by Blackhall Media Group.', alternates: { canonical: '/films' }, robots: { index: false, follow: true }, openGraph: { title: 'Films — Sala Nera', description: 'Cinematic property films from the Sala Nera collection.', url: '/films' } };

export default function Films() {
  return <><a className="skip" href="#main">Skip to content</a><Nav solid /><main id="main" className="films-main page-main"><div className="wrap"><span className="kicker kicker--accent">The Films</span><h1 className="mt-16">The films are being cut.</h1><p className="lede">Selected property films from the collection are going up here shortly. In the meantime, reach out and we&apos;ll send a private link to the reel.</p><a href="/contact" className="btn btn-outline mt-32">Begin a Conversation</a></div></main><Footer compact /></>;
}
