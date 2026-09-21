'use client';

import { useState } from 'react';
import type { MediaView } from '@/lib/media-view';
import DeleteMedia from './DeleteMedia';
import { reorderMediaAction, setCoverAction } from './actions';

/**
 * The media grid, reorderable by dragging one tile onto another.
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
  const [dragId, setDragId] = useState<number | null>(null);
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
  }

  /**
   * Put the dragged photo in the dropped-on photo's slot, everything else
   * closing up behind it.
   *
   * This runs once, on drop. Doing it continuously while dragging over — which
   * is the obvious way to get live feedback — feeds back on itself: moving a
   * tile under the cursor changes which tile is under the cursor, which moves
   * it again. Short drags survived that; dragging across rows scrambled.
   */
  function reordered(list: MediaView[], targetId: number): MediaView[] {
    if (dragId === null || dragId === targetId) return list;

    const from = list.findIndex((m) => m.id === dragId);
    const to = list.findIndex((m) => m.id === targetId);
    if (from === -1 || to === -1) return list;

    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  async function save(order: MediaView[]) {
    // Picked a tile up and put it back down: nothing to write.
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

  return (
    <>
      <p className="admin-muted admin-media-hint">
        Drag a photo onto another to reorder. The order here is the order clients see.
      </p>
      {error && <p className="form-error">{error}</p>}

      <ul className="admin-media">
        {items.map((item) => (
          <li
            key={item.id}
            draggable
            onDragStart={(e) => {
              setDragId(item.id);
              // Firefox starts no drag at all without data on the transfer.
              e.dataTransfer.setData('text/plain', String(item.id));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragId !== null && dragId !== item.id) setOverId(item.id);
            }}
            onDragLeave={() => setOverId((current) => (current === item.id ? null : current))}
            onDrop={(e) => {
              e.preventDefault();
              const next = reordered(items, item.id);
              setItems(next);
              setDragId(null);
              setOverId(null);
              setError(null);
              void save(next);
            }}
            // Fires whether or not the drop landed on a tile, so a photo let go
            // over empty space simply puts itself back.
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            className={
              [
                dragId === item.id ? 'admin-media-dragging' : '',
                overId === item.id ? 'admin-media-over' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.previewUrl}
              alt=""
              loading="lazy"
              // An image is draggable on its own, and that drag carries the file
              // rather than the tile — which would make the row unsortable.
              draggable={false}
            />
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
        ))}
      </ul>
    </>
  );
}
