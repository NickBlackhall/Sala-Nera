// POST /api/inquiry — catches the Sala Nera lead form and emails it via Resend.
//
// Required environment variables (set in Vercel → Settings → Environment Variables):
//   RESEND_API_KEY   your key from resend.com
//   NOTIFY_EMAIL     where inquiries should land, e.g. nick@blackhallmediagroup.com
//   FROM_EMAIL       verified sender, e.g. "Sala Nera <inquiries@salanera.com>"
//
// CommonJS on purpose: no package.json, no dependencies, no build step.

const MAX = { name: 120, email: 200, phone: 40, property: 200, details: 4000 };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const clean = (v, limit) => String(v == null ? '' : v).trim().slice(0, limit);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // Honeypot: a hidden field only a bot fills in. Return 200 so it thinks it succeeded.
  if (clean(body.company, 50)) return res.status(200).json({ ok: true });

  const name     = clean(body.name, MAX.name);
  const email    = clean(body.email, MAX.email);
  const phone    = clean(body.phone, MAX.phone);
  const property = clean(body.property, MAX.property);
  const details  = clean(body.details, MAX.details);

  if (!name || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A name and a valid email address are required.' });
  }

  const { RESEND_API_KEY, NOTIFY_EMAIL, FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !NOTIFY_EMAIL || !FROM_EMAIL) {
    console.error('inquiry: missing env vars', {
      hasKey: !!RESEND_API_KEY, hasNotify: !!NOTIFY_EMAIL, hasFrom: !!FROM_EMAIL
    });
    return res.status(500).json({ error: 'not_configured' });
  }

  const text = [
    `New Sala Nera inquiry`,
    ``,
    `Name:     ${name}`,
    `Email:    ${email}`,
    `Phone:    ${phone || '—'}`,
    `Property: ${property || '—'}`,
    ``,
    `Details:`,
    details || '—',
    ``,
    `— sent from the Sala Nera site`
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [NOTIFY_EMAIL],
        reply_to: email,                    // hit Reply, it goes straight to the agent
        subject: `Sala Nera inquiry — ${property || name}`,
        text
      })
    });

    if (!r.ok) {
      console.error('inquiry: resend rejected', r.status, await r.text());
      return res.status(502).json({ error: 'send_failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('inquiry: send threw', err);
    return res.status(502).json({ error: 'send_failed' });
  }
};
