import type { FastifyInstance } from 'fastify';
import { env } from '../env';

/** Privacy policy and terms, required by the App Store and Google Play. Plain HTML, no scripts. */
export async function legalRoutes(app: FastifyInstance) {
  app.get('/privacy', async (_req, reply) => reply.type('text/html').header('Cache-Control', 'public, max-age=3600').send(page('Privacy policy', PRIVACY())));
  app.get('/terms', async (_req, reply) => reply.type('text/html').header('Cache-Control', 'public, max-age=3600').send(page('Terms of use', TERMS())));
  app.get('/cookies', async (_req, reply) => reply.type('text/html').header('Cache-Control', 'public, max-age=3600').send(page('Cookies and local storage', COOKIES())));
}

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
  <li>If you sign in with Lichess, your repertoires and training progress are stored on our server so they sync between your devices.</li>
  <li>You can delete everything from inside the app: Settings → Your data.</li>
</ul>

<h2>What stays on your device</h2>
<p>Repertoires, notes, training schedule and history, imported games, preferences and cached opening statistics are stored in your browser's or app's local storage. We cannot see them unless you sign in to sync.</p>

<h2>What our server receives</h2>
<ul>
  <li><strong>Chess positions</strong> you look up, to fetch opening statistics and engine evaluations from Lichess on your behalf. Positions aren't linked to you.</li>
  <li><strong>Usernames you type</strong> into Games (yours or an opponent's), to download public games from Lichess or Chess.com. We pass them to those sites and don't keep them.</li>
  <li><strong>If you sign in with Lichess</strong>: your Lichess username, your ratings, and an access token (encrypted at rest) that only allows reading public account information. We store your repertoires, training cards, review history and settings so they sync. The token is revoked when you delete your account.</li>
  <li><strong>If you turn on reminders on the web</strong>: a push subscription (an address your browser gives us for notifications), your reminder time and time zone, and how many positions you have due. On iPhone, iPad, Android and desktop, reminders are scheduled on the device and nothing is sent.</li>
  <li><strong>Technical logs</strong>: our hosting provider processes IP addresses and request logs to run and protect the service. Logs are kept for a short time and not used to identify you.</li>
</ul>

<h2>Cookies</h2>
<p>MainLine uses no advertising, analytics or tracking cookies, so there's nothing to consent to. The only cookies are the two needed to sign in with Lichess, plus on-device storage for your own data. The full list is on the <a href="${esc(env.PUBLIC_URL)}/cookies">cookies page</a>.</p>

<h2>AI explanations</h2>
<p>When you ask the coach to explain a move, the position and moves (never your name or account) are sent to an AI provider, Google Gemini or, as a fallback, Groq, to write the explanation. Explanations are cached by position and shared between users.</p>

<h2>Third parties</h2>
<p>Lichess (opening explorer, cloud evaluations, sign-in, games), Chess.com (public games), Google and Groq (AI explanations), and our hosting provider. Each handles data under its own privacy policy. We don't use any advertising or analytics SDKs.</p>

<h2 id="delete">Keeping and deleting data</h2>
<p>Synced data is kept while your account exists. Settings → Your data → <em>Delete my account &amp; data</em> removes your account and everything linked to it from our server immediately, and clears this device, including any reminder subscription. On the web, open ${esc(env.PUBLIC_URL)}/settings, sign in with Lichess and use the same option. Without an account, <em>Erase all data on this device</em> does the same locally. If you can't access the app, contact us (below) with your Lichess username; we'll confirm it's you through Lichess and delete the account within 30 days.</p>

<h2>Children</h2>
<p>MainLine is suitable for all ages and collects no more data from children than from anyone else. It doesn't knowingly collect personal information from children under 13 beyond the optional Lichess sign-in described above.</p>

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
  <thead><tr><th>Name</th><th>Purpose</th><th>Lifetime</th></tr></thead>
  <tbody>
    <tr><td><code>ml_session</code></td><td>Keeps you signed in after you choose <em>Sign in with Lichess</em>. HttpOnly, first-party, only set if you sign in. Removed when you sign out or delete your account.</td><td>1 year</td></tr>
    <tr><td><code>ml_oauth</code></td><td>Protects the Lichess sign-in step against forgery (a one-time code). Only set while signing in.</td><td>10 minutes</td></tr>
  </tbody>
</table>

<h2>On-device storage</h2>
<p>Your repertoires, training history, cached opening statistics and settings (theme, board, font) are kept in your browser's or app's local storage and IndexedDB, so MainLine works offline and without an account. They never leave your device unless you sign in to sync. The web app also stores its own files for offline use (a service worker cache).</p>

<h2>Removing them</h2>
<p>Settings → Your data → <em>Erase all data on this device</em> clears all of it. You can also clear site data in your browser settings. Blocking cookies only stops sign-in from working; everything else keeps working.</p>

<h2>More</h2>
<p>See the <a href="${esc(env.PUBLIC_URL)}/privacy">privacy policy</a> and the <a href="${esc(env.PUBLIC_URL)}/terms">terms of use</a>. Questions: ${contact()}.</p>
`;

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · MainLine</title>
<style>
  :root { color-scheme: light dark; --ink: #10131a; --ink2: #4a5163; --bg: #f7f8fb; --brand: #072eb8; }
  @media (prefers-color-scheme: dark) { :root { --ink: #eef0f5; --ink2: #a3a9b8; --bg: #12141a; --brand: #8aa4ff; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 40px 20px 64px; }
  h1 { font-size: 32px; line-height: 1.2; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 19px; margin: 32px 0 8px; }
  .updated { color: var(--ink2); margin: 0 0 24px; font-size: 15px; }
  a { color: var(--brand); }
  ul { padding-left: 22px; }
  li { margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  th, td { text-align: left; vertical-align: top; padding: 8px 8px 8px 0; border-bottom: 1px solid color-mix(in srgb, var(--ink2) 30%, transparent); }
  td:last-child, th:last-child { white-space: nowrap; padding-right: 0; }
  code { font-size: 14px; }
  nav { margin-top: 48px; font-size: 15px; color: var(--ink2); }
</style>
</head>
<body><main>
<h1>${title}</h1>
<p class="updated">MainLine · last updated ${LEGAL_UPDATED}</p>
${body}
<nav><a href="${esc(env.PUBLIC_URL)}/privacy">Privacy policy</a> · <a href="${esc(env.PUBLIC_URL)}/terms">Terms of use</a> · <a href="${esc(env.PUBLIC_URL)}/cookies">Cookies</a></nav>
</main></body>
</html>`;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
