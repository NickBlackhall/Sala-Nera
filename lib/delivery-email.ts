/**
 * The "your photos are ready" email Nick sends from a listing in /admin.
 *
 * Two versions, picked by the payment lock at the moment he presses send:
 *
 *   preview  still locked: look now, downloads unlock once payment is in
 *   ready    paid: download now, plus the property website links
 *
 * Plain text, like every other email the site sends. The link goes to the
 * delivery page; an agent who is not signed in is sent through sign-in and
 * back to this listing, not to their list of listings.
 */

export type DeliveryKind = 'preview' | 'ready';

export function deliveryEmail(input: {
  kind: DeliveryKind;
  name: string | null;
  email: string;
  address: string;
  slug: string;
  photos: number;
  films: number;
  base: string;
}): { subject: string; text: string } {
  const { kind, address, slug, photos, films, base } = input;
  const firstName = input.name?.trim().split(/\s+/)[0];

  // "photos", "film", "photos and films" — whatever was actually delivered.
  const filmWord = films === 1 ? 'film' : 'films';
  const what =
    photos > 0 && films > 0 ? `photos and ${filmWord}` : photos > 0 ? 'photos' : filmWord;
  const isAre = photos === 0 && films === 1 ? 'is' : 'are';
  const counts = [
    photos > 0 ? `${photos} ${photos === 1 ? 'photo' : 'photos'}` : null,
    films > 0 ? `${films} ${filmWord}` : null,
  ]
    .filter(Boolean)
    .join(' and ');

  const gallery = `${base}/portal/${slug}`;

  const subject =
    kind === 'preview'
      ? `Your ${what} ${isAre} ready to preview — ${address}`
      : `Your ${what} ${isAre} ready — ${address}`;

  const text = [
    `Hi ${firstName || 'there'},`,
    '',
    kind === 'preview'
      ? `Your ${what} for ${address} ${isAre} ready to preview:`
      : `Your ${what} for ${address} ${isAre} ready to download:`,
    '',
    gallery,
    '',
    // Sentences kept whole on one line each: hard-wrapped plain text reads
    // raggedly on a phone, which is where most agents will open this.
    `${counts}.`,
    kind === 'preview'
      ? 'Downloads unlock as soon as payment is received.'
      : photos > 0
        ? 'Choose High res for the MLS and print, or Low res for websites, social and email.'
        : null,
    '',
    ...(kind === 'ready'
      ? [
          'A property website to share with buyers:',
          `${base}/p/${slug}`,
          '',
          'The same page with no branding, for the MLS:',
          `${base}/p/${slug}/mls`,
          '',
        ]
      : []),
    `Sign in with this email address (${input.email}). There's no password — we'll email you a link.`,
    '',
    'Questions, or anything to change? Just reply to this email.',
    '',
    '— Sala Nera',
    '  A Blackhall Media Group collection · Dallas–Fort Worth',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, text };
}
