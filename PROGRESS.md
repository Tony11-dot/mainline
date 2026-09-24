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
