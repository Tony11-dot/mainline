# Mainline — Product & Technical Plan

> **Mainline** — master your openings, branch by branch.
> In chess, the *main line* is the best-trodden path through an opening. In git, `main` is the branch everything grows from. Mainline treats your repertoire like a repo: folders, branches (variations), and spaced-repetition training until every line is yours.
>
> This file lives in the repo root and is the source of truth. Claude Code keeps it updated when decisions change.

---

## 1. Vision

A chess opening teacher that matches Chessbook's depth, feels as good as chess.com/Lichess to move pieces on, explains *why* every move is played, and runs everywhere — web, iOS, Android, Windows, macOS, Linux — for free (beyond the owner's existing Railway Pro plan).

Five promises:
1. **Organize.** Nested folders and repertoires, e.g. `Black/vs 1.e4/Sicilian Najdorf`, `White/1.d4/London`.
2. **Understand.** Every move shows engine eval, eval swing, win/draw/loss at *your* rating, master usage, the top players who chose it — and an AI coach explanation grounded in those facts.
3. **Remember.** FSRS spaced repetition on every position where it's your move, with daily reminders on every device.
4. **Apply.** Import your real games and see exactly where you or your opponent left your prep.
5. **Everywhere.** One codebase, every platform, offline training.

---

## 2. Hard constraints

- **Free.** Only paid infra: the owner's Railway Pro plan (one web service + one Postgres). Every API and library must be free. Anything that would cost money (app-store fees, paid APIs) is flagged, never silently added.
- **Board quality is a feature.** Drag-and-drop *and* click-click, smooth animation, legal-move dots, sounds, arrows, haptics, flawless touch on phones.
- **No invented chess.** Every stat traces to an engine eval or game database. The AI coach only explains facts the app already computed; it never grades moves or suggests moves of its own.
- **Transpositions are first-class.** Positions are keyed by normalized FEN (EPD), never by move path.

---

## 3. Platforms

One React + TypeScript app, wrapped per platform:

| Platform | How | Cost notes |
|---|---|---|
| Web (all browsers) | Vite SPA served by the API on Railway | Free |
| Installable PWA (iOS, Android, desktop) | vite-plugin-pwa; Web Push | Free. iOS needs "Add to Home Screen" (16.4+) for push |
| Android | **Capacitor** → APK / AAB | Owner already has a Play Console account |
| iOS / iPadOS | **Capacitor** → Xcode project | Owner has a Mac with Xcode and an Apple Developer account → TestFlight + App Store |
| Windows / macOS / Linux | **Tauri 2** desktop app | Free. Unsigned builds show an OS warning; code signing is optional/paid |

Rules for cross-platform code:
- All platform differences go through a small `platform` adapter in `packages/shared` / `apps/web/src/platform/` (storage, notifications, haptics, sharing, deep links, file import).
- Stockfish: use the multi-threaded **lite** WASM build (`stockfish-19-lite.js`, ~1.6 MB NNUE) when `crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined'`, otherwise `stockfish-19-lite-single.js`. Never crash if threads are unavailable. Reality check (verified 2026-09): threads work on the Railway web build (COOP/COEP) and in Tauri on Windows (WebView2, via `app.security.headers`); they do **not** work in Capacitor (Android WebView has no site isolation; iOS WKURLSchemeHandler responses never become cross-origin-isolated) and are unreliable in Tauri on macOS/Linux (custom scheme / WebKitGTK). **Safari/WebKit (incl. every iOS browser and WKWebView) blocks the threaded build's nested pthread workers even when isolated** (verified in Playwright WebKit), so WebKit always gets the single-threaded build; a watchdog also falls back if the threaded engine isn't ready in 8 s. So mobile + most desktop builds run single-threaded lite — which is plenty for opening positions, and Lichess cloud eval covers deep evals. The full 99 MB NNUE build is **not** bundled anywhere.
- Reminders: native apps schedule **local notifications** on-device (Capacitor Local Notifications / Tauri notification plugin) from the locally known due count — no push server needed. Web/PWA uses Web Push from the server. Android native may additionally use FCM (free) later.
- **Local-first**: the device is the source of truth for folders, repertoires, moves and cards (IndexedDB on every platform — Capacitor and Tauri webviews persist it). The app is fully usable **without an account** (guest mode; also needed for Apple review). Signing in with Lichess adds sync: each row carries `updated_at` + `deleted`, the client pushes changed rows and pulls rows newer than its last sync cursor, last-write-wins per row. Explorer/engine/AI data always comes from the server (cached locally for offline use).
- Responsive layouts: phone (portrait board-first), tablet, desktop (board + side panels). Safe-area insets on iOS.

