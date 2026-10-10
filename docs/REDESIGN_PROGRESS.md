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

## Direction (chosen 2026-10-10): bolder

A tinted page (`--bg`, a cool near-white in light, a deep slate in dark) with borderless white cards lifted by one soft shadow (`--shadow-card`); big, tight page titles (`text-3xl`/`text-4xl`, −0.025 em) and section headers that are real headings; a filled primary button and a tonal secondary (`bg-brand-soft text-brand-ink`) instead of outlined ones; the readable `*-ink` tones for any coloured text on a tint; 44 pt targets throughout; text that wraps instead of truncating. Radii stepped up (`--radius-m` 16, `--radius-l` 24, `--radius-xl` 32) and the section rhythm opened (`--section-gap` 36).

## Preview harness (local, excluded from git)

`apps/web/harness/` — Playwright renders the real screens with demo data (three repertoires, a 12-day streak, imported games, a signed-in player) to `harness/out/<run>/<scheme>/<lang>-x<scale>/<screen>-<viewport>.png`. Phone (iPhone 15, WebKit), tablet (820×1180) and desktop (1280×800); light and dark; any of the 19 languages (`HARNESS_LANGS`, RTL included); large text ×1.3 and ×2 (`HARNESS_SCALES`). Every shot records sideways scroll, off-screen elements, clipped text and ellipsis truncation; `HARNESS_STRICT=1` makes those fail the run. `node harness/report.mjs <run>` summarises.

Run: `cd apps/web && pnpm build && HARNESS_RUN=after caffeinate -i pnpm exec playwright test -c harness/harness.config.ts screens` (`caffeinate` because a 20-language run outlives the display sleep). `measure-launch.spec.ts` renders the launch animation's final frame at canvas size so its visual centre can be measured (PIL bounding box of non-background pixels).

The seed drives the real Import PGN sheet, so it has to find the "New" and "Import" buttons by their label in the current language: it matches all 19 translations (an earlier run silently rendered only the fresh screens in 13 languages because it knew six labels). It also waits for the app to create its IndexedDB stores before writing the streak.

