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

# Find the version folder inside mastercode
MASTERCODE_VERSION=$(ls -d mastercode/*/ 2>/dev/null | head -1)

if [ -z "$MASTERCODE_VERSION" ]; then
    echo "Error: Could not find version folder in mastercode"
    exit 1
fi

# Copy built files to runtime directory
echo "Copying runtime files..."
mkdir -p "$RUNTIME_DIR/masterportal"
cp -r "$MASTERCODE_VERSION"* "$RUNTIME_DIR/masterportal/"

# Cleanup
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

echo "Done! Masterportal runtime installed to: $RUNTIME_DIR/masterportal"
echo "Contents:"
ls -la "$RUNTIME_DIR/masterportal/"
