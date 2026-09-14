/**
 * The booking form's Agreement step — modeled on jacobguthrie.com/book's step
 * 7, "Shoot Terms & Conditions", where typing a full legal name serves as the
 * electronic signature. Nick has a real terms-of-service page already, but
 * asked (Sep 11) for a placeholder here for now — same shape as
 * RATES_ARE_PLACEHOLDER: an obvious stand-in, not a guess dressed up as real.
 *
 * Replace TERMS_TEXT with Nick's real terms, then set TERMS_ARE_PLACEHOLDER to
 * false — until then, the form and every booking email carry a warning that
 * this is not the actual agreement.
 */
export const TERMS_ARE_PLACEHOLDER = true;

export const TERMS_HEADING = 'Shoot Terms & Conditions';

export const TERMS_TEXT = `[Placeholder terms — Sala Nera's real shoot agreement goes here.]

By booking a shoot with Sala Nera, a Blackhall Media Group collection ("we", "us"), the client ("Client") will agree to terms covering usage rights and ownership of the resulting photos, video and other media, the license granted to the Client to use it, rescheduling and cancellation, and payment. None of that text is final yet — this paragraph is a stand-in so the step can be tested, not a real agreement to sign.`;