Runs so far: `before` (main @ 757449e: 138 shots), `after` (batch 1: 150 shots), `bold2` (batch 2, en light+dark, every screen: 198 shots, 0 layout failures), `scale` (en + de at ×1.3 and ×2: 594 shots; the only flags were the harness's own case-sensitive button match, fixed), `langs2` (batch 2, all 19 non-English languages, light: see batch 2).

## Foundation

| Item | Status | Notes |
| --- | --- | --- |
| Design tokens: spacing scale, radii, elevation, motion durations, semantic colours | ✅ | `styles.css`: `--space-1…12`, `--page-x`, `--section-gap`, `--stack-gap`, `--card-pad`; `--dur-fast/base/slow`, `--ease-out-expo`; `--radius-xs…xl`, `--radius-control`; `--shadow-card`; `--brand-soft-2` (pressed tonal); readable inks on tints (`--good-ink`, `--warn-ink`, `--bad-ink`, ≥ 4.5:1 in both schemes), `--gem*` (the guide's violet), `--toast-*`. Tinted page `--bg` with `--surface-2/3` a step apart in both schemes; `h1` tracking −0.025 em. |
| Theme switching, dark mode, 19 user themes, fonts, board colours keep working | ✅ | `lib/appearance.ts` `MAINLINE_LIGHT`/`MAINLINE_DARK` carry the new page, raised and paper colours; every user theme derives `--surface-2` from its own paper/raised mix; the system swatch in Appearance previews both. Appearance e2e passes. |
| No hard-coded colours inside screens | 🎨 | Everything textual is on tokens (Guide tags, Weak rows, Games, Train, Welcome moved to `*-ink`). Still literal: Appearance swatches (previews of other themes — intentional), Explorer/Engine/EvalBar bars (data colours), PromotionPicker, Launch fallbacks. |
| Shared components: Card, SectionHeader, ListRow (icon tile), Pill/Badge, EmptyState, FormSection, PickerRow, SearchField, press feedback | ✅ | `ui/kit.tsx` rewritten for the bolder direction: `CARD` = borderless surface + `shadow-card`; `SectionHeader` is a real `text-lg` heading; `PageHeader large` wraps instead of truncating; 64 px `ListRow`, 60 px `FormRow`/`PickerRow`; `SearchField` h-12 on a card shadow; `IconTile` sm/md/lg; `Pill` md. Used by every screen now. |
| Theme-level polish: cards, sheets, dialogs, toasts, chips, tabs, inputs, buttons | ✅ | `Button` secondary is tonal; sizes sm/md/lg on radius tokens; `PanelNote` roomier with a brand-soft icon tile; `Segmented` tabs wrap their label on narrow phones instead of overflowing (German "Vorbereitung zu Ende"); `Sheet` ps-6 header, `text-xl` title, focus starts on the title (no ring on the close button) unless a field is marked `data-autofocus`; `inputCls` h-12. |
| Type on the token scale (no `text-[Npx]`) | 🎨 | `--text-4xl` added (2.75 rem). Remaining: tab bar labels (10.5/11 px — shell, left alone), stats chart ticks. |

## Inside the app

### Shell
| Item | Status | Notes |
| --- | --- | --- |
| App shell: sidebar rail (md) / full sidebar (lg), tab bar + Ask AI circle (phones), native iOS bar | ➖ | Main navigation stays exactly as it is. |
| Launch screen | ✅ | Plain theme background, no ambient wash; artwork centred at build time (`scripts/brand.mjs` `centerArtwork`). Background now the new page colour (`#F2F4F9` / `#121419`) in `index.html`, the manifest, `LaunchScreen.tsx`, Capacitor config and the native splash. |
| Toasts (text, kinds, action/undo) | 🎨 | `ui/toast.tsx` on `--toast-*` tokens. |
| Context menu (right-click / long-press) | 🎨 | radius tokens, 40 px items, danger in `bad-ink`. |
| Menu (New…) | 🎨 | radius tokens, 44 px items. |
| Sheet (bottom sheet / centred dialog), Field, inputs | ✅ | 44 pt close target, wrapping footer, inputs on tokens; header/body/footer paddings aligned at 24 px; focus handling above. |
| Ask AI sheet (conversation, composer, empty state) | ✅ | `ui/Assistant.tsx`: tonal starter chips, radius-m bubbles, h-12 composer, `text-base` intro. Seen en, fa (RTL). |
| Streak badge, streak sheet (last 7 days, milestone bar), celebration dialog | ✅ | `ui/streakViews.tsx`: week card on `shadow-card`, day chips in `good-ink`, tight big number, tonal reminders link (48 px). |
| Board controls, eval bar, promotion picker | 🎨 | `board/MoveInput.tsx` radii on tokens; the board itself untouched. |
| Route loading (lazy chunks) | ✅ | `ui/RouteStates.tsx` `RouteLoading`: quiet skeleton page, `aria-busy`, "Loading…". Wired as `hydrateFallbackElement` in `App.tsx`. |
| Unknown URL / route error | ✅ | `RouteError`: 404 → compass, "Page not found", "There’s nothing at this address."; any other error → "Something went wrong", "Reload the app and try again. Your repertoire and training are saved.", Reload; both offer "Back to Today". `errorElement` on the shell and on the routes, catch-all `*` route. Strings in 19 languages. |

### Today
| Item | Status | Notes |
| --- | --- | --- |
| Today with repertoires: primary action card, "All caught up", streak-at-risk banner, progress (goal ring, learned, retention), Practice list, Tools list | ✅ | Hero on `radius-l` with `text-2xl/3xl` title; progress ring 40/44 px; stat labels wrap with hyphenation (it "Obiettivo giornaliero" used to run into the next column; "Retention" in it/pl/uk/vi truncated); `ListGroup` rows 64 px with wrapping sub-text. Seen light/dark × phone/tablet/desktop, ar (RTL), it/pl/uk/vi. |
| Today, first run: "Start your first repertoire" card | ✅ | `p-6 md:p-8`, `text-2xl` title, tonal "Build from scratch". |
| Study plan card / Work on this card | ✅ | `focus/HomePlanCard.tsx` on `Card`/`Pill`; plan link with a brand-soft calendar tile; "Work on this" as a `bad` pill; h-11 tonal/primary/ghost actions. |
| Weak spot card (from imported games) | ✅ | `library/WeakSpotCard.tsx`: `bad-soft` card, stronger `bad` pill, `text-xl` heading, h-11 buttons. |

### Onboarding
| Item | Status | Notes |
| --- | --- | --- |
| Welcome step 1 (intro) · step 2 (rating, "I mostly play") · step 3 (pick an opening / start) | ✅ | `text-4xl` intro title; level rows on `shadow-card`, selected = `brand-softer` + 2 px brand ring + filled check; speed chips h-11; pack cards `radius-l`. Seen all three steps, phone/tablet/desktop. |

### Repertoire (library)
| Item | Status | Notes |
| --- | --- | --- |
| Roots view ("Everything", As White / As Black), colour view, folder view (breadcrumb, rows, selection mode, drag and drop), rename inline | ✅ | Finder rows 64 px with `text-md` names and `text-sm` sub-lines in `ink-2`, ⋯ 36 px; selection bar on `shadow-3` with tonal/filled h-10 actions; sidebar `text-xl` title, h-9 rows; `text-3xl/4xl` title; the header wraps on phones when the "New" label is long (fr "Nouveau", ko "새로 만들기") instead of pushing the button off-screen; invitations/conflicts `text-base`; colour sections `text-xl` headings; add-first-move 56 px; folder action tiles 60 px. Seen roots and folder, light/dark, three sizes, ar/fr/ko. |
| Empty states (no lines yet, empty folder) | ✅ | Dashed card tokens, `text-md`. |
| Weak spots / Study plan / Plan links, practice buttons | ✅ | `library/practiceUi.tsx`: Show me tonal, Test me filled, `pressable`; `RecordBadge` is a `Pill`. |
| New folder sheet · Import PGN sheet · Folder settings sheet · Move to sheet · Move {n} items sheet · Conflicting moves sheet · Prompt sheet · Opening picker sheet | ✅ | All on the new `Sheet`/`inputCls`; opening picker list no longer a nested card (60 px rows); prompt sheet focuses its field. Seen New folder, Import PGN, Make a plan, Auto-build on phone/tablet/desktop. |
| Ready-made openings | ✅ | `PageHeader large` with back; `section-gap` sections, `text-xl` headings; pack card p-4; line previews wrap (`overflow-wrap: anywhere`) instead of truncating. |
| Opening library (search, Popular, results) | ✅ | `PageHeader` + `SearchField`; result rows clamp to two lines; preview p-5 with primary buttons and a 44 px explore link; the skeleton shows only while the opening database loads (it used to spin forever when explorer data was unavailable). |

### Line editor (builder)
| Item | Status | Notes |
| --- | --- | --- |
| Header (back, rename, path, Guided toggle / Ready-made badge), board, eval bar, controls | ✅ | 52 px header, 44 px back, `text-lg` title, `text-sm` path; Guided toggle h-10 tonal/filled; wide aside and phone pane wrapper on `CARD`. |
| The line panel (move chips, forks, actions) | ✅ | `builder/LinePanel.tsx`: `text-lg` heading, `text-base` 36 px chips on `radius-xs`, delete in `bad-ink`; the move list stays left-to-right in RTL languages (it read "e4.1" in Arabic). |
| Status chips (You play / not decided / replies prepared / Conflict), actions row | ✅ | `Pill size="md"`; the local `Chip` removed. |
| Guide panel: Your move / Their move, tags, legend, skeleton, "Not enough data", "Opponent left book" | ✅ | Tags on `*-ink`/`gem` tokens, 44 px help button, `px-4 py-3` rows with `text-lg` SAN, `text-lg` header, `text-sm` legend/hints. Seen en light/dark, ar. |
| Pane tabs: Moves tree (empty hint) · Explorer (loading, offline, needs Lichess link, slow down, no games, error) · Engine · Stats (+ select a move) · Coach (step into a line) · Suggest (not enough data) · Notes (select a move) · Coverage | ✅ | `PaneTabs` h-10 (inactive on `shadow-card`); MoveTree `text-md` with `tn()` plurals for collapsed variations; Explorer `text-base` table, `radius-xs` WDL bar, 40 px top-games rows; Engine 51×31 toggle, `text-2xl` eval; Coach tabs h-10 with its source line translated; Insights/Move stats/Repertoire stats/Notes/Suggest on the kit. |
| Add popular replies sheet | ✅ | `builder/AutoBuildSheet.tsx`; its explanatory sentence is now one translatable string with the rating inline (`tx`). |
| "Line doesn't exist anymore" state | ✅ | `EmptyState icon={Waypoints}`. |

### Training
| Item | Status | Notes |
| --- | --- | --- |
| Learn (New move prompt, Moves shown walkthrough), Review (Your move / Not quite / caught up), Drill (From memory), Position quiz; progress bar | ✅ | `TrainScreen.tsx`: h-2.5 bar with `text-base` counter; `text-3xl` prompt in `bad-ink`/`good-ink` tones; note card on `shadow-card`. Seen learn, quiz, review-empty; ar. |
| Session summary (complete, stats, "To look at again", next actions) | ✅ | Good-circle icon, `text-3xl` title, 3-up divided stats (`text-2xl`), mistakes rows with 44 px Why?/Explore, Again/Done as two `lg` buttons; empty session on `EmptyState`. |
| Streak started / milestone celebration | ✅ | `ui/streakViews.tsx` (see Shell). |

### Explore
| Item | Status | Notes |
| --- | --- | --- |
| Explore: position name, board, panes | ✅ | 52 px header, ECO on `brand-soft`/`brand-ink`, `text-lg` title clamped to two lines (ru/uk "Starting position" truncated), "Set up" as a tonal pill, phone pane wrapper card. |

### Games
| Item | Status | Notes |
| --- | --- | --- |
| No games yet (connect usernames, import) · Where your prep breaks · Your results per line (and its empty row) · Recent games · Opponent prep (search, loading, error) | ✅ | `PageHeader large` with a tonal Statistics pill; dashed `EmptyState`; `radius-l` result tiles in `*-ink`; `SectionHeader`s; result rows wrap; accounts card p-5 with h-12 buttons; recent-game rows put the pill under the opponent line on phones and wrap long names; 44 px open-game link; Opponent prep as a card with a brand-soft target tile; errors `role="alert"` in `bad-ink`. The results filter tabs wrap on narrow phones (de). Seen en light/dark, de, ar. |

### Weak spots · Study plan · Statistics · Analysis board
| Item | Status | Notes |
| --- | --- | --- |
| Weak spots: Nothing stands out yet · Not learned yet · sections | ✅ | `FocusScreen.tsx`: `PageHeader large`, colour cards p-5, `EmptyState`, `SectionHeader`, `IconTile`; `focus/WeakRow.tsx`: severity as a `Pill` tone (desktop beside the row, phone in the action row), icon in a brand-soft tile, h-9 tonal/filled/ghost actions, move labels left-to-right. |
| Study plan: No plan yet · Suggested from your weak spots · plan with progress and tasks · Make a plan sheet | ✅ | `PlanScreen.tsx`: `PageHeader large` with the action trailing; dashed `EmptyState`; plan card p-5 `text-2xl`; day cards on `shadow-card`, today with a 2 px brand ring; 44 px task checkboxes, h-10 Start, 40 px remove in `bad-ink`; day numbers in the locale's digits. |
| Statistics: empty · training chart · maturity · repertoires · openings · games | ✅ | `ui/stats.tsx`: `StatTile` `radius-l` with wrapping sub-labels, `StatGrid gap-3`, `StatSection` on `section-gap`, chart p-5; `StatsScreen.tsx`: `PageHeader large`, weak spots as `ListRow`, rep cards p-5, "{wrong} of {total} wrong" and "No games as White/Black yet." translated. Seen en light/dark, ar. |
| Analysis board: editor, palette, To move, Castling, analyse | ✅ | `SetupScreen.tsx`: 52 px header, tonal Explore link, round castling chips (filled/tonal, focus ring), `text-md` headings, h-12 FEN input, primary Analyse. |

### Settings
| Item | Status | Notes |
| --- | --- | --- |
| Account (signed out: providers; signed in) · Your level · Board & motion (theme, font, board, pieces) · Sound & touch · Reminders · Language · Your data (export, import, delete) · stepper picker sheet | ✅ | `PageHeader large`; rows 64/56 px on `px-5`; speed chips h-10; language select h-11; stepper track on `surface-3`; Appearance pickers p-5/p-4; Reminders rows `py-4`, time input h-11; legal footer `mt-8`. Seen light/dark, phone/tablet/desktop, he (RTL). |

## Outside the app
| Item | Status | Notes |
| --- | --- | --- |
| Legal pages: privacy, terms, cookies, accessibility (server-rendered HTML) | ✅ | `apps/api/src/routes/legal.ts`: theme-color metas, tinted page with the article on a white `radius-24` card, 34 px −0.025 em title, brand link home, tables scroll sideways, logical padding (RTL safe), light/dark. |
| Web app HTML shell and theme boot (`index.html`), PWA manifest (name, colours, shortcuts, icons) | ✅ | theme-color and manifest `background_color`/`theme_color` = `#F2F4F9`. |
| Web icons: favicon, apple-touch-icon, 192/512/maskable | ➖ | Brand artwork, derived from `brand/app-icon.png` by `scripts/brand.mjs`; unchanged on purpose. |
| iOS app icon, splash (light/dark) | ✅ | Splash regenerated with the new page colours (`scripts/brand.mjs` `BG_LIGHT`/`BG_DARK` → `apps/mobile/assets/splash*.png` → `capacitor-assets generate`); corners verified `#f2f4f9` / `#121419`. Icon unchanged (byte-identical after regeneration). |
| Android icon, splash (drawable-*), feature graphic | ✅ | Same regeneration (all `drawable-*` splash densities, light and night); adaptive icon and feature graphic unchanged. |
| Store screenshots (generated by `e2e/store.spec.ts` with `STORE_SHOTS=1`) | ✅ | Regenerated from the redesigned app (iPhone, iPad, Android × 5) with `--workers=1` — three devices seeding IndexedDB at once races the app's schema upgrade. |
| Store listing texts (iOS, Android) | ➖ | Copy, not visuals. |
| Emails, SMS, password reset | ➖ | None exist: sign-in is Lichess / Chess.com / Apple OAuth; no email is sent. |
| Website | ➖ | None: the app's own URL serves the app. |
| Desktop (Tauri) window chrome | ➖ | The only desktop-specific rule pads the sidebar under the overlay title bar (`:root[data-macos] aside`); the sidebar is main navigation and stays as it is. |

## Text found on the way
Untranslated or hand-built strings, now through `t`/`tn`/`tx` with translations in all 19 languages: the route error and loading pages; the coach's source line ("From the engine and game statistics", the resting notice, the grounded label); Statistics "{wrong} of {total} wrong" and "No games as White/Black yet."; the Auto-build explanation with the rating inline; MoveTree's collapsed "{n} variations" (plural categories per language); Plan day numbers in locale digits. `i18n --check`: 916 strings (64 plural), every language complete.

## Batches
1. **2026-10-09 — foundation + pilot.** Tokens, kit, theme-level polish; Today, Settings, Library (light touch); launch screen. Checks: lint 0/0, tsc clean, vitest 87/40/80, Playwright 44 passed / 85 skipped (same as baseline), i18n 902 keys complete (one new string, "Clear", in 19 languages). Harness `after`: 150 shots.
2. **2026-10-10 — bolder, everywhere.** The direction above applied to every screen, panel and sheet; route error/loading pages; legal pages; splash and manifest colours. Fixes the harness surfaced: large page titles and Games opponent rows wrap instead of truncating; Openings preview no longer shows an endless skeleton; the Repertoire header wraps under long "New" labels (fr, ko); Segmented tabs wrap (de); the line panel's moves stay LTR in RTL; sheets no longer open with a focus ring on the close button. Checks: `pnpm lint` 0/0, tsc clean (shared, api, web), vitest 87/40/80, i18n 916 complete, Playwright 44 passed / 85 skipped (= baseline), store screenshots regenerated. Harness: `bold2` 198 shots / 0 layout failures (en, light+dark, every screen); `scale` 594 shots (en + de at ×1.3/×2) / 0 app failures; `langs2` 1,881 shots in 19 languages (phone, tablet, desktop) / 0 layout failures in the app — the 60 flagged shots were the harness not knowing five languages' "New" labels, four languages' "Add popular replies" and the Turkish "içe aktar" (regexes extended; `fix3` re-rendered those screens plus the ones below in 14 languages: 420 shots, 0 truncations, 2 harness flakes where the Auto-build sheet did not open within the click timeout in ar/uk — both rendered fine in `langs2`). What the pictures showed, now fixed: the Today stat strip's labels overlapped (it "Obiettivo giornaliero" was `nowrap`) and long one-word stat labels truncated (it/pl/uk/vi "Retention", nl "Accuracy" in the Statistics repertoire cards) — stat labels now wrap with hyphenation (`hyphens-auto break-words`) in Today, Statistics and the repertoire stats panel; the Explore title clamps to two lines instead of truncating (ru/uk "Starting position"); Italian "Retention" is now "Ritenzione" (the spaced-repetition term, and it fits).

## Known open items
- Literal data colours remain in the Explorer/Engine bars, the eval bar and the promotion picker; the Appearance swatches preview other themes on purpose.
- Tab bar labels are 10.5/11 px (shell, left alone by the brief).
- The launch knight's tail fades (it's in the brand PNG itself, not a CSS effect); swap the asset if a flat mark is wanted.
- Pane tabs in the line editor scroll sideways on phones (eight tabs; same as before the redesign).
- The Statistics daily chart's axis runs right-to-left in RTL languages (today at the left), consistent with the page but worth a look on a device.

## Up next
1. Batch 2 on the phones (TestFlight, Play internal): check Today's stat strip, the line editor in Arabic, and a sheet opening (no focus ring) on a device.
2. Dark-mode pass through the harness in a second language (ar) and large text (×2) on the redesigned sheets.
3. Known open items below, if wanted: data colours in the Explorer/Engine bars, the RTL direction of the Statistics chart axis.
