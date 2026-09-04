import 'server-only';

/**
 * Resend, called directly over HTTP — same approach as the inquiry route, so
 * there is no SDK to keep in step with. Returns false rather than throwing:
 * callers here must not leak send failures to the visitor.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  const { RESEND_API_KEY, FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    console.error('email: missing RESEND_API_KEY or FROM_EMAIL');
    return false;
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });

    if (!r.ok) {
      console.error('email: resend rejected', r.status, await r.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('email: send threw', err);
    return false;
  }
}
