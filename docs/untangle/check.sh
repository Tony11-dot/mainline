#!/bin/sh
# typecheck + lint + tests, printing only the verdicts
export PATH=~/.nvm/versions/node/v22.23.3/bin:$PATH
pnpm typecheck 2>&1 | grep -E "error TS" ; pnpm lint 2>&1 | grep -E "error|✖"; pnpm test 2>&1 | grep -E "Tests  |FAIL"
