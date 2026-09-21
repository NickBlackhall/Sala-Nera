/**
 * For both property website versions. Neutral on purpose: an MLS link to a
 * listing that is unpaid, re-locked or gone must not turn into a Sala Nera
 * page, and having a boundary here keeps the site's branded 404 out of these
 * pages' payload altogether.
 */
export default function PropertyNotFound() {
  return (
    <main className="not-found">
      <span className="kicker">Not available</span>
      <h1>This property page isn&apos;t available.</h1>
      <p>The link may be mistyped, or the listing may no longer be shown.</p>
    </main>
  );
}
