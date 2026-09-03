import type { Metadata } from 'next';
import Footer from '../components/Footer';
import InquiryForm from '../components/InquiryForm';
import Nav from '../components/Nav';

export const metadata: Metadata = {
  title: 'Contact — Sala Nera',
  description: 'Request availability for a Sala Nera cinematic property commission by Blackhall Media Group.',
  alternates: { canonical: '/contact' },
  openGraph: { title: 'Contact — Sala Nera', description: 'Tell us about the property.', url: '/contact' },
};

export default function ContactPage() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a><Nav solid />
      <main id="main" className="page-main">
        <header className="contact-hero"><div className="wrap positioning"><span className="kicker kicker--accent">Private Commissions</span><h1>Twenty years behind the camera. One property at a time.</h1><p>Sala Nera brings the discipline of broadcast filmmaking to properties that call for more than a standard listing package. Each commission is shaped around the home, its light, and the audience it needs to reach.</p><p>A limited number of commissions are accepted each month.</p></div></header>
        <section className="contact" aria-labelledby="contact-form-h"><div className="wrap contact-grid"><div><span className="kicker kicker--accent">Request Availability</span><h2 id="contact-form-h">Tell us about the property.</h2><p className="sub">Share the address, timing, and what makes it distinctive. We&apos;ll respond personally.</p><div className="contact-info"><a href="mailto:nick@blackhallmediagroup.com"><span className="k">Email</span>nick@blackhallmediagroup.com</a></div></div><InquiryForm /></div></section>
      </main><Footer compact />
    </>
  );
}
