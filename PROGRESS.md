# Mainline — progress log

Newest entries at the bottom. Each phase: what was built, how to try it, known issues.

## Local setup (once)

```bash
nvm install 22 && nvm use 22          # Node 22 is required (Capacitor 8, Vitest 5)
corepack enable                        # or: npm i -g pnpm@10
pnpm install
createdb mainline                      # local Postgres (Homebrew postgresql@16 is running on this Mac)
cp .env.example .env                   # a filled-in .env with generated keys already exists locally
pnpm --filter @mainline/api db:migrate
pnpm dev                               # API on :8787, web on http://localhost:5173
```

Native toolchains used by Claude Code on this Mac: Node 22 via nvm, Rust (rustup, for Tauri), JDK 21 from Android Studio (`JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`), Xcode 26.6 (release) for store builds.

---

## Phase 0 — Scaffold (2026-09-24)

**Built**
- pnpm monorepo: `packages/shared`, `apps/api`, `apps/web`, `apps/mobile` (Capacitor 8), `apps/desktop` (Tauri 2). TS strict, ESLint (flat config), Prettier, Vitest, Playwright.
- `packages/shared`: EPD normalization on top of chessops (legal-only en-passant, impossible castling rights dropped), 10 unit tests.
- `apps/api`: Fastify 5 + Drizzle + Postgres. Full §6 schema + `sessions`, `ai_usage`; migration `0000_init`. Runs **without** a database too (degrades to in-memory caches). Serves the SPA with COOP/COEP (+CORP) headers, SPA fallback, immutable caching for hashed assets, `/api/health`. Missing secrets surface as HTTP 503 `not_configured` with the exact env var to set.
- `apps/web`: Vite 8 + React 19 + Tailwind 4; design tokens (single `--brand` token, all blues derived via `color-mix`), light/dark, glass chrome with solid fallback under Reduce Transparency; responsive shell (floating glass tab bar on phones, sidebar on desktop); platform adapter (`web` / `capacitor` / `tauri`). Stockfish 19 lite builds copied to `public/engine/`.
- `apps/mobile`: Capacitor iOS (SPM) + Android projects, id `app.mainline.chess`, icons and splash generated from the brand mark (`node scripts/gen-icons.mjs`).
- `apps/desktop`: Tauri 2, id `app.mainline.desktop`, COOP/COEP via `app.security.headers`.
- Dockerfile + `railway.json` (one service: API + SPA, health check), `.env.example`, GitHub Actions CI (typecheck, lint, unit tests with Postgres service, builds, Playwright).
- `PRODUCT.md`: design context (for the impeccable design skill).

**Try it**: `pnpm dev` → http://localhost:5173. `curl localhost:8787/api/health`. `pnpm test`, `pnpm e2e`.

**Smoke builds**: Android debug APK ✔ (`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`), Tauri macOS `.app` ✔, iOS simulator build — see below.

**Known issues**: none blocking. Playwright browsers must be installed once (`pnpm --filter @mainline/web exec playwright install chromium webkit`).

iOS simulator smoke build (Xcode 26.6): ✔ `BUILD SUCCEEDED`.

---

## Phase 1 — Board & explorer (2026-09-24)

