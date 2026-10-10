import type { FastifyInstance } from 'fastify';
import { env } from '../env';

/** Privacy policy and terms (required by the App Store and Google Play), cookie list and accessibility statement. Plain HTML, no scripts. */
export async function legalRoutes(app: FastifyInstance) {
  for (const p of PAGES) {
    app.get(p.path, async (_req, reply) => reply.type('text/html').header('Cache-Control', 'public, max-age=3600').send(page(p)));
  }
}

type LegalPage = { path: string; title: string; nav: string; description: string; body: () => string };

/** The four pages, in the order of the footer links (and of Settings). */
const PAGES: LegalPage[] = [
  { path: '/privacy', title: 'Privacy policy', nav: 'Privacy policy', description: 'What MainLine stores, what it sends and how to delete it. No ads, no analytics, no tracking.', body: () => PRIVACY() },
  { path: '/terms', title: 'Terms of use', nav: 'Terms of use', description: 'The terms for using MainLine, a free chess opening trainer.', body: () => TERMS() },
  { path: '/cookies', title: 'Cookies and local storage', nav: 'Cookies', description: 'The two sign-in cookies MainLine uses and what it keeps on your device.', body: () => COOKIES() },
  { path: '/accessibility', title: 'Accessibility statement', nav: 'Accessibility', description: 'How MainLine works with keyboards, screen readers, large text and reduced motion.', body: () => ACCESSIBILITY() },
];

export const LEGAL_UPDATED = '25 September 2026';

const contact = () =>
  env.LEGAL_CONTACT.includes('@')
    ? `<a href="mailto:${esc(env.LEGAL_CONTACT)}">${esc(env.LEGAL_CONTACT)}</a>`
    : `<a href="${esc(env.LEGAL_CONTACT)}">${esc(env.LEGAL_CONTACT)}</a>`;

const PRIVACY = () => `
<p>MainLine is a chess opening trainer. It is built to work without an account and without tracking you. This policy explains the little data it handles.</p>

<h2>The short version</h2>
<ul>
  <li>No ads, no analytics, no tracking, no data sold or shared for marketing.</li>
  <li>Without signing in, your repertoires, training history and settings stay on your device.</li>
  <li>If you sign in (with Lichess, Chess.com, or Apple on iPhone and iPad), your repertoires and training progress are stored on our server so they sync between your devices.</li>
  <li>You can delete everything from inside the app: Settings → Your data.</li>
</ul>

<h2>What stays on your device</h2>
<p>Repertoires, notes, training schedule and history, imported games, preferences and cached opening statistics are stored in your browser's or app's local storage. We cannot see them unless you sign in to sync.</p>

<h2>What our server receives</h2>
<ul>
  <li><strong>Chess positions</strong> you look up, to fetch opening statistics and engine evaluations from Lichess on your behalf. Positions aren't linked to you.</li>
  <li><strong>Usernames you type</strong> into Games (yours or an opponent's), to download public games from Lichess or Chess.com. We pass them to those sites and don't keep them.</li>
  <li><strong>If you sign in with Lichess</strong>: your Lichess username, your ratings, and an access token (encrypted at rest) that only allows reading public account information. We store your repertoires, training cards, review history and settings so they sync. The token is revoked when you delete your account.</li>
  <li><strong>If you sign in with or connect Chess.com</strong>: your Chess.com username and Chess.com's account ID for you, which Chess.com confirms when you approve the sign-in. We don't keep a Chess.com access token.</li>
  <li><strong>If you sign in with Apple</strong>: Apple's anonymous account ID for you, and your name if you choose to share it the first time. We don't ask for or store your email address.</li>
  <li><strong>If you turn on reminders on the web</strong>: a push subscription (an address your browser gives us for notifications), your reminder time and time zone, how many positions you have due, your streak length and streak freezes, and the date you last practised (so reminders stop once you have practised and say the right thing). On iPhone, iPad, Android and desktop, reminders are scheduled on the device and nothing is sent.</li>
  <li><strong>Technical logs</strong>: our hosting provider processes IP addresses and request logs to run and protect the service. Logs are kept for a short time and not used to identify you.</li>
</ul>

<h2>Cookies</h2>
<p>MainLine uses no advertising, analytics or tracking cookies, so there's nothing to consent to. The only cookies are the two needed to sign in with Lichess or Chess.com, plus on-device storage for your own data. The full list is on the <a href="${esc(env.PUBLIC_URL)}/cookies">cookies page</a>.</p>

<h2>AI explanations</h2>
<p>When you ask the coach to explain a move, the position and moves (never your name or account) are sent to an AI provider, Google Gemini or, as a fallback, Groq, to write the explanation. Explanations are cached by position and shared between users.</p>

<h2>Third parties</h2>
<p>Lichess (opening explorer, cloud evaluations, sign-in, games), Chess.com (public games, sign-in), Apple (Sign in with Apple), Google and Groq (AI explanations), and our hosting provider. Each handles data under its own privacy policy. We don't use any advertising or analytics SDKs.</p>

<h2 id="delete">Keeping and deleting data</h2>
<p>Synced data is kept while your account exists. Settings → Your data → <em>Delete my account &amp; data</em> removes your account and everything linked to it from our server immediately, and clears this device, including any reminder subscription. On the web, open ${esc(env.PUBLIC_URL)}/settings, sign in and use the same option. Without an account, <em>Erase all data on this device</em> does the same locally. If you can't access the app, contact us (below) with your Lichess or Chess.com username; we'll confirm it's you through that site and delete the account within 30 days.</p>

<h2>Children</h2>
<p>MainLine is suitable for all ages and collects no more data from children than from anyone else. It doesn't knowingly collect personal information from children under 13 beyond the optional Lichess or Chess.com sign-in described above.</p>

<h2>Your rights</h2>
<p>You can access, export (PGN export in the app), correct or delete your data at any time. For any other request, contact ${contact()}.</p>

<h2>Changes</h2>
<p>If this policy changes, the new version will be posted here with a new date.</p>
`;

