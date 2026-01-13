#!/bin/bash
# ABOUTME: Downloads and extracts Masterportal v3.3.0 runtime for bundling
# ABOUTME: Run this script to populate the runtime/ directory

set -e

VERSION="v3.3.0"
DOWNLOAD_URL="https://bitbucket.org/geowerkstatt-hamburg/masterportal/get/${VERSION}.zip"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$SCRIPT_DIR/../runtime"
TEMP_DIR="$SCRIPT_DIR/../.temp-download"

echo "Downloading Masterportal ${VERSION}..."

# Create temp directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Download the release
curl -L -o masterportal.zip "$DOWNLOAD_URL"

# Extract
unzip -q masterportal.zip

# Find the extracted folder (Bitbucket names it differently)
EXTRACTED_DIR=$(ls -d geowerkstatt-hamburg-masterportal-* 2>/dev/null | head -1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo "Error: Could not find extracted Masterportal directory"
    exit 1
fi

echo "Building Masterportal..."
cd "$EXTRACTED_DIR"
npm install
npm run build

# Copy built files to runtime directory
echo "Copying runtime files..."
mkdir -p "$RUNTIME_DIR/masterportal"
cp -r dist/mastercode/* "$RUNTIME_DIR/masterportal/"

# Cleanup
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

echo "Done! Masterportal runtime installed to: $RUNTIME_DIR/masterportal"
