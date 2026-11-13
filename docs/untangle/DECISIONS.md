# Untangle: decision log

Method: `~/.claude/skills/untangle-codebase`. Additions chosen by the owner: **Comments** (remove comments that only
restate code) and **Tests** (remove tests that cannot catch a bug, fix ones that fail without one; done last).
Constraints: the live server and the shipped 1.0.1 app keep working (no endpoint, payload or stored-data breaks);
`tools/store-screenshots/` and `apps/web/src/demo/storeDemo.ts` stay. Numbers: `METRICS.md`.

Baseline (main 79a4fb7, Node 22): typecheck green, **lint red (1 error, storeDemo.ts:482)**, tests shared 91 / web 80 / api 42.

## Fixes, each above the problems it solves

- **F1. `@mainline/shared` owns every rule the app and server must agree on** (UCI/FEN validation, castling form, eval depths, rating/speed query keys, opening search, default prefs).
  - UCI regex written in `api/routes/coach.ts:8`, `api/routes/sync.ts:34`, `shared/schemas.ts:17`, `web/board/MoveInput.tsx:30`.
  - FEN validator `z.string().min(10).max(120)` repeated in `shared/schemas.ts:6`, `api/routes/chess.ts:39,52,66`, `api/routes/coach.ts:11`.
  - Castling map `e1h1→e1g1…` written twice (`api/services/explorer.ts:72`, `api/services/evals.ts:78`).
  - Eval depth thresholds 18 / 16 / 30 are bare numbers in `web/lib/evals.ts:27`, `api/services/evals.ts:112,47`.
  - `api/services/coach.ts:149` re-types `ratingBandsFor`.
  - `api/services/openings.ts:32` and `web/lib/openings.ts:35` are the same search.
  - Explorer cache key built three ways (`web/lib/explorer.ts:10`, `web/lib/guide.ts:12`, `api/services/explorer.ts:30`); `web/lib/guide.ts:49` and `explorer.ts:19` build the same URL params.
- **F2. One bug: the eval cache ignores `multiPv`.** `api/services/evals.ts:20` keys by epd, so a 1-line answer cached first answers a later 5-line request with one line.
- **F3. One safe-storage module (`web/lib/storage.ts`) for every localStorage use.**
  - Hand-rolled try/catch adapters in `lib/prefs.ts:48`, `lib/plan.ts:142`, `lib/api.ts:20`, `lib/push.ts:42-68` (two writes unguarded), `lib/packs.ts:753`, `screens/LibraryScreen.tsx:779`.
  - `lib/auth.ts:68` `localStorage.clear()` wipes every module's keys: logout is coupled to all of them.
- **F4. One IndexedDB cache helper (`web/lib/cache.ts`).**
  - `lib/evals.ts` and `lib/explorer.ts` are clones (memory Map + `db().then(put).catch(()=>undefined)` x8); `lib/coach.ts:14` a third memory cache.
- **F5. One day module (`web/lib/day.ts`).**
  - `localDay` in `lib/plan.ts:43` and `lib/reminders.ts:13`; `DAY` in `reminders.ts:12` and `stats.ts:9`; `startOfDay` `stats.ts:61`; `ui/streak.tsx:11` `toDateString()`.
- **F6. One opening vocabulary (`lib/packs.ts` / `lib/line.ts`).**
  - First-move table written 4 times (`packs.ts:712,773`, `LibraryScreen.tsx:64-65`) and a 3-entry copy in `OpeningsScreen.tsx:70` that silently drops Nf3/Nc3 (bug).
  - "1.e4 e5 2.Nf3" numbering re-implemented 8 times (`GamesScreen`, `OpeningsScreen`, `NewFolderSheet`, `FolderSettingsSheet`, `LinePanel`, `assistant.ts`, `packs.ts`).
- **F7. Platform differences live in `platform/`.**
  - `App.tsx:59`, `lib/incomingHandler.ts:22`, `lib/auth.ts:89`, `main.tsx:33` branch on `platform().kind` and dynamic-import platform modules.
