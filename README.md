# MainLine

A chess opening trainer for the web, iPhone, iPad, Android and desktop. You build a repertoire, learn it move by move, and spaced repetition keeps it fresh.

<p>
  <img src="apps/mobile/store/screenshots/iphone/01-opponent.png" width="150" alt="Opponent prep: the lines a rival really plays, checked against your repertoire">
  <img src="apps/mobile/store/screenshots/iphone/02-games.png" width="150" alt="Your games: where each one left your prep">
  <img src="apps/mobile/store/screenshots/iphone/03-build.png" width="150" alt="Building a line with the moves opponents really play at your level">
  <img src="apps/mobile/store/screenshots/iphone/04-coach.png" width="150" alt="The coach explaining why a move is played">
  <img src="apps/mobile/store/screenshots/iphone/05-learn.png" width="150" alt="Learning a new move">
  <img src="apps/mobile/store/screenshots/iphone/06-today.png" width="150" alt="Today: what to practise, the streak and the daily goal">
</p>

## What it does

- **Prepare for an opponent.** Type in their Lichess or Chess.com username and see the lines they really play, from their own games, checked against your repertoire.
- **Build.** Play moves on the board or import PGN. Every position shows how often each move is played at your rating and how it scores, from Lichess and master games; Stockfish runs on your device.
- **Remember.** Spaced repetition (FSRS) schedules each position right before you would forget it. Learn, review, drill whole lines, or quiz your weakest positions.
- **Learn from your games.** Import your Lichess or Chess.com games and see where each one left your prep. Forgotten moves go straight back into review.
- **Understand.** Ask the coach why a move is played; explanations are checked against the position.
- **Yours.** Works fully offline, no account needed, no ads, no tracking. Sign in with Lichess (or Apple on iPhone and iPad) to sync between devices.

## Get it

- **Web:** https://api-production-8afb.up.railway.app (installs as an app from the browser).
- **iPhone and iPad, Android:** in testing on TestFlight and Google Play; store links follow when they are live.
- **Desktop:** a Tauri app for macOS, Windows and Linux lives in `apps/desktop`; no packaged release is published yet.

[Privacy policy](https://api-production-8afb.up.railway.app/privacy) · [Terms of use](https://api-production-8afb.up.railway.app/terms) · [Cookies](https://api-production-8afb.up.railway.app/cookies) · [Accessibility](https://api-production-8afb.up.railway.app/accessibility) · [Report a problem](https://github.com/Tony11-dot/mainline/issues)

## Licence

- **Code:** GPL-3.0-or-later (see `LICENSE`). The board (chessground), the rules library (chessops) and the engine (Stockfish) are GPL-3.0, so MainLine is too. Anyone who distributes a modified copy must publish their source under the same licence.
- **Name and artwork:** "MainLine", the MainLine logo, the app icon and the store artwork (`brand/`, `apps/mobile/store/`) are **not** covered by the GPL. All rights are reserved. Forks must use a different name and icon.
- **Cabinet Grotesk:** © Indian Type Foundry, under the ITF Free Font License.

## Development

See `docs/PLAN.md` (architecture), `docs/PROGRESS.md` (history), `docs/REDESIGN_PROGRESS.md` (the redesign) and `apps/mobile/store/RELEASING.md` (releases).
