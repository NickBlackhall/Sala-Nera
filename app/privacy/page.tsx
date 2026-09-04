import type { Metadata } from 'next';
import Footer from '../components/Footer';
import Nav from '../components/Nav';

export const metadata: Metadata = { title: 'Privacy — Sala Nera', description: 'How Sala Nera and Blackhall Media Group handle inquiry information.', robots: { index: false, follow: true } };

export default function PrivacyPage() {
  return (
    <><Nav solid /><main className="page-main privacy-main"><div className="wrap privacy-wrap"><span className="kicker kicker--accent">Privacy</span><h1>Your inquiry stays an inquiry.</h1><p className="privacy-intro">This notice explains how Sala Nera, a Blackhall Media Group collection, handles information submitted through this website. Effective September 2, 2026.</p><section className="privacy-section"><h2>Information we receive</h2><p>When you contact us, we receive the information you choose to provide, such as your name, email address, property details, timing, and message. Our hosting provider may also process standard technical logs used to operate and secure the site.</p></section><section className="privacy-section"><h2>How we use it</h2><p>We use inquiry information to respond, evaluate availability, discuss a potential commission, and protect the site from misuse. We do not sell personal information or use inquiry details for unrelated advertising.</p></section><section className="privacy-section"><h2>Service providers</h2><p>Vercel hosts the website and Resend delivers inquiry emails. These providers process information only as needed to provide their services, subject to their own privacy and security terms.</p></section><section className="privacy-section"><h2>Retention and choices</h2><p>We retain inquiry information only as long as reasonably needed for the conversation, business records, or legal obligations. To ask about, correct, or request deletion of information you submitted, email <a href="mailto:nblackhall@blackhallmediagroup.com">nblackhall@blackhallmediagroup.com</a>.</p></section></div></main><Footer compact /></>
  );
}