const TERMS = () => `
<p>By using MainLine you agree to these terms.</p>

<h2>The service</h2>
<p>MainLine helps you build and practise chess opening repertoires. It's provided free of charge, as is, without warranties of any kind. Opening statistics, engine evaluations and AI explanations can be wrong. Use your own judgement at the board.</p>

<h2>Your content</h2>
<p>Repertoires, notes and training data you create are yours. You give us permission to store and process them only to provide the service (for example, syncing between your devices).</p>

<h2>Acceptable use</h2>
<p>Don't abuse the service: no automated scraping, no attempts to overload it or get around rate limits, and no use that breaks the terms of Lichess or Chess.com. We may limit or suspend access to protect the service.</p>

<h2>Third-party services</h2>
<p>Features that use Lichess, Chess.com, Google or Groq depend on those services and their terms. We aren't responsible for their availability.</p>

<h2>Free software</h2>
<p>MainLine's source code is licensed under the GNU General Public License v3.0 or later. It includes chessground, chessops and Stockfish (GPL-3.0). Opening names come from lichess-org/chess-openings (CC0).</p>

<h2>Liability</h2>
<p>To the extent the law allows, we aren't liable for indirect or consequential losses, or for lost data. Keep a PGN export of anything important.</p>

<h2>Ending</h2>
<p>You can stop using MainLine and delete your data at any time from Settings. These terms may change; continued use after a change means you accept it.</p>

<h2>Contact</h2>
<p>${contact()}</p>
`;

