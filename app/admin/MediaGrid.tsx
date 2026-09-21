'use client';

import { useState } from 'react';
import type { MediaView } from '@/lib/media-view';
import DeleteMedia from './DeleteMedia';
import { reorderMediaAction, setCoverAction } from './actions';

/** Sentinel for "hovering the end-of-grid drop zone" — no real media id is negative. */
const END_ZONE = -1;

/**
 * The media grid: reorder by dragging, select several with the checkbox and
 * drag them as one group — the "move a whole room of photos" case.
 *
 * Native HTML5 drag events rather than a library, matching how the rest of this
 * codebase handles interaction — and mouse-only as a result. Touch devices do
 * not fire these events, so reordering from a phone needs pointer events and is
 * deliberately not built yet.
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
  const [items, setItems] = useState(media);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragIds, setDragIds] = useState<Set<number> | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Uploads and deletes re-render this page with a different set of media, and
  // that set has to win. A different *order* on the same set does not: while a
  // save is in flight the dragged order is the newer truth, and taking the
  // server's copy would snap the tiles back before the write even landed.
  const incoming = media.map((m) => m.id).sort().join(',');
  const [syncedSet, setSyncedSet] = useState(incoming);
  if (incoming !== syncedSet) {
    setSyncedSet(incoming);
    setItems(media);
    setSelected(new Set());
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /**
   * Put the dragged photo — or, if several are selected, all of them together
   * in their current relative order — immediately before the dropped-on tile.
   * Everything else closes up behind them.
   *
   * "Before the target, always" rather than a direction-dependent rule (drop
   * forward lands after, drop backward lands before) is deliberate: that
   * asymmetry only has one sensible generalization for a single tile. For a
   * group scattered on both sides of the target, there is no single
   * "direction" to key off, so one flat rule that a group and a lone tile both
   * obey the same way is what stays predictable.
   *
   * This runs once, on drop, not continuously while dragging over. Reordering
   * live on every dragover feeds back on itself — moving a tile under the
   * cursor changes which tile is under the cursor — which is exactly the bug a
   * short single-tile drag survived and a long one across rows did not.
   */
  function reordered(list: MediaView[], movingIds: Set<number>, targetId: number): MediaView[] {
    if (movingIds.has(targetId)) return list; // dropped inside your own selection

    const moving = list.filter((m) => movingIds.has(m.id));
    const rest = list.filter((m) => !movingIds.has(m.id));
    const targetIndex = rest.findIndex((m) => m.id === targetId);
    if (targetIndex === -1) return list; // the target was deleted mid-drag elsewhere

    rest.splice(targetIndex, 0, ...moving);
    return rest;
  }

  async function save(order: MediaView[]) {
    // Picked tiles up and put them back down: nothing to write.
    const unchanged = order.every((m, i) => media[i]?.id === m.id);
    if (unchanged) return;

    // A failed save leaves the database on the old order, so the tiles go back
    // to it too — including when the request never arrives at all. Showing the
    // new order over old data is the one outcome worth avoiding: it reads as
    // saved, and the client's gallery would disagree with what Nick sees.
    try {
      const result = await reorderMediaAction({
        listingId,
        orderedIds: order.map((m) => m.id),
      });
      if (result.error) {
        setItems(media);
        setError(result.error);
      }
    } catch {
      setItems(media);
      setError('That new order was not saved — check your connection and try again.');
    }
  }

  function drop(targetId: number) {
    if (!dragIds) return;
    const next = reordered(items, dragIds, targetId);
    setItems(next);
    setDragIds(null);
    setOverId(null);
    setError(null);
    void save(next);
  }

  /** Dropped onto empty space below the grid: send the group to the very end. */
  function dropAtEnd() {
    if (!dragIds) return;
    const moving = items.filter((m) => dragIds.has(m.id));
    const rest = items.filter((m) => !dragIds.has(m.id));
    const next = [...rest, ...moving];
    setItems(next);
    setDragIds(null);
    setOverId(null);
    setError(null);
    void save(next);
  }

  return (
    <>
      <p className="admin-muted admin-media-hint">
        Check a few photos to move them together, or just drag one. The order
        here is the order clients see.
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

      <ul className="admin-media">
        {items.map((item) => {
          const isDragging = dragIds?.has(item.id) ?? false;
          const isSelected = selected.has(item.id);

          return (
            <li
              key={item.id}
              data-media-id={item.id}
              draggable
              onDragStart={(e) => {
                // Dragging a tile that's part of the current selection moves
                // the whole group; dragging any other tile drags just that
                // one, and replaces whatever was selected — the same rule a
                // file manager uses, so an old forgotten selection can't
                // silently hitch a ride.
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
                drop(item.id);
              }}
              // Fires whether or not the drop landed on a tile, so photos let
              // go over empty space simply put themselves back.
              onDragEnd={() => {
                setDragIds(null);
                setOverId(null);
              }}
              className={
                [
                  isDragging ? 'admin-media-dragging' : '',
                  overId === item.id ? 'admin-media-over' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
            >
              <div className="admin-media-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt=""
                  loading="lazy"
                  // An image is draggable on its own, and that drag carries the
                  // file rather than the tile — which would make it unsortable.
                  draggable={false}
                />
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
                  ) : (
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
        })}
      </ul>

      {/*
       * The grid is a packed CSS grid, so it has no empty space of its own to
       * drop into — without this, "send the group to the end" has nowhere to
       * land. Only shown mid-drag: it would be a strange, unexplained bar to
       * see sitting under the photos the rest of the time.
       */}
      {dragIds && (
        <div
          className={`admin-media-endzone${overId === END_ZONE ? ' admin-media-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setOverId(END_ZONE);
          }}
          onDragLeave={() => setOverId((current) => (current === END_ZONE ? null : current))}
          onDrop={(e) => {
            e.preventDefault();
            dropAtEnd();
          }}
        >
          Drop here to move to the end
        </div>
      )}
    </>
  );
}
