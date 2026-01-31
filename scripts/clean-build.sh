#!/bin/bash

set -e

echo "Clearing caches..."

rm -rf dist
rm -rf node_modules/.vite
rm -rf node_modules/.cache
rm -rf .turbo

find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

echo "Building..."
pnpm build

echo "Clean build complete!"