const COOKIES = () => `
<p>MainLine doesn't use advertising, analytics or tracking cookies, and it doesn't let third parties set cookies. Everything below is strictly necessary for a feature you choose to use, which is why the app doesn't show a consent banner.</p>

<h2>Cookies</h2>
<table>
  <thead><tr><th scope="col">Name</th><th scope="col">Purpose</th><th scope="col">Lifetime</th></tr></thead>
  <tbody>
    <tr><td data-label="Name"><code>ml_session</code></td><td data-label="Purpose">Keeps you signed in after you choose <em>Sign in with Lichess</em> or <em>Sign in with Chess.com</em>. HttpOnly, first-party, only set if you sign in. Removed when you sign out or delete your account.</td><td data-label="Lifetime">1 year</td></tr>
    <tr><td data-label="Name"><code>ml_oauth</code></td><td data-label="Purpose">Protects the Lichess and Chess.com sign-in step against forgery (a one-time code). Only set while signing in.</td><td data-label="Lifetime">10 minutes</td></tr>
  </tbody>
</table>

<h2>On-device storage</h2>
<p>Your repertoires, training history, cached opening statistics and settings (theme, board, font) are kept in your browser's or app's local storage and IndexedDB, so MainLine works offline and without an account. They never leave your device unless you sign in to sync. The web app also stores its own files for offline use (a service worker cache).</p>

<h2>Removing them</h2>
<p>Settings → Your data → <em>Erase all data on this device</em> clears all of it. You can also clear site data in your browser settings. Blocking cookies only stops sign-in from working; everything else keeps working.</p>

<h2>More</h2>
<p>See the <a href="${esc(env.PUBLIC_URL)}/privacy">privacy policy</a> and the <a href="${esc(env.PUBLIC_URL)}/terms">terms of use</a>. Questions: ${contact()}.</p>
`;

const ACCESSIBILITY = () => `
<p>MainLine should work for every chess player, including players with disabilities. We aim for the web, mobile and desktop apps to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA.</p>

<h2>What we have done</h2>
<ul>
  <li><strong>Play without the mouse.</strong> Type any move in standard notation (<code>Nf3</code>, <code>exd5</code>, <code>O-O</code>) or as coordinates (<code>g1f3</code>) and press Enter. Press <code>/</code> anywhere to jump to the move box.</li>
  <li><strong>Screen readers.</strong> Moves and trainer feedback are announced in words (for example “Knight takes f 3, check”), and buttons and controls have labels.</li>
  <li><strong>Reading and contrast.</strong> Light and dark themes, a choice of board colours and fonts, and pages that reflow with browser zoom and the system text size.</li>
  <li><strong>Motion.</strong> Animations are reduced when your device asks for reduced motion.</li>
</ul>

<h2>Known limitations</h2>
<p>Dragging pieces on the board itself is a visual, pointer-based interaction; use the move box instead. Opening statistics and engine evaluations come from external sources and are shown mainly as numbers and bars.</p>

<h2>Feedback</h2>
<p>If something in MainLine is hard to use, tell us what you were trying to do and which device you use: ${contact()}. We read every message.</p>
`;

/**
 * The page around each text: the app's own look (its light and dark MainLine palettes, the knight and
 * wordmark, a white card on the tinted page, the brand blue for links). Type is in rem so the reader's
 * text-size setting applies, titles grow at half the rate like the app's, and the insets stay in px.
 */
function page(p: LegalPage) {
  const base = esc(env.PUBLIC_URL.replace(/\/$/, ''));
  const nav = PAGES.map((q) => (q.path === p.path ? `<a href="${base}${q.path}" aria-current="page">${q.nav}</a>` : `<a href="${base}${q.path}">${q.nav}</a>`)).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.title} · MainLine</title>
