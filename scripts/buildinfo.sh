#!/bin/bash

source ./scripts/settings.sh "$1"

echo "export const version=$(< "$BUILD"/manifest.json jq '.["version"]');"
echo "export const timestamp=$(git log -1 --pretty=format:%ct);"
echo "export const hash='$(git rev-parse --short HEAD)';"
