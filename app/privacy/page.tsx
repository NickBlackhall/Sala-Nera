import type { Metadata } from 'next';
import Footer from '../components/Footer';
import Nav from '../components/Nav';

export const metadata: Metadata = { title: 'Privacy — Sala Nera', description: 'How Sala Nera and Blackhall Media Group handle the information you give us.', robots: { index: false, follow: true } };

export default function PrivacyPage() {
  return (
    <>
      <Nav solid />
      <main className="page-main privacy-main">
        <div className="wrap privacy-wrap">
          <span className="kicker kicker--accent">Privacy</span>
          <h1>What we keep, and why.</h1>
          <p className="privacy-intro">
            This notice explains how Sala Nera, a Blackhall Media Group collection, handles information
            submitted through this website and its client portal. Effective November 14, 2026.
          </p>

          <section className="privacy-section">
            <h2>Information we receive</h2>
            <p>
              <strong>Inquiries.</strong> When you contact us, we receive what you choose to send: your name,
              email address, the property and your message.
            </p>
            <p>
              <strong>Bookings.</strong> When you book a shoot, we keep your name, email, phone number and
              brokerage, the property address and details, the services you choose, the date and time of the
              shoot, any access instructions and notes, and the name you type to accept our terms.
            </p>
            <p>
              <strong>Your client account.</strong> A booking creates an account under your email address. You
              sign in with a link we email you; there is no password. Signing in sets one cookie that keeps you
              signed in on that device for up to 30 days. We use no advertising or analytics cookies.
            </p>
            <p>
              <strong>Your listing.</strong> We store the photographs, films and floor plans we make for you,
              the invoice for the work and whether it has been paid, a record of downloads, and any property
              details you or we add, such as price, bedrooms and a description.
            </p>
            <p>
              <strong>Technical logs.</strong> Our hosting provider processes standard request logs to operate
              and secure the site.
            </p>
          </section>

          <section className="privacy-section">
            <h2>How we use it</h2>
            <p>
              We use this information to answer inquiries, schedule and carry out shoots, deliver your media,
              bill for the work, and protect the site from misuse. We email you about your booking, your
              gallery and your invoice. We do not sell personal information or use it for unrelated
              advertising.
            </p>
          </section>

          <section className="privacy-section">
            <h2>Property websites</h2>
            <p>
              Once a listing is paid for, it gets a property website for sharing with buyers, plus a version
              without agent or brokerage details for the MLS. Anyone with the link can view them. They show
              the photographs, films, floor plans and the property details entered for that listing, and the
              branded version shows the agent&rsquo;s name and contact details. We ask search engines not to
              list them.
            </p>
          </section>

          <section className="privacy-section">
            <h2>Service providers</h2>
            <p>
              We use a small number of providers, each only as far as its service needs: Vercel hosts the
              website, Neon stores our database, Cloudflare R2 stores photographs and other media, Resend
              delivers our emails, Google Calendar holds our shoot schedule, Google Maps looks up property
              addresses to work out travel, and Stripe processes card payments. Card details are entered on
              Stripe&rsquo;s pages; we never see or store them. Each provider is subject to its own privacy
              and security terms.
            </p>
          </section>

          <section className="privacy-section">
            <h2>Retention and choices</h2>
            <p>
              We keep booking, gallery and invoice records for as long as we need them to deliver and support
              your work, keep business and tax records, and meet legal obligations. You can ask to see,
              correct or delete your information, your account or your galleries at any time by emailing{' '}
              <a href="mailto:nblackhall@blackhallmediagroup.com">nblackhall@blackhallmediagroup.com</a>.
              Some records, such as invoices, may have to be kept for tax purposes.
            </p>
          </section>
        </div>
      </main>
      <Footer compact />
    </>
  );
}