<meta name="description" content="${esc(p.description)}">
<meta name="theme-color" content="#F2F4F9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121419" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${base}/favicon-32.png" type="image/png">
<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">
<style>
  :root { color-scheme: light dark; --bg: #f2f4f9; --card: #fff; --ink: #181d2b; --ink2: #4a5268; --line: #dde1ea; --brand: #072eb8; --brand-soft: color-mix(in oklab, var(--brand) 11%, var(--card)); --shadow: 0 1px 2px rgb(20 30 60 / 0.05), 0 6px 20px -8px rgb(20 30 60 / 0.12); }
  @media (prefers-color-scheme: dark) { :root { --bg: #121419; --card: #1c2029; --ink: #eef0f5; --ink2: #b7bdcb; --line: #333845; --brand: #8fa8ff; --brand-soft: color-mix(in oklab, var(--brand) 22%, var(--card)); --shadow: 0 0 0 1px rgb(255 255 255 / 0.06), 0 1px 2px rgb(0 0 0 / 0.3); } }
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; -webkit-hyphenate-limit-before: 4; -webkit-hyphenate-limit-after: 4; hyphenate-limit-chars: 10 4 4; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter Variable", "Segoe UI Variable Text", "Segoe UI", Roboto, system-ui, sans-serif; font-size: 1.0625rem; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  main { max-width: 45rem; margin: 0 auto; padding: 20px 16px 48px; }
  /* The knight-and-wordmark, filled with the brand colour the way the app's sidebar draws it (30 px tall). */
  .brand { display: inline-flex; align-items: center; min-height: 44px; padding: 0 6px; margin: 0 0 12px -6px; border-radius: 12px; text-decoration: none; }
  .brand span { display: block; width: 111px; height: 30px; background: var(--brand); -webkit-mask: url(${base}/brand/wordmark.png) center / contain no-repeat; mask: url(${base}/brand/wordmark.png) center / contain no-repeat; }
  article { background: var(--card); border-radius: 24px; padding: 28px 20px 32px; box-shadow: var(--shadow); }
  @media (min-width: 600px) { main { padding-top: 32px; } .brand { margin-bottom: 16px; } article { padding: 40px 40px 44px; } }
  h1, h2 { overflow-wrap: anywhere; hyphens: auto; text-wrap: balance; }
  h1 { font-size: calc(1.125rem + 18px); line-height: 1.12; margin: 0 0 6px; letter-spacing: -0.025em; }
  h2 { font-size: 1.25rem; line-height: 1.3; margin: 1.75em 0 0.4em; letter-spacing: -0.01em; }
  p, li { text-wrap: pretty; overflow-wrap: anywhere; margin: 0.6em 0; }
  .updated { color: var(--ink2); margin: 0 0 1.4em; font-size: 0.9375rem; }
  a { color: var(--brand); text-underline-offset: 2px; text-decoration-thickness: 1px; }
  a:focus-visible, .brand:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: 6px; }
  ul { padding-inline-start: 22px; margin: 0.6em 0; }
  li { margin: 0.4em 0; }
  code { font-size: 0.875em; background: color-mix(in srgb, var(--ink2) 12%, transparent); border-radius: 6px; padding: 1px 5px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; margin: 0.8em 0; }
  th, td { text-align: start; vertical-align: top; padding: 10px 12px 10px 0; border-bottom: 1px solid var(--line); }
  th { color: var(--ink2); font-weight: 600; font-size: 0.8125rem; }
  th:last-child, td:last-child { padding-inline-end: 0; }
  @media (min-width: 600px) { td:last-child { white-space: nowrap; } }
  /* On a phone each row becomes a small block with its own labels: nothing scrolls sideways. */
  @media (max-width: 599px) {
    thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    table, tbody, tr, td { display: block; }
    tr { padding: 10px 0 12px; border-bottom: 1px solid var(--line); }
    td { padding: 0; border: 0; }
    td::before { content: attr(data-label); display: block; margin-top: 8px; font-size: 0.8125rem; font-weight: 600; color: var(--ink2); }
    td:first-child::before { margin-top: 0; }
  }
  nav { display: flex; flex-wrap: wrap; gap: 0 2px; margin: 12px -10px 0; font-size: 0.9375rem; font-weight: 600; }
  nav a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 10px; border-radius: 12px; text-decoration: none; }
  nav a:hover { background: var(--brand-soft); }
  nav a[aria-current="page"] { color: var(--ink2); }
  @media print { body { background: #fff; } article { box-shadow: none; padding: 0; } .brand, nav { display: none; } a { color: inherit; } }
</style>
</head>
<body><main>
<a class="brand" href="${base}/"><span role="img" aria-label="MainLine"></span></a>
<article>
<h1>${p.title}</h1>
<p class="updated">Last updated ${LEGAL_UPDATED}</p>
${p.body()}
</article>
<nav aria-label="Legal pages">
${nav}
</nav>
</main></body>
</html>`;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
