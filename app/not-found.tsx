const LOGO = '/brand/sala nera logo cropped dark.svg';

export default function NotFound() {
  return <main className="not-found">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={LOGO} alt="Sala Nera" width={1669} height={1072} /><span className="kicker">404</span><h1>This page isn&apos;t part of the collection.</h1><p>The address may have changed, or the page may no longer be available.</p><div className="not-found-links"><a href="/">Return Home</a><a href="/contact">Begin a Conversation</a></div></main>;
}
