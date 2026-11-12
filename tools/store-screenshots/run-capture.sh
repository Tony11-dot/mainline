#!/bin/zsh
# One locked capture run: builds the demo app, boots the shared MainLine simulators, takes every raw shot.
export PATH=$HOME/.nvm/versions/node/v22.23.3/bin:$PATH
export IPHONE_SIM=9C299DE9-026A-46D0-9279-3E9F4C0C9AEB IPAD_SIM=8611DB5D-8FFE-4090-977E-30212EF8EAFD
HERE=${0:A:h}
~/Dev/Tools/buildlock/withlock.sh zsh -x $HERE/capture.sh "$@" > $HERE/capture.log 2>&1
echo "exit $?" >> $HERE/capture.log
