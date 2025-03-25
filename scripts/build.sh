#!/bin/bash

source ./scripts/settings.sh "$1" "$2"

BUNDLES=("kahuna.js" "contentscript.js" "contentscript_worker.js") 
if [ "$TARGET" = "firefox" ]; then
    BUNDLES+=("background.js")
elif [ "$TARGET" = "chromium" ]; then
    BUNDLES+=("background_worker.js")
fi;

echo "building $TARGET into $BUILD"

mkdir -p "$BUILD"
rm -r "${BUILD:?}/"*
cp "$SOURCE"/manifest.json."$TARGET" "$BUILD"/manifest.json

mkdir -p "$BUILD"/icons
cp "$SOURCE"/icons/* "$BUILD"/icons/

mkdir -p "$BUILD"/static
find "$SOURCE"/static -maxdepth 1 -type f -exec cp '{}' "$BUILD"/static \;

"$ROOT"/scripts/buildinfo.sh "$TARGET" > "$BUILD"/buildinfo.js

for BUNDLE in "${BUNDLES[@]}"; do
    esbuild "$SOURCE/$BUNDLE" "${ESBUILD_PARAMS[@]}" --outfile="$BUILD/$BUNDLE"
done

