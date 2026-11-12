#!/bin/zsh
# Retakes the raw simulator screenshots the App Store panels frame (raw/).
#
#   tools/store-screenshots/capture.sh              build the demo app, then shoot
#   tools/store-screenshots/capture.sh --no-build   shoot with the last build
#   python3 tools/store-screenshots/render.py       then frame them
#   RAW=<folder> keeps raw shots out of the repo; render.py --raw <folder> reads them
#
# The app is the real iOS app (Capacitor shell, native tab bar) with its web
# bundle built under VITE_STORE_DEMO=1, which compiles in apps/web/src/demo/
# storeDemo.ts: a demo player (library, training history, games, an opponent)
# with every /api/ call answered on the device — nothing reaches the server.
# A store build never has it (the flag is fixed at build time).
#
# Each shot writes the scene's name to the app's Documents/store-demo/scene.txt,
# launches the app and waits for ready.txt beside it (the scenes are SCENES in
# storeDemo.ts). The app is reinstalled first, so every run starts from the
# same seeded player.
#
# Simulators: IPHONE_SIM / IPAD_SIM (UDIDs), else the first available
# "iPhone 17 Pro Max" and "iPad Pro 13-inch (M5)". DERIVED_DATA overrides the
# build folder. Needs Node 22 and pnpm.
set -eu

HERE=${0:A:h}
REPO=${HERE:h:h}
RAW=${RAW:-$HERE/raw}
DD=${DERIVED_DATA:-$HERE/.build}
APP=$DD/Build/Products/Debug-iphonesimulator/App.app
BUNDLE=app.mainline.chess

udid() {
  xcrun simctl list devices available -j | python3 -c '
import json, sys
name = sys.argv[1]
for runtime, devices in json.load(sys.stdin)["devices"].items():
    for device in devices:
        if device["name"] == name:
            print(device["udid"]); sys.exit()
sys.exit("No simulator named " + name)' "$1"
}
IPHONE=${IPHONE_SIM:-$(udid "iPhone 17 Pro Max")}
IPAD=${IPAD_SIM:-$(udid "iPad Pro 13-inch (M5)")}

prepare() {
  local sim=$1
  xcrun simctl boot $sim 2>/dev/null || true
  xcrun simctl bootstatus $sim -b >/dev/null
  xcrun simctl ui $sim appearance light
  xcrun simctl status_bar $sim override --time 9:41 --batteryState charged --batteryLevel 100 \
    --wifiBars 3 --cellularBars 4 --dataNetwork wifi
}

# iPadOS 26 draws a window-resize grabber in the bottom corner of every app
# while windowed multitasking is on; switching it off removes the grabber.
# Needs a reboot of that simulator, done once.
if [ "$(xcrun simctl spawn $IPAD defaults read com.apple.springboard SBMedusaMultitaskingEnabled 2>/dev/null || true)" != "0" ]; then
  xcrun simctl boot $IPAD 2>/dev/null || true
  xcrun simctl spawn $IPAD defaults write com.apple.springboard SBMedusaMultitaskingEnabled -bool NO
  xcrun simctl shutdown $IPAD
fi
prepare $IPHONE
prepare $IPAD

if [ "${1:-}" != "--no-build" ]; then
  (cd $REPO && VITE_STORE_DEMO=1 pnpm --filter @mainline/web build >/dev/null)
  (cd $REPO/apps/mobile && pnpm exec cap sync ios >/dev/null)
  xcodebuild build -project $REPO/apps/mobile/ios/App/App.xcodeproj -scheme App -configuration Debug \
    -destination "id=$IPHONE" -derivedDataPath $DD CODE_SIGNING_ALLOWED=NO -quiet
  # Put the store bundle back in the native project, so nothing demo is left lying around.
  (cd $REPO && pnpm --filter @mainline/web build >/dev/null && cd apps/mobile && pnpm exec cap copy ios >/dev/null)
fi

for sim in $IPHONE $IPAD; do
  xcrun simctl uninstall $sim $BUNDLE 2>/dev/null || true
  xcrun simctl install $sim $APP
done

mkdir -p $RAW
# shot <sim> <name> <scene>
shot() {
  local sim=$1 name=$2 scene=$3
  local data=$(xcrun simctl get_app_container $sim $BUNDLE data)
  mkdir -p "$data/Documents/store-demo"
  rm -f "$data/Documents/store-demo/ready.txt"
  print -n "$scene" > "$data/Documents/store-demo/scene.txt"
  xcrun simctl launch --terminate-running-process $sim $BUNDLE >/dev/null
  for i in {1..120}; do
    if [ -f "$data/Documents/store-demo/ready.txt" ]; then
      grep -q ERROR "$data/Documents/store-demo/ready.txt" && { echo "$name: $(cat "$data/Documents/store-demo/ready.txt")"; return 0; }
      sleep 0.5
      xcrun simctl io $sim screenshot $RAW/$name.png >/dev/null 2>&1
      echo "raw/$name.png"
      return 0
    fi
    sleep 1
  done
  echo "$name: the scene never said it was ready"; return 0
}

# Same story on both devices (panels.js): opponent, games, build, weak spots, guide, memory, coach, today.
# The phone's line-editor scenes show a smaller board with the move list / numbers under it (storeDemo.ts).
for scene in opponent games build focus guide stats coach today; do shot $IPHONE p-$scene $scene; done
for scene in opponent games build focus guide stats coach today; do shot $IPAD t-$scene $scene; shot $IPAD z-$scene z-$scene; done

echo "Look at every raw shot before rendering: the simulator can catch a screen mid-animation."
