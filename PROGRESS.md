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
