'use client';

import { useState } from 'react';
import { isAerialPhoto, moveMedia, type Zone } from '@/lib/media-arrange';
import type { MediaView } from '@/lib/media-view';
import DeleteMedia from './DeleteMedia';
import { arrangeMediaAction, setCoverAction } from './actions';

/** Sentinels for "hovering a section's drop zone" — no real media id is negative. */
const END: Record<Zone, number> = { ground: -1, aerial: -2 };

/** A tile as the grid holds it: `aerial` already settled to yes or no. */
type Item = Omit<MediaView, 'aerial'> & { aerial: boolean };

const settle = (media: MediaView[]): Item[] => media.map((m) => ({ ...m, aerial: isAerialPhoto(m) }));

/**
 * The media grid, in two sections: Photos (with any film) and Aerials.
 * Reorder by dragging, select several with the checkbox and drag them as one
 * group — the "move a whole room of photos" case. Dragging a photo into the
 * other section moves it there: nothing is uploaded or rendered again, it
 * only changes which section of the property website shows it. Drone files
 * (DJI_…) start in Aerials as a first guess; a drag is Nick's own call and
 * sticks (lib/media-arrange.ts).
 *
 * Native HTML5 drag events rather than a library, matching how the rest of this
 * codebase handles interaction — and mouse-only as a result. Touch devices do
 * not fire these events. Touch is planned, not built: every drop goes through
 * `place()`, which knows nothing about drag events, so a pointer-event handler
 * can call it too.
 */
