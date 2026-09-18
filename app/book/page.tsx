import type { Metadata } from 'next';
import { hasCalendar } from '@/lib/calendar';
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
    description: 'Price the shoot and book a real slot.',
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
            {/*
              The promise this page makes has to match the one the form can keep.
              With the calendar connected a slot is held the moment it is sent;
              without it the form falls back to asking for a preferred date, and
              saying "booked on the spot" there would be a lie the client only
              discovers when nobody turns up. SlotPicker carries the same
              distinction in its own hint, for the case where the calendar is
              configured but unreachable right now.
            */}
            <p>
              {hasCalendar()
                ? 'Pick a time that is genuinely open and it is yours — booked on the spot, no waiting to hear back.'
                : 'Sending this reserves nothing. We confirm the date, or offer the nearest alternatives, usually within one business day.'}
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