**Built**
- **Board** (`apps/web/src/board/`): chessground 9 + chessops. Drag *and* click-click, legal-move dots and capture rings, last-move / check / selection highlights, 200 ms glide (configurable: off/fast/normal/slow), promotion picker (Lichess-style column, keyboard Q/N/R/B, Esc cancels and restores the pawn), coordinates coloured against the square underneath, flip, 4 board themes drawn with one CSS gradient (blue default, slate, wood, green). Dragged pieces lift (and on touch rise above the finger). ResizeObserver keeps the board crisp through layout changes.
- **Arrows & circles**: right-click drag on desktop (with chessground's modifier brushes); on touch, **long-press then drag** draws an arrow (release in place → circle), or toggle the pen for draw mode. Shapes are stored per move node.
- **Sounds**: move / capture / check / castle / promote / error / correct / complete synthesized with WebAudio (no assets, no licensing); unlocked on first gesture for iOS; mute + volume. **Haptics** through the platform adapter.
- **Keyboard**: ←/→ moves, ↑/Home start, ↓/End end, Shift+↑/↓ switch variation, F flip.
- **Move tree**: inline Lichess-style notation, collapsible variations, auto-scroll to the current move.
- **Engine**: Stockfish 19 lite in a worker — threaded (up to 4 threads) where cross-origin isolated on Chromium/Firefox, single-threaded on WebKit and native shells (with automatic fallback). MultiPV 3, eval bar (vertical on desktop, horizontal on phones), clickable PV moves, best-move arrow. **Lichess cloud eval first** via our cache; local evals ≥ depth 18 are validated server-side and shared.
- **Explorer**: Masters / Lichess (your rating band + chosen speeds) tabs, % + game count, W/D/L bars, top games; skeletons, offline fallback (IndexedDB), explicit states for "needs Lichess sign-in", "rate-limited — retrying in 60 s", "offline".
- **Opening name + ECO** for the current line (CC0 dataset, works offline).
- **API**: `/api/explorer` (one request at a time per token, 60 s pause after 429, Postgres cache 90 d masters / 14 d lichess + hot LRU), `/api/eval` GET/POST, `/api/openings/at|search`, **Sign in with Lichess** (PKCE; verifier in HttpOnly signed cookie; token AES-256-GCM at rest; sessions stored hashed; native apps get a one-time code), `/api/me` GET/PATCH/DELETE (account deletion revokes the Lichess token).
- **Settings** screen: account, rating & time controls, theme, board theme, coordinates, legal-move dots, reduce transparency, animation speed, sounds/volume, haptics.

**Try it**: `pnpm dev` → http://localhost:5173/explore. Deep links work: `/explore?moves=e2e4,c7c5&color=black` or `/explore?fen=…`.

**Tests**: shared 22, API 7 (explorer caching/429 back-off/castling normalization, cloud eval, openings), web unit 8 (sound waveforms), **Playwright board suite on desktop Chromium, iPhone 15 WebKit and Pixel 7 Chromium**: mouse drag, click-click with animation, castling, sound sequence, illegal-drop snap-back, keyboard nav, flip, variations, promotion, tap-tap on iPhone, real CDP touch drag on Android, long-press arrow drawing, no horizontal scroll at phone width.

**Known issues**
- Explorer shows "needs a Lichess link" until you set `LICHESS_FALLBACK_TOKEN` in `.env` or sign in (by design — Lichess requires a token).
- Sign-in round trip not exercised end-to-end yet (needs a real Lichess login in a browser; the PKCE code is standard and unit-level pieces are in place).
- Sound quality was verified numerically (percussive envelope, no clipping); a human ear should confirm it's pleasant — tweak in `lib/sound.ts`.

---

## Phase 2 — Repertoires & folders (2026-09-24)

**Built**
- **Local-first library** (`apps/web/src/lib/library.ts`): folders, repertoires and moves in IndexedDB with tombstones + a dirty set (ready for Phase 3 sync). Memory is updated first, then persisted, so rapid edits never race. Default **White** and **Black** roots.
- **Shared repertoire logic** (`packages/shared/src/repertoire.ts`): EPD-keyed move graph (transpositions shared), alternates (one trained move per own position), card positions, lines with transposition cut-offs, cross-repertoire **conflict detection**, orphan pruning, **PGN import** (all games + variations + comments → notes, idempotent, respects a repertoire's starting moves) and **export** (one game with variations, SetUp/FEN when needed).
- **Library screen**: nested folder tree (create / rename / move / delete with Undo), drag a repertoire or folder onto a folder (desktop) or "Move to…" (touch), per-repertoire stats, export PGN via share sheet / download, conflict banner → conflict sheet.
- **Builder** (`/rep/:id`): play moves to add them; own-side second moves become **alternates** (toast offers "Make main"); status chip (you play X / not decided / N replies prepared) and conflict chip; delete-from-here with Undo; make main; **Add popular replies** (≥ 5–25% at your rating, 2–8 moves deep, cancellable, one explorer request at a time); **Suggest my move** (engine 45% · club results at your rating 35% · master popularity 20%, all numbers shown); notes per move (autosave); arrows saved per move; transposition ⇄ and note markers in the tree; explorer rows highlight moves already in the repertoire.
- **Opening library** (`/library/openings`): search 3,815 named openings by name or ECO, preview board, "Play as White/Black" creates a repertoire starting there, or explore it.
- New UI primitives: bottom-sheet/dialog (native `<dialog>`), popover menu, toasts with Undo, lightweight MiniBoard.

**Board robustness fixes found while testing the builder** (these were real bugs, not just test issues)
- chessground reports moves asynchronously; a move is now applied to **the position the board showed when it was made**, even if the user navigated in between.
- After a user move the board immediately gets the next position's legal moves (chessops), so a quick follow-up move isn't dropped while React re-renders on a slow phone; unchanged re-renders never call `set()` (which cancels drags).
- Promotion / en passant now render correctly after local advance.

**Try it**: http://localhost:5173/library → New → New repertoire, or Openings → search "najdorf".

**Tests**: shared 35, web unit 9 (incl. library store on fake IndexedDB), e2e 11 × 3 devices, **44/44 over 4 repeats** (create, add line, alternates, delete + undo, reload persistence, PGN import, opening library).

**Known issues**
- "Add popular replies" and "Suggest my move" need explorer access (Lichess token / sign-in).
- Drag-and-drop reordering *within* a folder isn't implemented (move-into-folder is); order is creation order.

---

## Brand, launch animation & appearance (2026-09-24, owner request)

**Built**
- **Brand assets** from the owner's files, kept as originals in `brand/` and derived by `node scripts/brand.mjs`: app icon (`MainLine.png`) for PWA / iOS / Android / desktop; Android adaptive icon = white knight on the brand gradient; native splash; in-app knight (`MainLine_transparent.png`, chosen over the wordmark for small square sizes) and the wordmark lockup for the desktop sidebar. Both are rendered as **CSS masks filled with the theme accent**, so the logo follows the active theme. Display name is now **MainLine** (web title, iOS, Android, desktop).
- **Brand blue `#072EB8`** (sampled from the icon's field) replaces the `#1E5EFF` placeholder.
- **Launch animation** (`apps/web/src/launch/`), ported from ClassMate's splash: the Jitter scene with the **`jitter.video` watermark stripped at build time** (a static null at the bottom-right parenting a precomp of outlined letterforms — same pattern and fix as ClassNotes commit 8d97b61 / ClassMusic 20ab136; `stripJitterWatermark` verifies nothing else references it), **recoloured to the active theme** (wordmark fill → accent, white → surface, embedded knight PNG tinted with alpha preserved), aspect-fit (zoomed into the empty margins on portrait phones), over an ambient background of drifting chess glyphs, rings, dots, blobs and branch curves fading in over 1.1 s. Tap/Esc skips, safety timeout, reduced-motion shows the final frame. Plays on every native / installed-PWA launch and once per browser session.
- **Themes & fonts — the same collection as ClassMate / ClassNotes / ClassMusic**: *System default* (MainLine blue & white, follows OS dark mode) + 9 light (Light, Coffee, Matcha, Rosé, Sand, Sky, Lavender, Peach, Mint) + 10 dark (Dark, Midnight, Nord, Forest, Dracula, Obsidian, Wine, Solarized, Plum, Ocean) with identical tokens and ClassMate's swatch rows; the font pack (Default, Noteworthy, Bradley Hand, Marker Felt, Chalkboard, Snell Roundhand, Savoye, Rounded, New York, Georgia, Menlo) as "Aa" rows. On Apple devices the real system faces are used; elsewhere open-licensed look-alikes load on demand (Patrick Hand, Caveat, Permanent Marker, Short Stack, Great Vibes, Pinyon Script, Nunito, Source Serif 4, Gelasio, JetBrains Mono — OFL/Apache).
- **Board & pieces follow the theme**: board "Match theme" (default) derives both square colours from the theme accent; presets Blue / Slate / Wood / Green remain. **8 piece sets** (Classic/cburnett, Merida, Chessnut, Fantasy, Spatial, Celtic, Rhos, MP Chess) — only GPL/MIT/Apache/CC0 sets from Lichess; licences in `apps/web/public/pieces/LICENSES.md`.
- The theme is painted before React loads (cached vars in `index.html`'s boot script) — no flash.

**Try it**: Settings → Light themes / Dark themes / Font / Board / Pieces. See the launch: http://localhost:5173/?launch=1

**Known issues / pending**
- **Cabinet Grotesk** (ClassMate's default font) is not included yet: its ITF Free Font License is outside the MIT/BSD/Apache/ISC/GPL set — waiting for the owner's OK. The code already knows about it (`pendingLicence` in `lib/appearance.ts`).
- One rare e2e flake (≈1/30) in the WebKit phone builder test at superhuman tap speed.

---

## Phase 3 — Training (2026-09-24)

**Built**
- **FSRS** via ts-fsrs (retention 0.9, max interval 365 d, fuzz) behind a small JSON-safe wrapper (`packages/shared/src/training.ts`). Cards are per colour + position, so transpositions and positions shared by several repertoires are learned once.
- **Automatic grading** (no self-rating buttons): wrong first try → Again; correct but > 15 s → Hard; correct → Good; instant on a well-known card → Easy. "Show move" counts as Again.
- **Session planner** (pure, tested): **Learn** (new positions in context from the repertoire root, daily new limit, configurable in Settings), **Review** (lines through due positions; opponent moves and not-due own moves auto-played; trimmed after the last due position), **Drill** (random walks, opponent replies weighted by real explorer frequencies when cached), **Position quiz** (single positions, due first then weakest retrievability).
- **Trainer** (`lib/trainer.ts`): opponent replies land after the previous animation (420 ms); a wrong move shakes the board, plays the error sound and haptic, snaps back and shows the correct move as an arrow — you then play it to continue. Playing an *alternate* gets a specific message; another repertoire's main move (conflict) is accepted. Move notes appear when learning / after a mistake.
- **Train screen**: board-first and immersive (no tab bar on phones), progress bar, one clear prompt, Show move (H), Skip line, Esc to leave; **session summary** with count, accuracy, time, streak and the positions to look at again (link to explore each).
- **Today screen**: one big **Train now** button with due count and estimated minutes (falls back to "Learn new moves"), positions learned / retention / reviewed today, streak, and Learn / Drill / Quiz entry points.
- **Sync** (signed-in users; guests stay local): `POST /api/sync` pushes the dirty set with last-write-wins per row (tombstones included, user-isolated, validated) and pulls rows changed since a **server-time** cursor (30 s overlap). The client syncs on sign-in, after edits (debounced 2 s), on reconnect, when the app returns to the foreground and every 5 min; a guest's library uploads on first sign-in. Sync status + "Sync now" in Settings.
- Fixed: stores bumped no version on first load, so screens memoised on it showed empty data after a reload.

**Try it**: import or build a repertoire → Today → Learn new moves → come back later for Review; Drill and Quiz from Today.

**Tests**: shared 43 (FSRS, grading, all four planners, summary, streak), API 10 (incl. sync against Postgres: LWW, tombstones, user isolation, validation), e2e **54/54 over 3 repeats** incl. learn → quiz-with-mistake → summary on desktop + iPhone WebKit, and **two-device sync** through the real API + DB.

**Known issues**
- Drill weights use explorer data already fetched in this session (uniform otherwise); Phase 4's nightly prefetch will make them always available.

---

## Phase 4 — Stats, coverage & AI coach (2026-09-24)

**Built**
- **Move stats** (builder → Stats): eval after the move and the engine's best, **eval swing** (flagged ≥ 0.7), share / games / your score / W-D-L at your rating and among masters, the masters who chose it, and your own training accuracy on that position.
- **Coverage + gaps** (builder → Coverage): walks the repertoire with real-game frequencies at your rating → "Handles 50% of games at 1600 blitz/rapid through move 10", biggest gaps ranked by how often you'll actually meet them, one-tap **Add** / **Open**, and positions where it's your move but nothing is prepared. Pure math in `packages/shared/src/coverage.ts` (tested).
- **Mistake radar**: opponent replies played in ≥ 5% of games at your level that lose ≥ 1.0 pawn (cloud evals before/after — nothing guessed), with the engine's punishment; **Add** puts the mistake + refutation into the repertoire so it comes up in training; **Why?** asks the coach ("Punish this").
- **AI coach** (grounded, per PLAN §8): server builds a **facts packet** (FEN, side to move, move/prep move, opening, engine MultiPV in SAN + evals + depth, eval swing, explorer stats at your rating and masters, top players, pawn structure: islands / isolated / doubled / passed pawns, open & half-open files, castling, material). System prompt forbids anything outside the packet; every `[[move]]` in the answer is **validated with chessops** (legal now or in the packet's lines) → one regeneration → otherwise a deterministic **template explanation** built from the same facts. Kinds: **Why this move**, **Line story**, **Why was I wrong?** (session summary), **Punish this** (radar), **Ask the coach** (chat per position). Answers render as short markdown with **clickable move chips** (hover = arrow, click = play). Always labelled "AI coach" vs "From the engine and game statistics".
- Provider layer: `GeminiProvider` (model names from `AI_MODEL_FAST` / `AI_MODEL_LONG`, default `gemini-flash-lite-latest`) with `GroqProvider` fallback; **concurrency 1**, jittered exponential back-off on 429, **daily budget** counted per Pacific day (when Gemini's free quota resets) → "coach is resting, back tomorrow" + template. Explanations cached forever and shared across users (`ai_explanations`), so the free quota is spent once per position. `/api/coach` is rate-limited (30/min/IP).
- **Mastery heatmap** on every repertoire row (one cell per position you must know, coloured by FSRS retrievability, grey = not learned, plus mean %), **daily goal** ring on Today (configurable), streak (Phase 3).
- **Nightly prefetch** (03:17 UTC): explorer (masters + each user's rating band) and cloud evals for every repertoire position, one request at a time, 2,000/night cap.
- Builder panels are now scrollable pill tabs: Moves · Explorer · Engine · Stats · Coach · Suggest · Notes · Coverage.

**Try it**: open a repertoire → Coach / Stats / Coverage. Without `GEMINI_API_KEY` the coach answers from the engine + stats template (clearly labelled); add the key to get AI prose.

**Tests**: shared 51 (coverage, structure, facts, move validation, template), API 14 (coach: AI accepted + cached, invented moves → regenerate → template, budget → resting, validation), e2e 40/40 over 2 repeats (coach chips play moves, stats, coverage + add gap, why-was-I-wrong).

**Known issues**
- The coach and the explorer-driven features need `GEMINI_API_KEY` / `LICHESS_FALLBACK_TOKEN` (or sign-in) to show real data; without them they degrade gracefully.
- Radar only checks positions that have a Lichess cloud eval (by design — no invented evals); the nightly prefetch fills more of them over time.

---

## Phase 5 — Everywhere: notifications, PWA, native apps (2026-09-24)

**Built**
- **PWA**: installable manifest (MainLine icons incl. maskable, shortcuts, **share target** and **file handler** for PGNs), custom Workbox service worker (`src/sw.ts`): precached app shell, runtime caches for the engine, pieces, fonts and evals. **Verified offline**: the app reloads, stays cross-origin isolated and the board plays moves. Shared/opened PGNs land in the import sheet.
- **Web Push**: VAPID, guest or signed-in subscriptions carrying the device's timezone / reminder time / due count / streak; a 5-minute cron sends the **daily reminder only when something is due**, an **evening streak nudge** (20:30 local, only if the streak is at risk) and a **Sunday summary**; dead subscriptions are pruned. Scheduling logic is pure and tested. **iOS "Add to Home Screen" hint** when needed. Settings → Reminders (toggle + time).
- **Capacitor iOS + Android** (`platform/capacitor.ts`): Haptics, **local notifications scheduled on-device** (today + the next 7 days with accurate due counts, streak nudge; no server), share sheet (PGN files), "Open in MainLine" for `.pgn` files, **deep links** (`app.mainline.chess://…`) incl. the **Lichess OAuth return** (system browser → one-time code → session), status bar following the theme, splash handed to the web launch animation, Android back button, edge-to-edge safe areas.
- **iOS Liquid Glass tab bar**: in-app Capacitor plugin `NativeChrome` (SwiftUI, `.glassEffect()` on iOS 26+, `.ultraThinMaterial` before) over the web view, with SF Symbols and the theme accent; routing stays in React; hidden during training. Verified in the iPhone 17 simulator.
- **Tauri desktop** (Windows / macOS / Linux): notifications, window-state, `mainline://` deep links (desktop OAuth return), `.pgn` file association + open-file events, native save dialog, external links, **auto-updater** (signed with a free minisign key; OS builds remain unsigned).
- **CI** (`.github/workflows/native.yml`): on `v*` tags → Android APK + desktop bundles for all 3 OSes attached to a draft GitHub release, with the updater's `latest.json`.
- Fixed: platform hooks ran at import time (before `initPlatform`), which silently stopped the app from booting in native shells — caught by testing in the simulator.

**Verified on devices/simulators**: iPhone 17 (iOS 26.5) simulator — launch, Today, native glass tab bar; Android emulator (API 36) — launch animation, deep link into Explore, **real touch drag**, local Stockfish; macOS `.app` builds and launches.

**Try it**: `pnpm --filter @mainline/mobile build` then `pnpm --filter @mainline/mobile ios|android`; `pnpm --filter @mainline/desktop dev`.

**Secrets / setup needed**
- `TAURI_SIGNING_PRIVATE_KEY` (+ empty `…_PASSWORD`) GitHub secrets: contents of `secrets/tauri-updater.key` (generated locally, git-ignored). The public key is already in `tauri.conf.json`.
- GitHub **variable** `PUBLIC_API_URL` = your Railway URL, used by native builds to reach the API.
- VAPID keys: already generated in `.env` (see the final summary for where to put them on Railway).

**Known issues**
- The Android emulator (software GPU) showed a faint ghost of the active tab at the screen edges; the DOM has nothing there — likely an emulator compositing artifact. Please check on a real Android phone.
- Desktop reminders fire only while the app is open (desktop notifications can't be pre-scheduled).
- In local dev, native apps can't reach the plain-http API (they run on https/capacitor origins) — production uses https.

---

## Phase 6 — Your games vs your prep (2026-09-24)

**Built**
- **Import** from **Lichess** (NDJSON, standard games only; uses your Lichess token when signed in) and **Chess.com** (public monthly archives, descriptive User-Agent, one request at a time) through `/api/games`, normalised to the first 40 plies. **Incremental** per account (only games newer than the last import); auto-refresh in the background on app start (at most every 6 h). Works for guests (just type usernames); your Lichess username is prefilled when signed in.
- **First deviation per game** (pure, tested, runs on the device against your local repertoire): *you left book* (your move ≠ your trained move → **that position is made due for review now**), *opponent left book*, *end of prep*, *not in your repertoire*. Moves before a repertoire's starting position (e.g. 1.e4 c5 for a Sicilian repertoire) count as book.
- **"Where your prep breaks"** dashboard: Surprises / Forgotten / Prep ended, grouped by position with counts and the moves actually played; **Add \<move\>** puts an opponent surprise into the right repertoire, **Open** jumps to it in the builder.
- **Your results per line** (win/draw/loss and score for each book line you actually reached), **recent games** with their deviation chip and link to the game.
- **Opponent prep**: enter a username (Lichess or Chess.com) → their recent games become an opening tree, walked together with your repertoire: where their common choices meet your prep, how often, and which ones you haven't prepared.

**Try it**: Games tab → enter a Lichess or Chess.com username → Import games. Try Opponent prep with any username.

**Tests**: shared 58 (deviation kinds incl. root-path book, aggregation, results per line, opponent meets), API 22 (Lichess NDJSON + Chess.com archive normalisation, validation), e2e: import → summary → add surprise → forgotten move becomes due on Today → opponent prep.

**Known issues**
- Games stay on the device (they're re-downloadable, so they aren't synced); the nightly server-side import in PLAN §9 wasn't needed because analysis must use the local-first repertoire.
- Chess.com's public API only offers monthly archives; the first import reads the last 3 months.

## Phase 7 — Polish (2026-09-25)

**Built**
- **Onboarding** at `/welcome` (first run with no repertoires): your level (sets the explorer rating band) and time controls → pick starter repertoires (Italian, London, Caro-Kann, QGD; every move verified legal by a unit test) → straight into Learn. Skippable; never shown again once finished or skipped.
- **Accessibility**: screen-reader move announcements (polite live region: "Knight f3", "Bishop takes c6, check"); **type a move** field on every board (`/` focuses it; SAN or UCI; works in the builder, the trainer and Explore); colour-blind-safe mastery strip (shape + position cue, not colour alone); focus rings, labelled controls, tree navigation by arrow keys.
- **Performance budgets**: every screen except Today is lazy-loaded; `scripts/check-budgets.mjs` fails CI if first-load JS > 180 KB gz or CSS > 24 KB gz (now 173 KB / 11 KB).
- **i18n scaffolding**: `useT()` with English complete and Hebrew/Arabic stubs; Settings → Language; RTL flips the whole layout while boards stay LTR (a chessboard never mirrors).
- **Visual regression**: `e2e/visual.spec.ts`, Today / Repertoire / builder / Settings at phone, tablet and desktop in light and dark (24 baselines, opt-in because pixels differ per OS).

**Try it**: clear site data → open the app → onboarding. In the builder press `/` and type `Nf3`. Settings → Language → עברית (preview) to see RTL.
Visual checks: `VISUAL=1 pnpm e2e visual` (add `--update-snapshots` after an intended UI change).

**Tests**: shared 58, web 21 (announcements, templates, …), API 22; e2e 23 across desktop / iPhone (WebKit) / Android (Chromium), including the onboarding flow.

**Known issues**
- Hebrew and Arabic have only the navigation and core strings translated; everything else falls back to English.
- Lighthouse isn't wired into CI (budgets are enforced by the bundle check instead).
