/**
 * A floor plan's name, guessed from its filename, so Nick doesn't have to
 * type one. Drafting services name files like
 * `1st_floor_600_n_brookside_dr_dallas_with_dim.jpg` or
 * `all_floors_….jpg`. Anything unrecognised gives null, and the plan falls
 * back to "Floor plan 2" and so on. A label Nick types always wins.
 *
 * Pure, so the admin page (a client component) can show the same guess the
 * site will use.
 */

// An ordinal counts only when it sits right next to a floor word, so an
// address like "100 1st Street" can't name the floor.
const ORDINAL: Record<string, string> = {
  '1st': 'First', first: 'First', '1': 'First', one: 'First',
  '2nd': 'Second', second: 'Second', '2': 'Second', two: 'Second',
  '3rd': 'Third', third: 'Third', '3': 'Third', three: 'Third',
  '4th': 'Fourth', fourth: 'Fourth', '4': 'Fourth', four: 'Fourth',
};
const ORD = Object.keys(ORDINAL).join('|');
const FLOOR = 'floor|level|lvl|fl|story|storey';

/** Lower case, words split on _ - . +, "2ndfloor" → "2nd floor", padded with spaces. */
function normalise(filename: string): string {
  return ` ${filename
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[_\-.+]+/g, ' ')
    .replace(/(\d)(st|nd|rd|th)?(floor|level|lvl|fl)\b/g, '$1$2 $3')
    .replace(/\b(floor|level|lvl|fl)(\d)\b/g, '$1 $2')} `;
}

export function labelFromFilename(filename: string): string | null {
  const name = normalise(filename);

  // "All floors" first: it names several floors.
  if (/\b(all|full|combined|whole) (floors?|levels?|house|home)\b|\bfloors? (all|combined)\b/.test(name)) return 'All floors';
  if (/\bsite plan\b|\bplot plan\b/.test(name)) return 'Site plan';
  if (/\b(guest ?house|casita|adu|pool ?house)\b/.test(name)) {
    if (/\bcasita\b/.test(name)) return 'Casita';
    if (/\bpool ?house\b/.test(name)) return 'Pool house';
    return 'Guest house';
  }
  if (/\b(basement|cellar)\b/.test(name)) return 'Basement';

  const before = name.match(new RegExp(`\\b(${ORD}) (?:${FLOOR})\\b`));
  if (before) return `${ORDINAL[before[1]]} floor`;
  const after = name.match(new RegExp(`\\b(?:${FLOOR}) (${ORD})\\b`));
  if (after) return `${ORDINAL[after[1]]} floor`;
  const side = name.match(new RegExp(`\\b(ground|main|upper|lower|upstairs|downstairs) (?:${FLOOR})\\b`));
  if (side) {
    const words: Record<string, string> = {
      ground: 'Ground floor', main: 'Main floor', upper: 'Upper floor', upstairs: 'Upper floor',
      lower: 'Lower floor', downstairs: 'Lower floor',
    };
    return words[side[1]];
  }
  // After the floors: "1st_floor_with_garage" is the first floor.
  if (/\bgarage\b/.test(name)) return 'Garage';
  if (/\battic\b/.test(name)) return 'Attic';
  return null;
}

/**
 * Whether the filename says the plan has measurements drawn on: "with_dim",
 * "dimensions", "dimensioned" → 'with'; "no_dim", "without_dimensions",
 * "undimensioned" → 'without'; nothing said → null.
 */
export function dimensionsFromFilename(filename: string): 'with' | 'without' | null {
  const name = normalise(filename);
  const dim = '(?:dims?|dimensions?|dimensioned)';
  if (new RegExp(`\\b(?:no|without|wo|non) ?${dim}\\b|\\bundimensioned\\b|\\bnodims?\\b`).test(name)) return 'without';
  if (new RegExp(`\\b${dim}\\b`).test(name)) return 'with';
  return null;
}

type Named = { label: string | null; filename: string };

/**
 * What a visitor reads for one plan: Nick's label; failing that, the floor
 * named in the filename ("First floor", "All floors"); failing that, "Floor
 * plan", numbered when there is more than one. Never the raw filename.
 *
 * When the same floor is there twice, once with measurements and once
 * without (Nick often delivers both), each says which: "First floor (with
 * dimensions)". A file that says nothing is taken as the other kind of its
 * twin. With one version, the name stays plain.
 */
export function floorplanTitle(plan: Named, index: number, plans: readonly Named[]): string {
  const typed = plan.label?.trim();
  if (typed) return typed;

  const base = labelFromFilename(plan.filename);
  if (!base) return plans.length > 1 ? `Floor plan ${index + 1}` : 'Floor plan';

  const twins = plans.filter((p, i) => i !== index && labelFromFilename(p.filename) === base);
  if (twins.length === 0) return base;

  let dims = dimensionsFromFilename(plan.filename);
  if (!dims) {
    const other = twins.map((t) => dimensionsFromFilename(t.filename));
    if (other.includes('with')) dims = 'without';
    else if (other.includes('without')) dims = 'with';
  }
  return dims ? `${base} (${dims === 'with' ? 'with' : 'no'} dimensions)` : base;
}
