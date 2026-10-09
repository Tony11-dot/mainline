# Redesign progress

Branch `redesign` (worktree `~/Dev/mainline-redesign`), started 2026-10-09 from `main` @ 757449e. Visual polish only: every piece of information, feature and navigation path stays; the main navigation (tab bar, sidebar, Ask AI button) stays exactly as it is. Nothing ships to production from this branch.

Status key: ⬜ untouched · 🎨 theme polish only (changed by the shared tokens/components, not reworked) · ✅ redesigned and seen rendered · ➖ intentionally left alone

## Baseline (main @ 757449e, 2026-10-09)

| Check | Result |
| --- | --- |
| `pnpm lint` (eslint, whole repo) | 0 errors, 0 warnings |
| `tsc --noEmit` (shared, api, web) | clean |
| vitest shared / api / web | 87 / 40 / 80 passed, 0 failed |
| Playwright (`pnpm exec playwright test`, phone + desktop + android) | 44 passed, 85 skipped (opt-in `VISUAL`/`STORE_SHOTS` specs and per-project skips), 0 failed |
| `node scripts/i18n.mjs --check` | 901 keys, every language complete |

No batch may add a warning or a failure to any row.

## Preview harness (local, excluded from git)

`apps/web/harness/` — Playwright renders the real screens with demo data (three repertoires, a 12-day streak, imported games, a signed-in player) to `harness/out/<run>/<scheme>/<lang>-x<scale>/<screen>-<viewport>.png`. Phone (iPhone 15, WebKit), tablet (820×1180) and desktop (1280×800); light and dark; any of the 19 languages (`HARNESS_LANGS`, RTL included); large text ×1.3 and ×2 (`HARNESS_SCALES`). Every shot records sideways scroll, off-screen elements, clipped text and ellipsis truncation; `HARNESS_STRICT=1` makes those fail the run. `node harness/report.mjs <run>` summarises.

Run: `cd apps/web && pnpm build && HARNESS_RUN=after pnpm exec playwright test -c harness/harness.config.ts screens`. `measure-launch.spec.ts` renders the launch animation's final frame at canvas size so its visual centre can be measured (PIL bounding box of non-background pixels).

Runs so far: `before` (main @ 757449e: 138 shots) and `after` (batch 1: 150 shots). Both flag only the Opening library's move lists on phones (inline `bdi` inside a truncating row — the row shows an ellipsis, so this is the check being strict; verify on the screen's own pass) and ellipsis truncation in StatTile sub-labels and Ready-made line previews.

## Foundation

