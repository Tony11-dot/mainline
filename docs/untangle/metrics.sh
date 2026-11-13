#!/bin/sh
# Prints the numbers recorded in METRICS.md. Run from the repo root.
F=$(git ls-files | grep -E '\.(ts|tsx)$' | grep -v -E '(^|/)(e2e|scripts)/|\.d\.ts$')
SRC=$(echo "$F" | grep -v -E '\.(test|spec)\.')
echo "source files: $(echo "$SRC" | wc -l)"
echo "code lines (non-blank, non-comment): $(cat $SRC | grep -v -E '^\s*$|^\s*(//|/\*|\*)' | wc -l)"
echo "comment lines: $(cat $SRC | grep -E '^\s*(//|/\*|\*)' | wc -l)"
echo "largest: $(echo "$SRC" | xargs wc -l | grep -v total | sort -rn | head -1)"
echo "module-level let/Map/Set/cache: $(cat $SRC | grep -E '^(export )?(let |const [a-zA-Z_]+ = new (Map|Set|WeakMap|LRU)|const [a-zA-Z_]+: (Map|Set)<)' | wc -l)"
echo "catch swallowed (catch {} / .catch(()=>)): $(cat $SRC | grep -E 'catch \{|catch \(_?e?\) \{\s*\}|\.catch\(\(\) =>' | wc -l)"
echo "setTimeout/sleep/retry: $(cat $SRC | grep -E 'setTimeout|sleep\(|retry|retries' | wc -l)"
echo "eslint-disable/ts-ignore/@ts-expect/as any: $(cat $SRC | grep -E 'eslint-disable|@ts-ignore|@ts-expect-error|as any|as unknown as' | wc -l)"
echo "skipped tests: $(echo "$F" | grep -E '\.(test|spec)\.' | xargs grep -E '\.(skip|todo|fixme)|test\.fail' | wc -l)"
echo "tests: $(echo "$F" | grep -E '\.(test|spec)\.' | xargs grep -E '^\s*(it|test)(\.each)?\(' | wc -l) (declared)"
