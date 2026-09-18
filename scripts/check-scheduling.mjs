/**
 * Checks lib/scheduling.ts against Nick's stated rules.
 *
 * The rules are his, given directly on Sep 18, and getting one wrong books a
 * real person into a day he cannot do — so they are pinned here rather than
 * left to be re-read out of the implementation. The daylight-saving cases
 * matter more than they look: the 60-day booking horizon routinely spans the
 * November switch, and an hour of drift there would offer 7am starts.
 *
 *   node scripts/check-scheduling.mjs
 */

import {
  availableSlots,
  isSlotAvailable,
  zonedTime,
  zonedDate,
  SHOOT_HOURS,
  MIN_NOTICE_HOURS,
} from '../lib/scheduling.ts';

let failures = 0;
const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const HOUR = 3_600_000;
// A Monday, well clear of any DST boundary.
const MONDAY = new Date('2026-10-05T12:00:00Z');
const local = (slot) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    hour12: true,
  }).format(slot.start);

console.log('\nTime zone handling');
{
  // CDT (UTC-5) through Nov 1 2026, CST (UTC-6) after.
  check('8am CDT in October is 13:00 UTC', zonedTime('2026-10-15', 8).toISOString() === '2026-10-15T13:00:00.000Z');
  check('8am CST in November is 14:00 UTC', zonedTime('2026-11-15', 8).toISOString() === '2026-11-15T14:00:00.000Z');
  check('an instant maps back to its local day', zonedDate(new Date('2026-11-15T05:30:00Z')) === '2026-11-14');
}

console.log('\nWorking days and hours');
{
  const slots = availableSlots({ from: MONDAY, busy: [], horizonDays: 21 });
  const days = new Set(
    slots.map((s) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).format(s.start)),
  );
  check('never offers Friday, Saturday or Sunday', !['Fri', 'Sat', 'Sun'].some((d) => days.has(d)), [...days].join(','));
  check('offers Monday through Thursday', ['Mon', 'Tue', 'Wed', 'Thu'].every((d) => days.has(d)), [...days].join(','));

  const starts = new Set(
    slots.map((s) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }).format(s.start))),
  );
  check('only starts at 8, 9, 10 or 11am', [...starts].every((h) => [8, 9, 10, 11].includes(h)), [...starts].join(','));
  check('every shoot is six hours', slots.every((s) => s.end - s.start === SHOOT_HOURS * HOUR));
  check('nothing runs past 5pm', slots.every((s) => s.end <= zonedTime(s.date, 17)));
}

console.log('\nDaylight saving (Nov 1 2026)');
{
  // Far enough out that the horizon lands the other side of the switch.
  const slots = availableSlots({ from: new Date('2026-10-20T12:00:00Z'), busy: [], horizonDays: 30 });
  const after = slots.filter((s) => s.date > '2026-11-01');
  check('slots exist past the switch', after.length > 0);
  check(
    'post-switch slots still start on the hour, 8-11am local',
    after.every((s) => {
      const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }).format(s.start));
      return [8, 9, 10, 11].includes(h);
    }),
  );
  check('a post-switch shoot is still six real hours', after.every((s) => s.end - s.start === SHOOT_HOURS * HOUR));
}

console.log('\nNotice period');
{
  const slots = availableSlots({ from: MONDAY, busy: [], horizonDays: 14 });
  const earliest = new Date(MONDAY.getTime() + MIN_NOTICE_HOURS * HOUR);
  check('nothing bookable inside 48 hours', slots.every((s) => s.start >= earliest), local(slots[0]));
  check('the first slot is on the third day out', slots[0] && slots[0].date === '2026-10-07', slots[0] && local(slots[0]));
}

console.log('\nCalendar conflicts');
{
  // Nick's real Sep 23 shape: a BMG booking 1:30-5:30pm leaves no room for six
  // hours plus buffer before it, so the whole day should disappear.
  const busyDay = '2026-10-14';
  const busy = [{ start: zonedTime(busyDay, 13.5), end: zonedTime(busyDay, 17.5) }];
  const slots = availableSlots({ from: MONDAY, busy, horizonDays: 21 });
  check('a 1:30-5:30pm commitment clears that whole day', !slots.some((s) => s.date === busyDay));
  check('neighbouring days are untouched', slots.some((s) => s.date === '2026-10-15'));

  // A short morning appointment takes out every start it overlaps, and the
  // survivor pins the buffer's exact edge: a 9-10am appointment leaves 11am
  // standing, because 10am plus the owed hour is 11am on the nose. If this
  // ever starts failing in the direction of "10am is fine too", the buffer
  // has stopped being applied.
  const shortDay = '2026-10-21';
  const short = [{ start: zonedTime(shortDay, 9), end: zonedTime(shortDay, 10) }];
  const shortSlots = availableSlots({ from: MONDAY, busy: short, horizonDays: 21 }).filter((s) => s.date === shortDay);
  check(
    'a 9-10am appointment leaves exactly one start: 11am, the buffer boundary',
    shortSlots.length === 1 && shortSlots[0].start.getTime() === zonedTime(shortDay, 11).getTime(),
    shortSlots.map(local).join(', ') || 'none',
  );

  // The buffer itself: a commitment starting exactly when a shoot ends is
  // still a conflict, because there is an hour of gap owed.
  const tightDay = '2026-10-28';
  const tight = [{ start: zonedTime(tightDay, 14), end: zonedTime(tightDay, 15) }];
  const tightSlots = availableSlots({ from: MONDAY, busy: tight, horizonDays: 28 }).filter((s) => s.date === tightDay);
  check('an 8am start is refused when something begins at 2pm', !tightSlots.some((s) => s.start.getTime() === zonedTime(tightDay, 8).getTime()));
}

console.log('\nOne Sala Nera booking a day');
{
  const all = availableSlots({ from: MONDAY, busy: [], horizonDays: 21 });
  const day = all[0].date;
  const after = availableSlots({ from: MONDAY, busy: [], takenDates: [day], horizonDays: 21 });
  check('a taken date offers nothing at all', !after.some((s) => s.date === day));
  check('other dates are unaffected', after.length === all.length - all.filter((s) => s.date === day).length);
}

console.log('\nServer-side re-check');
{
  const slots = availableSlots({ from: MONDAY, busy: [], horizonDays: 14 });
  const good = slots[0];
  check('accepts a slot it offered', isSlotAvailable(good.start, { from: MONDAY, busy: [], horizonDays: 14 }));
  check(
    'rejects that same slot once the day is taken',
    !isSlotAvailable(good.start, { from: MONDAY, busy: [], takenDates: [good.date], horizonDays: 14 }),
  );
  check(
    'rejects a 7am start it never offered',
    !isSlotAvailable(zonedTime(good.date, 7), { from: MONDAY, busy: [], horizonDays: 14 }),
  );
}

console.log('');
if (failures) {
  console.error(`${failures} scheduling check(s) failed.`);
  process.exit(1);
}
console.log('All scheduling checks passed.\n');
