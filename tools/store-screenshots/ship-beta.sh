#!/bin/zsh
# Tests, then the TestFlight upload of 1.0.1 (28), all inside the build lock.
export PATH=$HOME/.nvm/versions/node/v22.23.3/bin:$PATH
HERE=${0:A:h}
cd $HERE/../.. && { pnpm -r test > $HERE/test.log 2>&1 || { tail -30 $HERE/test.log; echo TESTS-FAILED; exit 1; }; tail -6 $HERE/test.log; }
$HERE/lane.sh beta