- **F8. Dead code goes.**
  - Unused: `shared/chess.ts moveLabel`, `shared/tree.ts countNodes`, `ucisToPath`; ~35 exports used only in their own file; the unused `/api/openings/at|search` routes stay (live server contract) but are noted.
  - `api/app.ts:96` leftover dynamic import "registered by later phases".
- **F9. Errors are not swallowed silently where the reason matters.**
  - `api/lib/session.ts:39` unhandled `void db.update`; `api/lib/session.ts:76` decrypt failure; `api/routes/auth.ts:177,218-232,284`; background jobs `api/jobs/background.ts:51,100`.
- **F10. Comments and tests** (last): restating comments removed; `auth.test.ts` mirror assertion, `guide.test.ts toBeDefined`, order-dependent `coach.test.ts`, one-off e2e sleeps flagged.

## Not done, and why
- Dropping `game_deviations` (unused table): needs a migration on the live DB; left (stored-data rule).
- Splitting `LibraryScreen.tsx`/`RepertoireScreen.tsx` into hooks: see the final step in the log below.

## Steps
- [x] **untangle(1)** baseline, metrics, log, lint error fixed.
- [x] **untangle(2)** F1 + F2: `UCI_RE`, `castlingAsKingMove`, `EVAL_*_DEPTH`, zod `fenSchema/uciSchema/langSchema/speedSchema/csv` and the opening table/search now live once in `@mainline/shared`; api routes/services and web use them. **Bug fixed (F2):** the server's eval cache answered a request for 3-5 lines with an earlier one-line answer; entries now remember how many lines they were asked for (new test). Request coalescing kept.
- [x] **untangle(3)** F3: `web/lib/storage.ts` (`local`, `session`, `KEYS`, `persistStorage`) replaces six hand-rolled try/catch adapters. Push's two unguarded `setItem/removeItem` (threw in private mode) are now guarded — bug fixed. Key names unchanged (stored data).
- [x] **untangle(4)** F4: `web/lib/cache.ts` `deviceCache(store)` (memory + IndexedDB) replaces the cloned caches in `evals.ts`/`explorer.ts`; `explorerQuery(rating, speeds)` is the one place that decides which buckets/speeds a request and its cache key use (guide and explorer shared it by copy). The guide request now sends speeds in the same canonical order as its key.
- [x] **untangle(5)** F5: `web/lib/day.ts` (`DAY`, `localDay`, `startOfDay`, `useToday`) replaces two `localDay`s, two `DAY`s, two `startOfDay`s, the `toDateString` key and four `86_400_000` literals; new `day.test.ts`.
- [x] **untangle(6)** F6: `lib/line.ts` (`numbered`, `formatLine`, `sanLineOf`) replaces six hand-rolled "1.e4 e5 2.Nf3" builders; `FIRST_BY_UCI`/`firstOf`/`FIRST_UCI_ORDER` in `packs.ts` replace four first-move tables. **Bug fixed:** Openings screen's table lacked Nf3 and Nc3, so Réti/Nimzo-Larsen-type openings were never filed under their first-move folder. (`packs.ts` PGN-name "1. e4" spaced form kept: different, intentional display.) New `line.test.ts`.
- [x] **untangle(7)** F7: `Platform` gained `authParams`, `closeAuthBrowser()`, `start(host)`; `App.tsx`, `main.tsx`, `lib/auth.ts`, `lib/incomingHandler.ts` no longer branch on `platform().kind` or dynamic-import platform modules (service-worker registration moved into the web platform).
- [x] **untangle(8)** F8: removed `moveLabel`, `countNodes`, 54 value exports used only in their own file, the "later phases" dynamic import in `api/app.ts`. Types stay exported (they are signatures callers write). `game_deviations` (never read or written) stays in schema: dropping it needs a live-DB migration.
- [x] **untangle(10)** `LibraryScreen.tsx` (1062 lines) split along its change lines: `library/finderModel.ts` (item/sheet types, row context, folder ordering), `library/Finder.tsx` (rows, sidebar, path bar, drop targets), `library/Views.tsx` (root/colour/folder views); the screen keeps state and actions (436 lines).
