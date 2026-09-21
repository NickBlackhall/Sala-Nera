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

  function moveTo(targetId: number) {
    if (dragId === null || dragId === targetId) return;

    setItems((prev) => {
      const from = prev.findIndex((m) => m.id === dragId);
      const to = prev.findIndex((m) => m.id === targetId);
      if (from === -1 || to === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
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
              moveTo(item.id);
            }}
            onDrop={(e) => e.preventDefault()}
            onDragEnd={() => {
              setDragId(null);
              setError(null);
              void save(items);
            }}
            className={dragId === item.id ? 'admin-media-dragging' : undefined}
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
