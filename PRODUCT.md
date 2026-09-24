# Mainline — product context

register: product
platform: adaptive (web + PWA primary; iOS via Capacitor with native glass tab bar; Android via Capacitor; desktop via Tauri)

## Who & where
A club player (1200–2200) drilling their opening repertoire. Scene: evening on the couch or a commute, phone in one hand, 5–15 minutes, often in dim light; or at a desk on a laptop building a repertoire for an hour with the explorer open. Both light and dark matter; light is the hero look (Apple-premium, blue & white), dark is first-class for night training.

## What it is
A tool, not a marketing site. The board is the hero on every screen; everything else (explorer, engine, stats, AI coach) is secondary and collapsible. Users are in flow: every tap should do the same thing every time.

## Voice
Calm, precise, coach-like. Short, specific copy ("3 cards due · ~2 min"), never cheerleading. Chess notation is data: tabular numerals, SAN in the UI font.

## Visual system
- One brand blue behind a single `--brand` token (placeholder #1E5EFF until the owner supplies theirs). Restrained color strategy: cool neutrals tinted toward the brand hue, brand for primary actions / selection / state only.
- Semantic colors: success (green, correct move), danger (red, wrong move), warning (amber, eval swing / conflicts). W/D/L bars use white/grey/black chess convention.
- System font stack (SF Pro on Apple, Inter elsewhere), fixed rem scale ratio ~1.2, 8-pt grid.
- Glass only on navigation chrome (tab bar, top bar, sheets) — never decorative cards. Solid fallback under Reduce Transparency.
- Motion 150–250 ms, exponential ease-out; pieces glide 200 ms; reduced-motion honored.
- Icons: Lucide on web/Android/desktop; SF Symbols in native iOS chrome.

## Anti-references
Generic SaaS dashboards, hero-metric tiles, card grids, gamified confetti UIs, the brown-wood chess-app cliché (board uses a cool blue-grey theme by default, classic brown available).