---

## 4. Free data & tooling stack

| Need | Source | Notes |
|---|---|---|
| Board UI | **chessground** (Lichess's board) | Drag/click, animation, arrows, mobile. GPL-3.0 |
| Rules, PGN with variations, FEN | **chessops** | Parses PGN with nested variations. GPL-3.0 |
| Engine | **Stockfish 19 WASM** in a Web Worker (`stockfish` npm, lite NNUE builds only: `-lite` threaded / `-lite-single`) | Runs on the user's device → zero server CPU. The full-NNUE build is 99 MB — never shipped |
| Deep evals for common positions | **Lichess cloud eval** `GET https://lichess.org/api/cloud-eval?fen=…&multiPv=3` | Try first; fall back to local Stockfish |
| Game stats by rating/speed | **Lichess explorer** `https://explorer.lichess.org/lichess` | **Requires a Lichess token** (verified: HTTP 401 without one). Server uses the signed-in user's token, else the owner's `LICHESS_FALLBACK_TOKEN`; guests get cached data + fallback token |
| Master games, GM usage, top players | **Masters explorer** `https://explorer.lichess.org/masters` | Same token rule. `topGames` gives names/ratings/years |
| Opening names & ECO | **lichess-org/chess-openings** TSV (CC0) | Precomputed to EPD (`packages/shared/scripts/build-openings.ts`), committed as JSON; served from memory by the API and lazy-loaded by the client (works offline). No DB seeding needed |
| User's Lichess games | Lichess API `/api/games/user/{username}` (NDJSON) | User's OAuth token |
| User's Chess.com games | Chess.com public API `https://api.chess.com/pub/player/{user}/games/archives` | No auth; descriptive User-Agent |
| Spaced repetition | **ts-fsrs** (MIT) | FSRS scheduler |
| AI coach | **Google Gemini API free tier** via AI Studio key — **Flash-Lite** for everything by default | Free tier (Sept 2026): Flash-Lite ≈ 500 requests/day, current Flash models only ≈ 20/day — so `AI_MODEL_LONG` also defaults to Flash-Lite; Flash is opt-in. Limits are per Google Cloud project, reset at midnight Pacific, and change without notice; the server discovers available models via `models.list` at boot and logs them. Free-tier prompts may be used by Google to improve products → only chess positions/stats are ever sent, never personal data (stated in the privacy policy). Fallback provider: **Groq free tier** (optional) |
| Web push | `web-push` (MPL-2.0 — GPL-compatible) + VAPID keys | Free |
| Auth | **Sign in with Lichess** (OAuth 2 PKCE, public client, no secret) — optional; guest mode works fully | Yields each user's explorer token. Full-page redirect (not a popup — COOP `same-origin` breaks popups). Native apps use a custom-scheme redirect `app.mainline.chess://auth`. Server issues its own session token (HttpOnly cookie on web, bearer token on native) |
| Mobile shell | Capacitor (MIT) | |
| Desktop shell | Tauri 2 (MIT/Apache) | |

**Licensing:** chessground, chessops and Stockfish are GPL-3.0 → Mainline is released as **GPL-3.0 open source**. A future closed-source edition would need swaps (react-chessboard, chess.js) and real legal advice.
- App Store + GPL: the FSF considers Apple's store terms incompatible with GPL for *third-party* GPL code (VLC 2011). Lichess, and many Stockfish apps ship GPL/AGPL code on the App Store without issue today, but it is a known gray area — flagged, not a blocker.
- Assets: pieces = **cburnett** (GPLv2+, Colin M.L. Burnett — the Lichess default, bundled with chessground's CSS). Sounds are **synthesized at runtime** with WebAudio (`apps/web/src/lib/sound.ts`, pre-rendered once into buffers) so we own them outright and ship no audio assets; Lichess's sound packs are AGPL and are not bundled. Fonts: system stack + Inter (OFL) self-hosted — COEP `require-corp` forbids third-party font CDNs.

**Lichess API etiquette (enforce in code):** one explorer request at a time per token; on HTTP 429 wait a full 60 s; always go through the server proxy + cache, never call the explorer from clients directly.

---

## 5. Architecture

```
pnpm monorepo (Turborepo optional)
├─ apps/web        Vite + React + TS + Tailwind; chessground; Stockfish worker; PWA; platform adapters
├─ apps/mobile     Capacitor project wrapping apps/web build (ios/, android/)
├─ apps/desktop    Tauri 2 project wrapping apps/web build
├─ apps/api        Node + Fastify + Drizzle + Postgres; serves web build (ONE Railway service);
│                  Lichess/Chess.com proxy + cache; FSRS sync; AI coach service; web-push cron
└─ packages/shared zod schemas, types, EPD normalization, tree/line utils, coverage math, FSRS helpers
```

- One Railway service (API + static SPA) + one Railway Postgres.
- Web responses set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (plus `Cross-Origin-Resource-Policy: same-site` on API responses). Consequence: every asset is self-hosted; no third-party scripts/fonts/images. The Vite dev server sets the same headers.
- Native apps call the same API over HTTPS (`VITE_API_URL`), with CORS configured for Capacitor/Tauri origins (`capacitor://localhost`, `https://localhost`, `tauri://localhost`, `http://tauri.localhost`).
- Node 22 LTS everywhere (Capacitor 8 CLI and Vitest 5 require it). Railway deploys the repo's `Dockerfile`.
- Jobs (web push, cache prefetch, AI explanation queue) run in-process with `node-cron` + a simple Postgres-backed job table.

---

## 6. Data model (Postgres via Drizzle)

```
users            id, lichess_username, lichess_token_enc, chesscom_username, rating, rating_speed,
                 timezone, reminder_time, daily_new_limit, created_at
folders          id, user_id, parent_id NULL, name, color ('white'|'black'), sort_index
repertoires      id, user_id, folder_id, name, color, root_epd, root_moves_uci[], created_at
repertoire_moves repertoire_id, from_epd, uci, san, to_epd, is_mainline, note, shapes_json, added_at
                 PK (repertoire_id, from_epd, uci)
cards            user_id, color, epd, fsrs_state_json, due, last_review
review_log       id, user_id, card_epd, color, rating (1-4), played_uci, expected_uci[], mode, ms_taken, reviewed_at
explorer_cache   source ('masters'|'lichess'), epd, params_hash, payload_json, fetched_at
engine_evals     epd, depth, multipv_json, source ('cloud'|'local'), updated_at        -- shared by all users
openings         epd, eco, name, pgn
ai_explanations  kind ('move'|'line'|'mistake'|'position'), key_hash, facts_json, text_md, model, created_at
                 -- shared cache; key_hash = hash(kind + epd + uci/path + facts version)
push_subs        id, user_id, endpoint, keys_json, created_at
games            id, user_id, site, external_id, pgn, color, result, played_at
game_deviations  game_id, ply, epd, kind ('you_left_book'|'opponent_left_book'|'end_of_prep'), played_uci, expected_uci[]
jobs             id, type, payload_json, status, attempts, run_after, last_error
sessions         id (random 32-byte token, stored hashed), user_id, created_at, last_seen_at
```

Synced tables (`folders`, `repertoires`, `repertoire_moves`, `cards`, `review_log`) also carry `updated_at` and `deleted` (tombstones) for local-first sync (§3); client-generated ids are UUIDv7.

Rules:
- **EPD normalization**: first four FEN fields; en-passant square only if an en-passant capture is legal. Heavily unit-tested in `packages/shared`.
- A **card** exists for each position where the side to move is the repertoire's color and a move is prescribed. Shared across same-color repertoires → transpositions learned once.
- **Conflict detection** when same-color repertoires prescribe different moves in one position.
- A **line** = path root → leaf. Line mastery = mean FSRS retrievability of its cards.

---

## 7. Caching (keeps it free and fast)

| Data | TTL |
|---|---|
| Masters explorer | 90 days |
| Lichess explorer | 14 days (keyed by rating band + speeds) |
| Engine evals | forever; replace when a deeper eval arrives (validate client-submitted evals: legal PV, sane depth) |
| AI explanations | forever per (kind, position, facts version); shared across users |
| Opening names | static |

Nightly job prefetches explorer data + cloud evals for every repertoire node (one request at a time). AI explanations are generated lazily on first view, then cached — so the free Gemini quota is spent once per position, not once per user.

---

## 8. The AI coach ("Why?")

Goal: turn numbers into understanding, like a coach sitting next to you.

**Features**
1. **Why this move** — on any repertoire move: the idea, what it prepares, what it prevents, typical plans for both sides, the key pawn structure.
2. **Line story** — for a whole variation: a short narrative from the first move to the tabiya, with the 2–3 ideas to remember.
3. **Why was I wrong?** — in training, after a mistake: compares your move with the prep move using engine lines and eval difference ("…Nf6 lets White play e5 with tempo; the prep move …d6 stops it").
4. **Punish this** — for Mistake Radar positions: explains the refutation of the popular mistake.
5. **Ask the coach** — a chat box on any position; answers are grounded in that position's computed facts.

**Grounding (non-negotiable)**
- The server builds a **facts packet** per request: FEN, side to move, move played / prep move, opening name + ECO, engine MultiPV lines (SAN) with evals and depth, eval swing, explorer stats (popularity, W/D/L at user's rating and masters), top players who chose the move, simple structure features computed with chessops (pawn islands, isolated/doubled/passed pawns, open files, castling status, material).
- System prompt: explain *only* using the packet; every concrete move mentioned must appear in the packet's engine lines or be legal from the FEN (validated after generation with chessops — if validation fails, regenerate once, then fall back to a template explanation); never assign evals or grades of your own; say "the engine prefers" rather than inventing reasons when unsure; 80–150 words for move explanations.
- Output: short markdown; move tokens like `[[Nf3]]` are rendered as clickable moves that play on the board / show arrows.

**Provider layer**
- `AiProvider` interface with `GeminiProvider` (default model Flash-Lite, configurable via env) and `GroqProvider` fallback. Model names come from env (`AI_MODEL_FAST`, `AI_MODEL_LONG`) — never hard-coded, since free-tier model lineups change.
- Queue with a concurrency of 1, exponential backoff with jitter on 429, daily budget counter; when the budget is hit, show cached/template explanations and a "coach is resting, back tomorrow" state.
- Explanations cached in `ai_explanations`; a facts-version bump invalidates.

---

## 9. Features by phase

### Phase 0 — Scaffold
- pnpm monorepo, TS strict, ESLint/Prettier, Vitest, Playwright; GitHub Actions (typecheck, lint, test, build web).
- Fastify serves SPA with COOP/COEP; health endpoint; Drizzle migrations; `.env.example`; Railway config (Dockerfile or Nixpacks).
- Capacitor and Tauri projects created and building the web app (smoke build only).

### Phase 1 — Board & explorer
- chessground board: drag + click, legal dots, last-move/check highlights, 200 ms animation, promotion picker, coordinates, flip, board & piece themes (verify every asset's license before bundling).
- Sounds (move/capture/check/castle/error) + mute; haptics via platform adapter.
- Arrows/circles (right-click drag on desktop, long-press on touch), saved per move.
- Keyboard nav (←/→, ↑/↓, `f` flip). Move tree panel with collapsible variations.
- Explorer panel: Masters / Lichess (your rating) tabs; games, %, W/D/L bar, avg rating.
- Engine panel: eval bar, 3-line MultiPV, depth; cloud eval first.
- Opening name + ECO for current position.
- Sign in with Lichess (PKCE); token encrypted at rest (AES-GCM).

### Phase 2 — Repertoires & folders
- Folder tree (create/rename/move/delete, drag reorder); default roots **White** and **Black**.
- Repertoire = color + optional starting moves.
- Builder mode; one move per own position (alternates flagged), many opponent replies.
- Auto-build: "Add popular replies" (≥ X% at your rating, to depth N); "Suggest my move" ranking by eval + practical win % + master usage.
- Opening library: search all named openings; preview; "Start a repertoire from here".
- PGN import (with variations) / export per repertoire or folder. Notes & shapes editor. Conflict + transposition badges.

### Phase 3 — Training
- FSRS via ts-fsrs. Modes: **Learn** (show then test, daily new limit), **Review** (from root toward due cards; opponent moves auto-played), **Drill** (any folder/line, opponent replies weighted by real frequency), **Position quiz**.
- Wrong → shake, show correct move, rate Again; slow → Hard.
- Session summary; offline queue + sync.

### Phase 4 — Stats, coverage & AI coach
- Per move/line: eval, eval swing (flag ≥ 0.7), W/D/L for your color at your rating and at master level, popularity, master games, top players who chose it, your training accuracy.
- **Coverage** + **gaps** list ("handles 93% of games at 1800 blitz through move 10").
- **Mistake radar** (opponent move frequency ≥ 5% and eval drop ≥ 1.0) → special drill cards.
- **AI coach** (§8): Why this move, Line story, Why was I wrong, Punish this, Ask the coach.
- Mastery heatmap, streaks, daily goal.

### Phase 5 — Everywhere: notifications, PWA, native apps
- PWA install + Web Push (daily due reminder at chosen local time only when cards are due; evening streak nudge; weekly summary). iOS "Add to Home Screen" hint.
- Capacitor Android + iOS: local notifications, haptics, share-sheet PGN import, deep links, safe areas, splash/icons.
- Tauri desktop (Windows/macOS/Linux): notifications, window state, file-open for PGN, auto-update config (unsigned).
- GitHub Actions: build Android APK, Tauri desktop bundles for 3 OSes as release artifacts.

### Phase 6 — Your games vs your prep
- Import from Lichess + Chess.com (incremental background job).
- First deviation per game: you left book (→ due card now), opponent left book (→ suggest adding if common), end of prep.
- "Where your prep breaks" dashboard; your results per line.
- **Opponent prep**: username → their opening tree → where it meets your repertoire.

### Phase 7 — Polish
- Onboarding (pick rating, speed, first repertoire from a template), empty states, accessibility (keyboard, screen-reader move announcements, color-blind safe), performance budgets, i18n scaffolding (English first; Hebrew/Arabic RTL-ready layout).

### Phase 8 — Store release: TestFlight & Google Play
Goal: every pushed release tag `v*` (e.g. `v1.2.0`) builds and ships automatically. Build number = GitHub run number (monotonic), version = tag.

**Automation Claude Code builds**
- **fastlane** for both platforms (`apps/mobile/fastlane/`). iOS builds use the latest **release** Xcode (26.x today — App Store Connect rejects builds made with beta Xcode 27 until its RC), iOS 26 SDK minimum (required for uploads since April 2026). Android targets API 36.
- **iOS → TestFlight**: GitHub Actions macOS runner (free only for **public** repos; a private repo on the free plan gets 2,000 min/month with a 10× macOS multiplier ≈ 12 iOS builds/month) builds the Capacitor iOS app, signs it with `fastlane match` (certs in a private git repo or encrypted storage) using an **App Store Connect API key**, and uploads with `pilot` to TestFlight. Bundle id `app.mainline.chess` (confirm with owner).
- **Android → Google Play**: Gradle release build → signed **AAB** (upload keystore stored as a GitHub secret, base64), uploaded with `fastlane supply` to the **internal testing** track, then promotable to closed/production.
- Version + build numbers derived from the git tag; changelog from `PROGRESS.md`.
- Store listing sources in repo (`apps/mobile/store/`): descriptions, keywords, screenshots generated by Playwright on phone/tablet viewports, app icon from the brand logo.
- **Privacy policy** and **terms** pages served by the API at `/privacy` and `/terms` (required by both stores). Draft answers for Google's Data safety form and Apple's privacy nutrition labels in `apps/mobile/store/compliance.md`.
- Apple review risk: guideline 4.2 (minimum functionality) rejects thin web wrappers → the iOS build must use native capabilities (local notifications, haptics, offline training, share-sheet PGN import) and feel native.
- Apple 4.8 (Sign in with Apple): not required — Lichess login is optional and only links the user's Lichess account/data; guest mode is complete. Apple 5.1.1(v): any app with account sign-in must offer **in-app account deletion** → Settings → "Delete my account & data" (server + local).
- Google Play: new personal accounts need 12 testers × 14 days of closed testing **before production** only — the internal testing track works immediately. Play App Signing is used; the keystore we create is the *upload* key.

**The owner already has an Apple Developer (App Store Connect) account and a Google Play Console account.** The owner's Mac already has Xcode, fastlane, CocoaPods and the Android SDK — do the first release locally with fastlane, then move it to GitHub Actions.

**Owner-only steps (identity / console clicks — Claude Code gives exact instructions, never attempts them)**
- App Store Connect: create the app record (bundle id `app.mainline.chess` unless the owner picks another); create an App Store Connect API key (Issuer ID, Key ID, .p8) for fastlane and GitHub secrets.
- Google Play Console: create the app; the first AAB upload may have to be done by hand in the console; create a service account with Play Developer API access and provide its JSON.
- If the Play account is a personal account created after Nov 2023, it needs a **closed test with at least 12 testers for 14 days** before production access — plan for this.
- Fill the content-rating questionnaire and data-safety form (Claude Code provides the drafted answers).

---

## 10. Design & UX — Apple-premium, top priority

The bar: it should feel like an app Apple would feature. **Premium, clean, clear, reliable, predictable.** UI quality is as important as correctness — it is not a "Phase 7 polish" item; every phase ships at this bar.

**Use the owner's design skills.** Before building any UI, list the Claude Code skills installed on this machine (user and plugin skills, e.g. `impeccable` / frontend-design style skills) and load and follow every UI/design skill that applies. Re-check them before each UI-heavy phase.

**Visual language**
- Blue and white. Primary blue from the owner (placeholder `#1E5EFF` behind a single `--brand` token); whites and cool neutral greys; one accent only. Light mode is the hero look; a refined dark mode too.
- Typography: system font stack (`-apple-system`, SF Pro on Apple, Inter fallback elsewhere), a strict type scale, tabular numbers for stats, generous whitespace, 8-pt spacing grid.
- Materials: translucent "glass" surfaces for navigation and panels (see Liquid Glass below), soft layered shadows, large continuous corner radii.
- Motion: spring-based (e.g. Framer Motion / Motion One), 150–350 ms, purposeful; respect `prefers-reduced-motion`. Pieces glide; panels spring; nothing flickers or jumps.
- Icons: SF Symbols on native Apple builds; a consistent open-license set (e.g. Lucide) on web/other platforms.

**Liquid Glass on Apple devices**
- On iOS/iPadOS/macOS, use Apple's **real Liquid Glass** material for navigation chrome where the OS supports it (iOS 26+ design language; build against the latest Xcode/SDK on this Mac, i.e. iOS 27 if installed, and follow Apple's current HIG).
- A web view can't render true Liquid Glass, so the iOS app uses a **hybrid**: native SwiftUI chrome with system glass, hosting the Capacitor web view for the board and content.
- **Chosen approach (decided 2026-09-24):** a small in-app Capacitor plugin `NativeChrome` (Swift, lives in `apps/mobile/ios/App/App/NativeChrome/`). It overlays a SwiftUI tab bar (`TabView`-style bar using system glass on iOS 26+, `.ultraThinMaterial` below) on top of the bridge web view, exposes `setTabs / selectTab / setBadge / show / hide` to JS and emits `tabSelected`. The web app detects the plugin and hides its own CSS tab bar; routing stays in React. Sheets/toolbars stay web (CSS glass) in v1 — a native shell rewrite was rejected as too costly for the value. Build against the latest *release* Xcode (26.x); Xcode 27 beta is not used for store builds.
- Everywhere else (web, Android, Windows, Linux), a faithful CSS approximation: `backdrop-filter: blur() saturate()`, subtle specular highlight gradient, thin inner border — with a solid fallback when `backdrop-filter` is unsupported or the user enables "Reduce Transparency".
- Android native builds should feel native too (Material-appropriate back behavior, edge-to-edge, haptics) while keeping the Mainline visual identity.

**Clarity & predictability**
- Board is the hero on every screen; stats in collapsible panels / sheets.
- Mobile-first; thumb-reachable primary actions; 44-pt minimum touch targets.
- Home: one big **Train now** button with due count + estimated minutes.
- Same gesture always does the same thing; every destructive action has undo; no surprise modals.
- Skeleton loaders, optimistic updates, never block on network; clear offline state.
- Consistent empty, loading and error states for every screen; friendly, specific copy.
- Accessibility: WCAG AA contrast, Dynamic Type/text scaling, VoiceOver move announcements.

**Reliability**
- Visual regression screenshots (Playwright) for key screens at phone/tablet/desktop in light and dark.
- Performance budgets: 60 fps board animation on a mid-range phone, first load < 2.5 s on 4G, no layout shift.

---

## 11. Quality bar
- Unit tests: EPD normalization, tree/line utils, coverage math, FSRS integration, PGN round-trip, AI facts-packet builder and move-validation of AI output.
- Playwright: move by drag, move by click, add a line in builder, finish a review session, open an AI explanation (with the provider mocked).
- Lighthouse PWA/perf on mobile.
- Env vars (never committed): `DATABASE_URL`, `TOKEN_ENC_KEY`, `SESSION_SECRET`, `LICHESS_CLIENT_ID`, `LICHESS_FALLBACK_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUBLIC_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY` (optional), `AI_MODEL_FAST`, `AI_MODEL_LONG`, `AI_DAILY_BUDGET`.

---

## 12. Review log

**2026-09-24 — kickoff review (Claude Code).** Verified against live services / registries and fixed inline:
- Explorer really does return 401 without a token; cloud-eval works anonymously. ✔ plan was right.
- Stockfish: the full build is 99 MB → lite builds only; threads unavailable in Capacitor and flaky in Tauri macOS/Linux → single-thread fallback is the *normal* path on native (§3).
- Gemini free tier: Flash is now ~20 req/day, Flash-Lite ~500 → Flash-Lite for everything by default (§4).
- COEP `require-corp` ⇒ no third-party assets; OAuth via full-page redirect, not popup.
- Local-first with guest mode (offline + Apple review) instead of server-first (§3, §6).
- Node 22 required (Capacitor 8, Vitest 5). Rust installed for Tauri.
- Store: release Xcode only (not 27 beta); App Store account-deletion rule; Play 12-tester rule applies to production only; macOS CI minutes are only free on public repos.
- Lichess sounds are AGPL → we generate our own.

**Open questions for the owner** (defaults in use until answered): repo public or private on GitHub (default: private until you say otherwise); bundle id / application id `app.mainline.chess`; brand blue (placeholder `#1E5EFF`).

## 13. Working agreement for Claude Code
- Work through the phases in order, continuously. After each phase: run tests, commit with a clear message, tick the checklist, append a short entry to `PROGRESS.md` (what was built, how to try it, known issues).
- Only stop to ask the owner when you need: a secret/env value, a decision that costs money, a dependency whose license isn't MIT/BSD/Apache/ISC/GPL-compatible, or something PLAN.md gets wrong.
- If a secret is missing, stub it behind a clear error and keep building the parts that don't need it.
- Keep `packages/shared` pure and fully typed.

### Checklist
- [x] Phase 0 — Scaffold
- [x] Phase 1 — Board & explorer
- [x] Phase 2 — Repertoires & folders
- [x] Phase 3 — Training
- [x] Phase 4 — Stats, coverage & AI coach
- [x] Phase 5 — Everywhere: notifications, PWA, native apps
- [x] Phase 6 — Your games vs your prep
- [ ] Phase 7 — Polish
- [ ] Phase 8 — Store release: TestFlight & Google Play
