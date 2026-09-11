/** The Details step's questions — shared so the server accepts only answers the form offers. */

export type DetailQuestion = {
  key: 'occupancy' | 'listingType' | 'offMarket' | 'facing' | 'viewHome' | 'homeownerHome';
  label: string;
  /** How the answer is labelled on the Review step and in Nick's booking email. */
  short: string;
  options: readonly string[];
  hint?: string;
};

export const DETAIL_QUESTIONS: DetailQuestion[] = [
  {
    key: 'occupancy',
    label: 'Current status',
    short: 'Status',
    options: ['Vacant, unstaged', 'Vacant, staged', 'Homeowner furniture', 'Unknown'],
  },
  {
    key: 'listingType',
    label: 'Listing type',
    short: 'Listing type',
    options: ['For sale', 'For lease', 'Short-term rental'],
  },
  { key: 'offMarket', label: 'Off-market listing?', short: 'Off-market', options: ['Yes', 'No'] },
  {
    key: 'facing',
    label: 'Which way does the front of the home face?',
    short: 'Front faces',
    options: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    hint: 'This tells us where the sun will be, and when the front, back and key rooms get their best light.',
  },
  { key: 'viewHome', label: 'Is this a view home?', short: 'View home', options: ['Yes', 'No'] },
  {
    key: 'homeownerHome',
    label: 'Will the homeowner be home during the shoot?',
    short: 'Homeowner home',
    options: ['Yes', 'No'],
    hint: 'We strongly recommend the home is empty for the shoot — it makes for a smoother visit and better images.',
  },
];

export type Details = Record<DetailQuestion['key'], string>;

export const EMPTY_DETAILS = Object.fromEntries(DETAIL_QUESTIONS.map((q) => [q.key, ''])) as Details;

/** Keeps only answers the form actually offers; anything else becomes blank. */
export function cleanDetails(raw: unknown): Details {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    DETAIL_QUESTIONS.map((q) => {
      const v = src[q.key];
      return [q.key, typeof v === 'string' && q.options.includes(v) ? v : ''];
    }),
  ) as Details;
}
