'use client';

import { deleteMediaAction } from './actions';

/** Same shape as DeleteListing: the confirm lives here because a server action cannot ask. */
export default function DeleteMedia({ id, filename }: { id: number; filename: string }) {
  return (
    <form
      action={deleteMediaAction}
      onSubmit={(e) => {
        if (!confirm(`Delete ${filename}? This cannot be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="admin-media-delete" type="submit">
        Delete
      </button>
    </form>
  );
}
