import type { Listing, Media } from './schema';

/**
 * Demo data so the portal renders before Neon and R2 exist. Every reader of
 * listing/media data falls back to this when DATABASE_URL is unset, which is
 * how the gallery can be reviewed before any account is created.
 */

export const DEMO_CLIENT = {
  id: 1,
  email: 'agent@briggsfreeman.com',
  name: 'Demo Agent',
  company: 'Briggs Freeman Sotheby’s',
  phone: null,
  stripeCustomerId: null,
  team: 'demo-team',
  createdAt: new Date('2026-08-01'),
};

export const DEMO_LISTING: Listing = {
  id: 1,
  clientId: 1,
  address: '4200 Preston Hollow Lane',
  slug: 'preston-hollow-lane',
  city: 'Dallas, TX',
  shootDate: new Date('2026-08-14'),
  coverKey: '/demo/elevation-dusk.jpg',
  downloadLocked: true,
  createdAt: new Date('2026-08-14'),
};

const PHOTOS: Array<[string, string, number, number]> = [
  ['living-room', 'Living room', 1600, 1067],
  ['stair-detail', 'Stair detail', 1067, 1600],
  ['kitchen', 'Kitchen', 1600, 1067],
  ['courtyard', 'Courtyard', 1067, 1600],
  ['primary-suite', 'Primary suite', 1600, 1067],
  ['study', 'Study', 1067, 1600],
  ['pool-terrace', 'Pool terrace', 1600, 1067],
  ['entry', 'Entry', 1067, 1600],
  ['aerial', 'Aerial', 1600, 900],
  ['elevation-dusk', 'Elevation at dusk', 1600, 900],
];

/** Second listing, paid — so both sides of the payment gate can be reviewed. */
export const DEMO_LISTING_PAID: Listing = {
  ...DEMO_LISTING,
  id: 2,
  address: '18 Rockwall Shores Drive',
  slug: 'rockwall-shores-drive',
  city: 'Rockwall, TX',
  coverKey: '/demo/courtyard.jpg',
  downloadLocked: false,
};

export const DEMO_MEDIA: Media[] = PHOTOS.map(([key, label, w, h], i) => ({
  id: i + 1,
  listingId: 1,
  kind: 'photo',
  r2Key: `/demo/${key}.jpg`,
  filename: `SN-${String(i + 1).padStart(3, '0')}-${label.toLowerCase().replace(/\s+/g, '-')}.jpg`,
  bytes: 4_200_000,
  width: w,
  height: h,
  sort: i,
}));

export const DEMO_LISTINGS = [DEMO_LISTING, DEMO_LISTING_PAID];

export const IS_DEMO = !process.env.DATABASE_URL;
