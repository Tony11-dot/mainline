#!/bin/zsh
# Submits 1.0.1 (28) for review once TestFlight has processed it: retries every 4 minutes.
HERE=${0:A:h}
for i in {1..15}; do
  ~/Dev/Tools/buildlock/withlock.sh $HERE/lane.sh release > $HERE/submit.log 2>&1 && { echo "SUBMITTED" >> $HERE/submit.log; exit 0; }
  grep -q "still processing\|isn't in App Store Connect" $HERE/submit.log || { echo "FAILED" >> $HERE/submit.log; exit 1; }
  sleep 240
done
echo "GAVE-UP" >> $HERE/submit.log
