/**
 * Arranging a listing's media in admin: one order, and for photos a section,
 * ground or aerial. The property website shows the aerials in a section of
 * their own (lib/property-site.ts).
 *
 * Pure, and deliberately free of drag events: the admin grid's mouse drag
 * calls `moveMedia`, and a touch handler added later can call the very same
 * function (Nick, Nov 13: mouse now, touch planned).
 */

export type Zone = 'ground' | 'aerial';

/**
 * Is this an aerial? Nick's own call for the photo if he has made one (he
 * dragged it into or out of Aerials); otherwise the filename, because a drone
 * names its files DJI_… and he uploads them as they come off the card. The
 * filename is only the first guess: he also flies the drone at eye level.
 * A video is never an aerial here; films have their own section.
 */
export function isAerialPhoto(m: { kind: string; filename: string; aerial: boolean | null }): boolean {
  if (m.kind !== 'photo') return false;
  return m.aerial ?? /^DJI_/i.test(m.filename);
}

type Placed = { id: number; kind: string; aerial: boolean };

/**
 * Move the given items into a section, immediately before `beforeId`, or to
 * the end of that section when `beforeId` is null. They keep their relative
 * order, and everything else closes up behind them.
 *
 * - Videos never enter Aerials: any in the group stay where they were.
 * - Dropping a group on one of its own members changes nothing.
 * - Moved into an empty section, items keep their place in the overall
 *   order, since there is nothing there to sit beside.
 *
 * Returns the same array when nothing changed, so a caller can tell.
 */
export function moveMedia<T extends Placed>(list: T[], movingIds: Set<number>, zone: Zone, beforeId: number | null): T[] {
  const toAerial = zone === 'aerial';
  const moving = list.filter((m) => movingIds.has(m.id) && (!toAerial || m.kind === 'photo'));
  if (moving.length === 0) return list;
  const ids = new Set(moving.map((m) => m.id));
  if (beforeId !== null && ids.has(beforeId)) return list;

  const moved = moving.map((m) => ({ ...m, aerial: toAerial }));
  const rest = list.filter((m) => !ids.has(m.id));

  let next: T[];
  if (beforeId !== null) {
    const at = rest.findIndex((m) => m.id === beforeId);
    if (at === -1) return list; // the target was deleted mid-drag elsewhere
    next = [...rest.slice(0, at), ...moved, ...rest.slice(at)];
  } else {
    let last = -1;
    rest.forEach((m, i) => {
      if (m.aerial === toAerial) last = i;
    });
    next =
      last === -1
        ? list.map((m) => (ids.has(m.id) ? { ...m, aerial: toAerial } : m))
        : [...rest.slice(0, last + 1), ...moved, ...rest.slice(last + 1)];
  }

  const same = next.every((m, i) => m.id === list[i].id && m.aerial === list[i].aerial);
  return same ? list : next;
}
