import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About · Milan Week',
  description: 'What Milan Week is, where the data comes from, and how to use it.',
};

export default function AboutPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/" className="inline-block text-sm text-stone-500 hover:text-stone-900 mb-8">
        ← All events
      </Link>

      <article className="prose prose-stone max-w-none">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">About Milan Week</h1>
        <p className="text-stone-500 text-sm mb-10">A free planner for Milan Design Week 2026.</p>

        <section className="space-y-5 text-stone-700 leading-relaxed">
          <p>
            Milan Design Week runs 20–26 April 2026. The fair itself opens on the 21st out at Fiera
            Milano Rho; the rest of the city runs a parallel programme under the Fuorisalone umbrella.
            This app is a single scannable list of what&rsquo;s on, with a map, directions, and a way to
            mark what you&rsquo;re going to.
          </p>

          <h2 className="text-lg font-semibold tracking-tight text-stone-900 pt-4">How to use it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Tap the <strong>☆</strong> on any event to mark it <strong>going</strong>; tap
              the small <strong>▾</strong> to <strong>skip</strong> it (fades the card). Picks live
              only in your browser — no account, no login, no server-side tracking.
            </li>
            <li>
              Use the search box or the day chips to narrow the list. The <strong>Now</strong> and{' '}
              <strong>Today</strong> filters show what&rsquo;s open right now or still open later
              today; <strong>Multi-day</strong> surfaces events that run across several days.
            </li>
            <li>
              On the <Link href="/map" className="underline decoration-stone-300 underline-offset-2">Map</Link>, tap
              <em> Locate me</em> to drop a pin where you are, or filter by day to see only one day&rsquo;s pins at a time.
            </li>
            <li>
              Hit <em>+ Add to calendar</em> on any event card to download a single .ics file, or
              the floating <em>⬇ to calendar</em> button to export everything you&rsquo;ve marked{' '}
              <em>going</em> at once. Import into Apple Calendar or Google Calendar to get reminders
              on your phone.
            </li>
            <li>
              Open <strong>Settings</strong> from the <strong>⋯</strong> menu to set a{' '}
              <strong>home base</strong> (unlocks a &ldquo;from ⌂&rdquo; directions link on every event
              and a pin on the map), <strong>add your own events</strong> alongside the public list, or
              export / import your data as JSON. Everything under Settings stays in your browser.
            </li>
          </ul>

          <h2 className="text-lg font-semibold tracking-tight text-stone-900 pt-4">Where the data comes from</h2>
          <p>
            Every event has a <em>Source →</em> link. Listings are drawn from public editorial and press
            coverage (Dezeen, Architectural Digest, Domus, Wallpaper, Designboom, Galerie, Fuorisalone.it,
            the official Salone del Mobile site, Novità newsletter) along with a hand-curated pool from
            Milan Design Week editors.
          </p>
          <p>
            Only events with a public listing are included. Private invites, personal RSVPs and
            press-kit-only previews are filtered out.
          </p>

          <h2 className="text-lg font-semibold tracking-tight text-stone-900 pt-4">Caveats</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Hours drift. Some venues change their schedule during the week — if you&rsquo;re on a tight loop, cross-check on the event&rsquo;s source link.</li>
            <li>Some addresses stay <em>TBC</em> until the week opens. Those events appear in the list without a map pin.</li>
            <li>Pins are geocoded from OpenStreetMap data, which occasionally lands a block off. Trust the venue name over the pin.</li>
          </ul>

          <h2 className="text-lg font-semibold tracking-tight text-stone-900 pt-4">Who made this</h2>
          <p>
            Built by <strong>Don Seibert</strong> — by day an insurtech builder, by evening
            occasionally a maker of small tools. This one started as a weekend project for his wife
            Esma, who was heading to Milan for Design Week 2026 and wanted a calmer way to keep
            track of everything that was on. It worked well enough that it seemed worth opening up.
            No account, no tracking, no monetisation — just the planner.
          </p>

          <h2 className="text-lg font-semibold tracking-tight text-stone-900 pt-4">Colophon</h2>
          <p>
            Built on Next.js + Supabase, maps by Leaflet and OpenStreetMap. Favicon is a stylised
            Franco Albini &amp; Franca Helg Metro handrail — Milan&rsquo;s other enduring design classic.
            Not affiliated with Salone del Mobile, Fuorisalone or any of the cited sources.
          </p>
        </section>
      </article>
    </main>
  );
}
