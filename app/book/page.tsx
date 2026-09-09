import type { Metadata } from 'next';
import BookingForm from './BookingForm';
import Footer from '../components/Footer';
import Nav from '../components/Nav';

export const metadata: Metadata = {
  title: 'Book a Shoot — Sala Nera',
  description:
    'Price and request a Sala Nera cinematic property shoot — services, add-ons and a live estimate before you send.',
  alternates: { canonical: '/book' },
  openGraph: {
    title: 'Book a Shoot — Sala Nera',
    description: 'Price the shoot and request your date.',
    url: '/book',
  },
};

export default function BookPage() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav solid />
      <main id="main" className="page-main">
        <header className="bk-hero">
          <div className="wrap positioning">
            <span className="kicker kicker--accent">Book a Shoot</span>
            <h1>Price it, pick your date, send it over.</h1>
            <p>
              Choose what the property needs and see the cost as you go — no
              &ldquo;contact us for rates&rdquo;, no back and forth before you know the number.
            </p>
            <p>
              Sending this reserves nothing. We confirm the date, or offer the nearest
              alternatives, usually within one business day.
            </p>
          </div>
        </header>

        <section className="bk-section" aria-labelledby="bk-h">
          <div className="wrap">
            <h2 id="bk-h" className="sr-only">Booking form</h2>
            <BookingForm />
          </div>
        </section>
      </main>
      <Footer compact />
    </>
  );
}
