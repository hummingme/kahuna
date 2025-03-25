#!/bin/bash

source ./scripts/settings.sh "$1"

"$ROOT"/scripts/build.sh "$TARGET"

npx onchange --await-write-finish 500 'src/**/*.js' 'src/static/*.css' \
    -- npm run build "$TARGET" | ts "%H:%M:%S" &
sleep 1
WATCH_PID=$(pgrep -nf onchange)

npx http-server "$BUILD/static" "${HTTP_SERVER_OPTIONS[@]}" >/dev/null &
sleep 1
SERVER_PID=$(pgrep -n http-server)

web-ext run "${WEBEXT_OPTIONS[@]}"

trap 'kill $WATCH_PID $SERVER_PID' SIGINT SIGTERM EXIT
