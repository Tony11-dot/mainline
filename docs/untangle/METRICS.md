# Untangle metrics

Produced by `docs/untangle/metrics.sh` (raw output: `before.txt`, `after.txt`). "Special cases" are counted by the skill's list.

| | before (79a4fb7) | after |
| --- | --- | --- |
| files (ts/tsx, incl. tests) | 169 | 177 |
| code lines (non-blank, non-comment) | 20,021 | 20,026 |
| comment lines | 1,362 | 1,377 (new module docs; 12 restating lines removed) |
| largest file | LibraryScreen.tsx 1,062 | packs.ts 778 |
| module-level mutable state / caches | 38 | 34 |
| swallowed errors (`catch {}`, `.catch(()=>…)`) | 123 | 101 |
| setTimeout / sleep / retry | 71 | 71 |
| eslint-disable / ts-ignore / `as any` | 35 | 35 |
| skipped tests | 1 | 1 (needs a real DB) |
| lint errors | 1 | 0 |
| tests (shared / web / api) | 91 / 80 / 42 = 213 | 91 / 88 / 43 = 222 |
| copies of: UCI regex / castling map / first-move table / line formatter / day helper / storage adapter | 4 / 2 / 4 / 6 / 5 / 6 | 1 / 1 / 1 / 1 / 1 / 1 |
