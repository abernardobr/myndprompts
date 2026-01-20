#!/bin/bash

# MyndPrompt macOS Signed Build Script
# Builds a signed and notarized macOS application
#
# Usage:
#   ./scripts/build-mac-signed.sh
#
# Before running, set these environment variables:
#   export APPLE_ID="your-apple-id@email.com"
#   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
#   export APPLE_TEAM_ID="CD298B4H7M"
#
# Or create a .env.signing file in the project root with:
#   APPLE_ID=your-apple-id@email.com
#   APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
#   APPLE_TEAM_ID=CD298B4H7M

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_OUTPUT="$PROJECT_ROOT/dist/Builds"
MAC_OUTPUT="$BUILD_OUTPUT/mac"
PACKAGED_DIR="$PROJECT_ROOT/dist/electron/Packaged"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   MyndPrompt macOS Signed Build       ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

cd "$PROJECT_ROOT"

# Load .env.signing if it exists
if [ -f "$PROJECT_ROOT/.env.signing" ]; then
    echo -e "${BLUE}Loading signing configuration from .env.signing...${NC}"
    set -a
    source "$PROJECT_ROOT/.env.signing"
    set +a
fi

# Verify signing configuration
echo -e "${BLUE}Checking code signing configuration...${NC}"
echo ""

SIGNING_READY=true

if [ -z "$APPLE_ID" ]; then
    echo -e "${RED}✗ APPLE_ID not set${NC}"
    SIGNING_READY=false
else
    echo -e "${GREEN}✓ APPLE_ID: $APPLE_ID${NC}"
fi

if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo -e "${RED}✗ APPLE_APP_SPECIFIC_PASSWORD not set${NC}"
    SIGNING_READY=false
else
    echo -e "${GREEN}✓ APPLE_APP_SPECIFIC_PASSWORD: ****${NC}"
fi

if [ -z "$APPLE_TEAM_ID" ]; then
    echo -e "${RED}✗ APPLE_TEAM_ID not set${NC}"
    SIGNING_READY=false
else
    echo -e "${GREEN}✓ APPLE_TEAM_ID: $APPLE_TEAM_ID${NC}"
fi

# Check for Developer ID certificate
echo ""
if security find-identity -v -p codesigning 2>/dev/null | grep -q "Developer ID Application"; then
    CERT_INFO=$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application" | head -1)
    echo -e "${GREEN}✓ Developer ID certificate found:${NC}"
    echo -e "  $CERT_INFO"
else
    echo -e "${RED}✗ Developer ID Application certificate not found${NC}"
    echo -e "${YELLOW}  Please install your Developer ID certificate first.${NC}"
    SIGNING_READY=false
fi

echo ""

if [ "$SIGNING_READY" = false ]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}   Signing configuration incomplete!   ${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${YELLOW}To set up signing, either:${NC}"
    echo ""
    echo -e "1. Export environment variables:"
    echo -e "   ${BLUE}export APPLE_ID=\"your-apple-id@email.com\"${NC}"
    echo -e "   ${BLUE}export APPLE_APP_SPECIFIC_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\"${NC}"
    echo -e "   ${BLUE}export APPLE_TEAM_ID=\"CD298B4H7M\"${NC}"
    echo ""
    echo -e "2. Or create a .env.signing file in the project root:"
    echo -e "   ${BLUE}APPLE_ID=your-apple-id@email.com${NC}"
    echo -e "   ${BLUE}APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx${NC}"
    echo -e "   ${BLUE}APPLE_TEAM_ID=CD298B4H7M${NC}"
    echo ""
    echo -e "${YELLOW}Get an App-Specific Password at: https://appleid.apple.com${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All signing requirements met${NC}"
echo ""
echo -e "${BLUE}Starting signed macOS build...${NC}"
echo -e "${YELLOW}This will build, sign, and notarize the app.${NC}"
echo -e "${YELLOW}Notarization may take several minutes...${NC}"
echo ""

# Clean previous mac builds
rm -rf "$MAC_OUTPUT"
mkdir -p "$MAC_OUTPUT"

# Build
if npx quasar build -m electron -T mac; then
    echo ""
    echo -e "${GREEN}✓ Build completed successfully${NC}"

    # Copy builds to output directory
    if [ -d "$PACKAGED_DIR" ]; then
        find "$PACKAGED_DIR" -maxdepth 1 -name "*.dmg" -exec cp {} "$MAC_OUTPUT/" \;
        find "$PACKAGED_DIR" -maxdepth 1 -name "*-mac.zip" -exec cp {} "$MAC_OUTPUT/" \;
        find "$PACKAGED_DIR" -maxdepth 1 -name "*.pkg" -exec cp {} "$MAC_OUTPUT/" \;
        find "$MAC_OUTPUT" -maxdepth 1 -name "*.blockmap" -delete 2>/dev/null || true
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   Build Complete!                     ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Output files:${NC}"
    ls -lh "$MAC_OUTPUT"
    echo ""
    echo -e "${GREEN}Your signed and notarized app is ready for distribution!${NC}"
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}   Build Failed                        ${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
