import 'server-only';

import { asc, eq, sql } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';
import { labelFromFilename } from '@/lib/floorplan-label';
import { floorplans, type Floorplan } from '@/lib/schema';

/**
 * Floor plans: a listing's plan drawings, several versions allowed.
 *
 * Nick uploads them on the admin listing page. They show on the property
 * website (both versions — the files carry no branding) and the agent
 * downloads them from the delivery page once the listing is paid for.
 */

/**
 * Postgres's "relation does not exist". The table arrives with migration
 * 0011, and a page that merely shows a listing must not break because that
 * has not run yet — it just has no floor plans to show.
 */
function tableMissing(error: unknown): boolean {
  const seen = new Set<unknown>();
  for (let e: unknown = error; e && typeof e === 'object' && !seen.has(e); e = (e as { cause?: unknown }).cause) {
    seen.add(e);
    if ((e as { code?: unknown }).code === '42P01') return true;
  }
  return false;
}

/**
 * In Nick's order — or null before migration 0011 has run. The admin page
 * needs to tell the two apart: with no table, an upload would store the file
 * and then have nowhere to record it.
 */
export async function getFloorplansIfReady(listingId: number): Promise<Floorplan[] | null> {
  try {
    return await getDatabase()
      .select()
      .from(floorplans)
      .where(eq(floorplans.listingId, listingId))
      .orderBy(asc(floorplans.sort), asc(floorplans.id));
  } catch (error) {
    if (tableMissing(error)) return null;
    throw error;
  }
}

/** For pages that only show plans: no table simply means none to show. */
export async function getFloorplans(listingId: number): Promise<Floorplan[]> {
  return (await getFloorplansIfReady(listingId)) ?? [];
}

export async function getFloorplan(id: number): Promise<Floorplan | null> {
  const [row] = await getDatabase().select().from(floorplans).where(eq(floorplans.id, id)).limit(1);
  return row ?? null;
}

export async function insertFloorplan(input: {
  listingId: number;
  r2Key: string;
  filename: string;
  bytes: number | null;
}): Promise<Floorplan> {
  const db = getDatabase();
  // New plans go after the ones already there. ::int because this driver
  // hands some aggregates back as strings.
  const [last] = await db
    .select({ max: sql<number | null>`max(${floorplans.sort})::int` })
    .from(floorplans)
    .where(eq(floorplans.listingId, input.listingId));
  const [row] = await db
    .insert(floorplans)
    .values({ ...input, sort: (last?.max ?? -1) + 1 })
    .returning();
  return row;
}

/** False when the row has gone: deleted while its copies were being made. */
export async function setFloorplanCopies(
  id: number,
  input: { gridKey: string; largeKey: string; width: number; height: number },
): Promise<boolean> {
  const rows = await getDatabase()
    .update(floorplans)
    .set(input)
    .where(eq(floorplans.id, id))
    .returning({ id: floorplans.id });
  return rows.length > 0;
}

export async function setFloorplanLabel(id: number, label: string | null): Promise<void> {
  await getDatabase().update(floorplans).set({ label }).where(eq(floorplans.id, id));
}

export async function deleteFloorplanRow(id: number): Promise<void> {
  await getDatabase().delete(floorplans).where(eq(floorplans.id, id));
}

/** The original and its copies, for deleting the bytes behind a row. */
export function floorplanObjectKeys(row: Pick<Floorplan, 'r2Key' | 'gridKey' | 'largeKey'>): string[] {
  return [row.r2Key, row.gridKey, row.largeKey].filter((k): k is string => Boolean(k));
}

/** Every object a listing's floor plans own. Read before the listing row goes: they cascade. */
export async function getListingFloorplanKeys(listingId: number): Promise<string[]> {
  return (await getFloorplans(listingId)).flatMap(floorplanObjectKeys);
}

/**
 * What a visitor reads for one plan: Nick's label; failing that, the floor
 * named in the filename ("First floor", "All floors"); failing that, "Floor
 * plan", numbered when there is more than one. Never the raw filename.
 */
export function floorplanTitle(
  plan: Pick<Floorplan, 'label' | 'filename'>,
  index: number,
  total: number,
): string {
  return (
    plan.label?.trim() ||
    labelFromFilename(plan.filename) ||
    (total > 1 ? `Floor plan ${index + 1}` : 'Floor plan')
  );
}
