#!/bin/bash

source ./scripts/settings.sh "$1" release

if npm run build "$TARGET" release 
then
    RELEASE_FILE="$ROOT/build/$TARGET".zip
    rm -f "$RELEASE_FILE"
    cd "$BUILD" || { echo "failed to change to $BUILD"; exit 1; }
    /usr/bin/zip "$RELEASE_FILE" \
        ./*.js manifest.json \
        icons/* \
        static/kahuna.css static/icons.svg
fi;
