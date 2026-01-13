#!/bin/bash
# ABOUTME: Downloads pre-built Masterportal runtime from official website
# ABOUTME: Run this script to populate the runtime/ directory

set -e

VERSION="3.10.0"
DOWNLOAD_URL="https://www.masterportal.org/fileadmin/content/downloads/examples-${VERSION}.zip"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$SCRIPT_DIR/../runtime"
TEMP_DIR="$SCRIPT_DIR/../.temp-download"

echo "Downloading Masterportal examples ${VERSION}..."

# Create temp directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Download the pre-built examples
curl -L -o examples.zip "$DOWNLOAD_URL"

# Extract
unzip -q examples.zip

# Find the mastercode folder
if [ ! -d "mastercode" ]; then
    echo "Error: Could not find mastercode directory in examples"
    exit 1
fi

# Copy the entire mastercode directory (preserving version folder structure)
echo "Copying runtime files..."
rm -rf "$RUNTIME_DIR/mastercode"
cp -r mastercode "$RUNTIME_DIR/"

# Cleanup
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

echo "Done! Masterportal runtime installed to: $RUNTIME_DIR/mastercode"
echo "Contents:"
ls -la "$RUNTIME_DIR/mastercode/"
