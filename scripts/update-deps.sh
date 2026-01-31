#!/bin/bash

# Exit on error
set -e

echo "Cleaning existing node_modules and lock file..."
rm -rf node_modules pnpm-lock.yaml

echo "Starting dependency update process..."

echo "Updating dependencies..."
pnpm dlx npm-check-updates -u

echo "Installing dependencies..."
pnpm install

echo "All dependencies updated successfully!"