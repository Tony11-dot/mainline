# Pack hints

One-line "why this move" hints for every move the ready-made packs train, shown in Learn/Review when a
move is missed. They are **static content**: written once, validated in code, translated into every app
language, and shipped as `apps/web/public/data/hints/<lang>.json`. Nothing is generated at run time and
no paid API is involved in the app (PLAN §2: every API must be free).

How they were made (`manifest.json` has the numbers):

1. `node scripts/hints/positions.mjs` — every trained position of every pack line, through the app's own
   import and mainline rules (`packHintTargets` in `src/lib/hints.ts`), deduplicated across packs → `work/positions.json`.
2. `node scripts/hints/facts.mjs` — a facts packet per position from `buildFacts` (packages/shared), fed by
   Lichess cloud evals and explorer statistics exactly as the coach is → `work/facts.json`. Resumable; needs the
   app's `LICHESS_FALLBACK_TOKEN` for the explorer. Positions without a cloud eval are marked `partial`.
3. A language model writes one hint per packet, allowed to use only the packet; `invalidMoves()` rejects any hint
   naming a move that is neither legal now nor in the engine lines, and numbers must come from the packet. Then the
   English is translated, keeping every `[[move]]` token (checked with `sameMoveTokens`). These two steps spend
   money and are deliberately not part of the repo: they live in the owner's sprint harness (`~/Dev/ai-sprint/mainline`,
   with hard spend caps and a ledger) and were run once in October 2026.
4. Every English hint was then graded by an Opus judge (`judge-all.mjs` in the harness: grounded in the packet, true on the board,
   useful, in voice). The ones that failed are left out of every language, with the reason in `manifest.json`
   (`droppedAfterReviewByCategory`: false on the board, beyond the packet, vague, voice).
5. `assemble.mjs` (same place) writes the per-language files and `manifest.json`.

`src/lib/hints.test.ts` checks the shipped files on every run: keys are still trained positions, translations keep
the English moves, every language is present.

When the packs change, rerun steps 1–2 here, then 3–5 in the harness; positions whose packet did not change keep
their hint. A move with no hint simply shows none.