| Item | Status | Notes |
| --- | --- | --- |
| Design tokens: spacing scale, radii, elevation, motion durations, semantic colours | ✅ | `styles.css`: `--space-1…12`, `--page-x`, `--section-gap`, `--stack-gap`, `--card-pad`; `--dur-fast/base/slow`, `--ease-out-expo`; `--radius-xs`, `--radius-control`; readable inks on tints (`--good-ink`, `--warn-ink`, `--bad-ink`, ≥ 4.5:1 in both schemes), `--gem*` (the guide's violet), `--toast-*`. `--ink-3` darkened a step (hints were ~4.3:1 on tinted surfaces); user themes mix it 92 % from the secondary ink instead of 78 %. |
| Theme switching, dark mode, 19 user themes, fonts, board colours keep working | ✅ | Every new token is scheme-based and derived from the same variables `lib/appearance.ts` sets; appearance e2e passes. |
| No hard-coded colours inside screens | 🎨 | Toasts, menus, Library (colour dots) moved to tokens. Still literal: GuidePanel tags (6), Appearance swatches (previews of other themes — intentional), Explorer/Engine/EvalBar bars, Games, PromotionPicker, Launch fallbacks. |
| Shared components: Card, SectionHeader, ListRow (icon tile), Pill/Badge, EmptyState, FormSection, PickerRow, SearchField, press feedback | ✅ | `ui/kit.tsx`: `Card`, `ListGroup`, `SectionHeader`, `Section`, `FormSection`, `FormRow`, `PageHeader`, `IconTile`, `Pill`, `ListRow`, `PickerRow`, `Toggle`, `EmptyState`, `SearchField`, `CircleButton`; `.pressable` for anything tappable that isn't a Button (reduced motion → opacity). Used by Today, Settings (all three files) and the Library so far. |
| Theme-level polish: cards, sheets, dialogs, toasts, chips, tabs, inputs, buttons | 🎨 | Button/IconButton/Segmented radii on tokens, 36 px small buttons; Sheet close is a 44 pt target, footer wraps; toast and menus on tokens, 44/40 px menu items; `inputCls` on tokens. |
| Type on the token scale (no `text-[Npx]`) | 🎨 | Pieces picker → `text-2xs`. Remaining: tab bar labels (10.5/11 px — shell, left alone), stats chart ticks. |

## Inside the app

### Shell
| Item | Status | Notes |
| --- | --- | --- |
| App shell: sidebar rail (md) / full sidebar (lg), tab bar + Ask AI circle (phones), native iOS bar | ➖ | Main navigation stays exactly as it is. |
| Launch screen | ✅ | Plain theme background, no ambient wash; the Jitter scene's artwork is centred at build time (`scripts/brand.mjs` `centerArtwork`, offset measured on the final frame: it sat 37.5 px left, 5.5 px low). Seen at phone, tablet and desktop. |
| Toasts (text, kinds, action/undo) | 🎨 | `ui/toast.tsx` on `--toast-*` tokens. |
| Context menu (right-click / long-press) | 🎨 | radius tokens, 40 px items, danger in `bad-ink`. |
| Menu (New…) | 🎨 | radius tokens, 44 px items. |
| Sheet (bottom sheet / centred dialog), Field, inputs | 🎨 | 44 pt close target, wrapping footer, inputs on tokens. |
| Ask AI sheet (conversation, composer, empty state) | ⬜ | `ui/Assistant.tsx` |
| Streak badge, streak sheet (last 7 days, milestone bar), celebration dialog | ⬜ | `ui/streak.tsx`, `ui/streakViews.tsx` |
| Board controls, eval bar, promotion picker | ⬜ | `board/` |
| Route loading (lazy chunks: currently nothing shown) | ⬜ | Add a quiet skeleton. |
| Unknown URL / route error | ⬜ | No `errorElement`: react-router's default error page shows. Give it the app's empty-state look with a way home (a bug fix, not a feature). |

### Today
| Item | Status | Notes |
| --- | --- | --- |
| Today with repertoires: primary action card, "All caught up", streak-at-risk banner, progress (goal ring, learned, retention), Practice list, Tools list | ✅ | `PageHeader`, `Card`, `ListGroup` + `ListRow` (sub-text wraps instead of truncating: "Study plan — A few days of sessions, built around your focus" now reads in full on phones). Seen light/dark × phone/tablet/desktop. |
| Today, first run: "Start your first repertoire" card | ✅ | On `Card`; seen on all three sizes. |
| Study plan card / Work on this card | ⬜ | `screens/focus/HomePlanCard.tsx` |
| Weak spot card (from imported games) | ⬜ | `screens/library/WeakSpotCard.tsx` |

### Onboarding
| Item | Status | Notes |
| --- | --- | --- |
| Welcome step 1 (intro) · step 2 (rating, "I mostly play") · step 3 (pick an opening / start) | ⬜ | `screens/WelcomeScreen.tsx` |

### Repertoire (library)
| Item | Status | Notes |
| --- | --- | --- |
| Roots view ("Everything", As White / As Black), colour view, folder view (breadcrumb, rows, selection mode, drag and drop), rename inline | 🎨 | Cards, invitations and buttons on `CARD`/`CARD_DASHED`, rows with press feedback, colour dots without theme literals, 44 pt back/plan targets, conflicts banner in `warn-ink`. Seen roots and folder view, light/dark, three sizes. Structure untouched; a full pass (rows, sidebar, path bar) is a later batch. |
| Empty states (no lines yet, empty folder) | 🎨 | Dashed card tokens; hint text a step darker. |
| Weak spots / Study plan / Plan links, practice buttons | ⬜ | `library/practiceUi.tsx` |
| New folder sheet · Import PGN sheet · Folder settings sheet · Move to sheet · Move {n} items sheet · Conflicting moves sheet · Prompt sheet · Opening picker sheet | ⬜ | `screens/library/*Sheet.tsx` |
| Ready-made openings | ⬜ | `screens/ReadyScreen.tsx` |
| Opening library (search, Popular, results) | ⬜ | `screens/OpeningsScreen.tsx` |

### Line editor (builder)
| Item | Status | Notes |
| --- | --- | --- |
| Header (back, rename, path, Guided toggle / Ready-made badge), board, eval bar, controls | ⬜ | `screens/RepertoireScreen.tsx` |
| The line panel (move chips, forks, actions) | ⬜ | `builder/LinePanel.tsx` |
| Status chips (You play / not decided / replies prepared / Conflict), actions row | ⬜ | |
| Guide panel: Your move / Their move, tags, legend, skeleton, "Not enough data", "Opponent left book" | ⬜ | `builder/GuidePanel.tsx` |
| Pane tabs: Moves tree (empty hint) · Explorer (loading, offline, needs Lichess link, slow down, no games, error) · Engine · Stats (+ select a move) · Coach (step into a line) · Suggest (not enough data) · Notes (select a move) · Coverage | ⬜ | `panels/*`, `builder/SuggestPanel.tsx`, `builder/NotesPanel.tsx` |
| Add popular replies sheet | ⬜ | `builder/AutoBuildSheet.tsx` |
| "Line doesn't exist anymore" state | ⬜ | |

### Training
| Item | Status | Notes |
| --- | --- | --- |
| Learn (New move prompt, Moves shown walkthrough), Review (Your move / Not quite / caught up), Drill (From memory), Position quiz; progress bar | ⬜ | `screens/TrainScreen.tsx` |
| Session summary (complete, stats, "To look at again", next actions) | ⬜ | |
| Streak started / milestone celebration | ⬜ | `ui/streakViews.tsx` |

### Explore
| Item | Status | Notes |
| --- | --- | --- |
| Explore: position name, board, panes | ⬜ | `screens/ExploreScreen.tsx` |

### Games
| Item | Status | Notes |
| --- | --- | --- |
| No games yet (connect usernames, import) · Where your prep breaks · Your results per line (and its empty row) · Recent games · Opponent prep (search, loading, error) | ⬜ | `screens/GamesScreen.tsx` |

### Weak spots · Study plan · Statistics · Analysis board
| Item | Status | Notes |
| --- | --- | --- |
| Weak spots: Nothing stands out yet · Not learned yet · sections | ⬜ | `screens/FocusScreen.tsx`, `focus/WeakRow.tsx` |
| Study plan: No plan yet · Suggested from your weak spots · plan with progress and tasks · Make a plan sheet | ⬜ | `screens/PlanScreen.tsx` |
| Statistics: empty · training chart · maturity · repertoires · openings · games | ⬜ | `screens/StatsScreen.tsx`, `ui/stats.tsx` |
| Analysis board: editor, palette, To move, Castling, analyse | ⬜ | `screens/SetupScreen.tsx` |

### Settings
| Item | Status | Notes |
| --- | --- | --- |
| Account (signed out: providers; signed in) · Your level · Board & motion (theme, font, board, pieces) · Sound & touch · Reminders · Language · Your data (export, import, delete) · stepper picker sheet | ✅ | All sections on `FormSection`/`FormRow`/`Toggle`; stepper 44 px; Chess.com verified as a `Pill`; language select capped so long names don't push the row; piece animation control stacks on phones. Seen light/dark, phone/tablet/desktop (signed in). Signed-out block kept as is. |

## Outside the app
| Item | Status | Notes |
| --- | --- | --- |
| Legal pages: privacy, terms, cookies, accessibility (server-rendered HTML) | ⬜ | `apps/api/src/routes/legal.ts` — own inline CSS, light/dark. |
| Web app HTML shell and theme boot (`index.html`), PWA manifest (name, colours, shortcuts, icons) | ⬜ | `apps/web/index.html`, `vite.config.ts` |
| Web icons: favicon, apple-touch-icon, 192/512/maskable | ⬜ | `apps/web/public/` |
| iOS app icon, splash (light/dark) | ⬜ | `apps/mobile/ios/App/App/Assets.xcassets` |
| Android icon, splash (drawable-*), feature graphic | ⬜ | `apps/mobile/android/app/src/main/res`, `apps/mobile/store/android/images` |
| Store screenshots (generated by `e2e/store.spec.ts` with `STORE_SHOTS=1`) | ⬜ | Regenerate after the screens they show are ✅. |
| Store listing texts (iOS, Android) | ➖ | Copy, not visuals. |
| Emails, SMS, password reset | ➖ | None exist: sign-in is Lichess / Chess.com / Apple OAuth; no email is sent. |
| Website | ➖ | None: the app's own URL serves the app. |
| Desktop (Tauri) window chrome | ⬜ | `:root[data-macos] aside` padding for the overlay title bar. |

## Batches
1. **2026-10-09 — foundation + pilot.** Tokens, kit, theme-level polish; Today, Settings, Library (light touch); launch screen. Checks: lint 0/0, tsc clean, vitest 87/40/80, Playwright 44 passed / 85 skipped (same as baseline), i18n 902 keys complete (one new string, "Clear", in 19 languages). Harness `after`: 150 shots.

## Known open items
- Unknown URLs show react-router's default error page (see Shell).
- Lazy route chunks render nothing while loading (see Shell).
- Opening library rows on phones: the harness flags the inline move list as off-screen (the row truncates with an ellipsis). Decide on that screen's pass whether the line should wrap instead.
- `StatTile` truncates its sub-label ("7 days 100% · 30 days 100%") on phones; Ready-made line previews truncate. Wrap or shorten on their passes.
- The launch knight's tail fades (it's in the brand PNG itself, not a CSS effect); swap the asset if a flat mark is wanted.

## Up next
1. Wait for the OK on the direction (Today, Settings, Library, launch).
2. Shell: route error page and lazy-chunk skeleton; Ask AI sheet; streak views; toasts seen in place.
3. Library full pass (rows, sidebar, path bar, selection mode) and its eight sheets.
4. Line editor and its panes; Training; then the rest area by area.
5. Languages and large text through the harness (`HARNESS_LANGS`, `HARNESS_SCALES`) once a screen is ✅.