export default function MediaGrid({
  listingId,
  coverKey,
  media,
}: {
  listingId: number;
  coverKey: string | null;
  media: MediaView[];
}) {
  const [items, setItems] = useState(() => settle(media));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragIds, setDragIds] = useState<Set<number> | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Uploads and deletes re-render this page with a different set of media, and
  // that set has to win. A different *arrangement* of the same set does not:
  // while a save is in flight the dragged one is the newer truth, and taking
  // the server's copy would snap the tiles back before the write even landed.
  const incoming = media.map((m) => m.id).sort().join(',');
  const [syncedSet, setSyncedSet] = useState(incoming);
  if (incoming !== syncedSet) {
    setSyncedSet(incoming);
    setItems(settle(media));
    setSelected(new Set());
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save(next: Item[]) {
    // A failed save leaves the database as it was, so the tiles go back to it
    // too — including when the request never arrives at all. Showing the new
    // arrangement over old data is the one outcome worth avoiding: it reads as
    // saved, and the property website would disagree with what Nick sees.
    try {
      const result = await arrangeMediaAction({
        listingId,
        orderedIds: next.map((m) => m.id),
        aerialIds: next.filter((m) => m.aerial).map((m) => m.id),
      });
      if (result.error) {
        setItems(settle(media));
        setError(result.error);
      }
    } catch {
      setItems(settle(media));
      setError('That change was not saved — check your connection and try again.');
    }
  }

  /**
   * Put these photos in a section: immediately before `beforeId`, or at the
   * section's end when it is null. The one place an arrangement changes, and
   * free of drag events on purpose (see above).
   *
   * "Before the target, always" rather than a direction-dependent rule (drop
   * forward lands after, drop backward lands before) is deliberate: for a
   * group scattered on both sides of the target there is no single
   * "direction" to key off, so one flat rule that a group and a lone tile
   * both obey is what stays predictable.
   *
   * This runs once, on drop, not continuously while dragging over. Reordering
   * live on every dragover feeds back on itself — moving a tile under the
   * cursor changes which tile is under the cursor.
   */
  function place(ids: Set<number>, zone: Zone, beforeId: number | null) {
    const next = moveMedia(items, ids, zone, beforeId);
    setDragIds(null);
    setOverId(null);
    if (next === items) {
      // Picked tiles up and put them back down: nothing to write. The one
      // case worth a word is a film let go over Aerials, which refuses it.
      const onlyFilm = zone === 'aerial' && items.some((m) => ids.has(m.id) && m.kind !== 'photo');
      setError(onlyFilm ? 'Films stay in the first section; only photos can be aerials.' : null);
      return;
    }
    setItems(next);
    setError(null);
    void save(next);
  }

  const hasPhotos = items.some((m) => m.kind === 'photo');
  const hasFilm = items.some((m) => m.kind !== 'photo');
  const zones: Array<{ zone: Zone; label: string; items: Item[] }> = [
    { zone: 'ground', label: hasFilm ? 'Photos and film' : 'Photos', items: items.filter((m) => !m.aerial) },
    // Only photos can be aerials, so a listing with none has no second section.
    ...(hasPhotos ? [{ zone: 'aerial' as const, label: 'Aerials', items: items.filter((m) => m.aerial) }] : []),
  ];

  const tile = (item: Item) => {
    const isDragging = dragIds?.has(item.id) ?? false;
    const isSelected = selected.has(item.id);
    const zone: Zone = item.aerial ? 'aerial' : 'ground';

    return (
      <li
        key={item.id}
        data-media-id={item.id}
        draggable
        onDragStart={(e) => {
          // Dragging a tile that's part of the current selection moves the
          // whole group; dragging any other tile drags just that one, and
          // replaces whatever was selected — the same rule a file manager
          // uses, so an old forgotten selection can't silently hitch a ride.
          const group = isSelected && selected.size > 1 ? selected : new Set([item.id]);
          if (!isSelected) setSelected(new Set());
          setDragIds(group);
          // Firefox starts no drag at all without data on the transfer.
          e.dataTransfer.setData('text/plain', String(item.id));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          if (dragIds && !dragIds.has(item.id)) setOverId(item.id);
        }}
        onDragLeave={() => setOverId((current) => (current === item.id ? null : current))}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dragIds) place(dragIds, zone, item.id);
        }}
        // Fires whether or not the drop landed on a tile, so photos let go
        // over empty space simply put themselves back.
        onDragEnd={() => {
          setDragIds(null);
          setOverId(null);
        }}
        className={
          [isDragging ? 'admin-media-dragging' : '', overId === item.id ? 'admin-media-over' : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
      >
        <div className="admin-media-thumb">
          {item.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.previewUrl}
              alt=""
              loading="lazy"
              // An image is draggable on its own, and that drag carries the
              // file rather than the tile — which would make it unsortable.
              draggable={false}
            />
          ) : (
            // A video with no still yet: its file is not a picture.
            <span className="admin-media-novideo">Video</span>
          )}
          <input
            type="checkbox"
            className="admin-media-select"
            checked={isSelected}
            onChange={() => toggleSelected(item.id)}
            aria-label={`Select ${item.filename}`}
          />
        </div>
        <div>
          <span className="admin-strong">{item.filename}</span>
          <span className="admin-muted">
            {item.kind}
            {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
          </span>
          <div className="admin-media-actions">
            {coverKey === item.r2Key ? (
              <span className="admin-cover-flag">Cover</span>
            ) : item.kind === 'video' ? null : (
              <form action={setCoverAction}>
                <input type="hidden" name="id" value={listingId} />
                <input type="hidden" name="coverKey" value={item.r2Key} />
                <button type="submit">Use as cover</button>
              </form>
            )}
            <DeleteMedia id={item.id} filename={item.filename} />
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      <p className="admin-muted admin-media-hint">
        Check a few photos to move them together, or just drag one. The order
        here is the order clients see.
        {hasPhotos && ' Drag a photo into Aerials, or back out, to choose its section on the property website.'}
        {selected.size > 0 && (
          <>
            {' — '}
            {selected.size} selected{' '}
            <button
              type="button"
              className="admin-media-clear-selection"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </>
        )}
      </p>
      {error && <p className="form-error">{error}</p>}

      {zones.map(({ zone, label, items: inZone }) => (
        <section key={zone} className="admin-media-zone" aria-label={label}>
          {zones.length > 1 && (
            <h3 className="admin-media-zone-title">
              {label} <span>{inZone.length}</span>
            </h3>
          )}
          {inZone.length > 0 && <ul className="admin-media">{inZone.map(tile)}</ul>}

          {/*
           * Each grid is a packed CSS grid, so it has no empty space of its
           * own to drop into — without this, "send the group to the end" has
           * nowhere to land. Shown mid-drag only, except on an empty section,
           * where it is always there: it is the only way in.
           */}
          {(dragIds || inZone.length === 0) && (
            <div
              className={[
                'admin-media-endzone',
                inZone.length === 0 ? 'admin-media-endzone--empty' : '',
                overId === END[zone] ? 'admin-media-over' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOverId(END[zone]);
              }}
              onDragLeave={() => setOverId((current) => (current === END[zone] ? null : current))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIds) place(dragIds, zone, null);
              }}
            >
              {inZone.length > 0
                ? `Drop here to move to the end of ${label}`
                : zone === 'aerial'
                  ? 'No aerials. Drag photos here to put them in the Aerials section.'
                  : 'Drag photos here to take them out of Aerials.'}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
