#!/bin/bash

# MyndPrompt Build Script
# Builds the application for macOS, Linux, and Windows
# Outputs are saved to dist/Builds/{mac,windows,linux}
#
# macOS Code Signing & Notarization:
# ----------------------------------
# For signed and notarized macOS builds, set these environment variables:
#
#   export APPLE_ID="your-apple-id@email.com"
#   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
#   export APPLE_TEAM_ID="CD298B4H7M"
#
# To get an App-Specific Password:
#   1. Go to https://appleid.apple.com
#   2. Sign in → Security → App-Specific Passwords
#   3. Generate a new password for "MyndPrompts Notarization"
#
# If these variables are not set, the macOS build will still work but
# users will see Gatekeeper warnings when installing the app.

# Don't exit on error - we want to continue building other platforms even if one fails
set +e

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
PACKAGED_DIR="$PROJECT_ROOT/dist/electron/Packaged"

# Platform-specific output directories
MAC_OUTPUT="$BUILD_OUTPUT/mac"
WINDOWS_OUTPUT="$BUILD_OUTPUT/windows"
LINUX_OUTPUT="$BUILD_OUTPUT/linux"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   MyndPrompt Multi-Platform Build     ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Load .env.signing if it exists (for macOS code signing)
if [ -f "$PROJECT_ROOT/.env.signing" ]; then
    echo -e "${BLUE}Loading signing configuration from .env.signing...${NC}"
    set -a
    source "$PROJECT_ROOT/.env.signing"
    set +a
fi

# Clean previous builds (dist/Builds is outside dist/electron so it won't be auto-cleaned)
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf "$BUILD_OUTPUT"

# Function to build for a specific platform
build_platform() {
    local platform=$1
    local description=$2

    echo ""
    echo -e "${BLUE}----------------------------------------${NC}"
    echo -e "${BLUE}Building for ${description}...${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"

    # Run the build
    if npx quasar build -m electron -T "$platform"; then
        echo -e "${GREEN}✓ ${description} build completed${NC}"
        return 0
    else
        echo -e "${RED}✗ ${description} build failed${NC}"
        return 1
    fi
}

# Function to copy builds to platform-specific output directory
copy_builds() {
    local platform=$1
    local output_dir=$2

    # Create output directory (must be done here because Quasar build cleans dist/electron)
    mkdir -p "$output_dir"

    echo -e "${YELLOW}Copying ${platform} builds to ${output_dir}...${NC}"

    # Copy all distributable files using find to handle filenames with spaces
    if [ -d "$PACKAGED_DIR" ]; then
        echo -e "${BLUE}Contents of Packaged directory:${NC}"
        ls -la "$PACKAGED_DIR"

        # Copy based on platform
        case $platform in
            mac)
                find "$PACKAGED_DIR" -maxdepth 1 -name "*.dmg" -exec cp {} "$output_dir/" \;
                find "$PACKAGED_DIR" -maxdepth 1 -name "*-mac.zip" -exec cp {} "$output_dir/" \;
                find "$PACKAGED_DIR" -maxdepth 1 -name "*.pkg" -exec cp {} "$output_dir/" \;
                ;;
            linux)
                find "$PACKAGED_DIR" -maxdepth 1 -name "*.AppImage" -exec cp {} "$output_dir/" \;
                find "$PACKAGED_DIR" -maxdepth 1 -name "*.deb" -exec cp {} "$output_dir/" \;
                find "$PACKAGED_DIR" -maxdepth 1 -name "*.rpm" -exec cp {} "$output_dir/" \;
                find "$PACKAGED_DIR" -maxdepth 1 -name "*.snap" -exec cp {} "$output_dir/" \;
                ;;
            win)
                find "$PACKAGED_DIR" -maxdepth 1 -name "*.exe" -exec cp {} "$output_dir/" \;
                find "$PACKAGED_DIR" -maxdepth 1 -name "*.msi" -exec cp {} "$output_dir/" \;
                ;;
        esac

        # Remove blockmap files from output (keep only installers)
        find "$output_dir" -maxdepth 1 -name "*.blockmap" -delete 2>/dev/null || true

        echo -e "${GREEN}Contents of ${platform} build directory:${NC}"
        ls -la "$output_dir" 2>/dev/null || echo "  (empty)"
    else
        echo -e "${RED}Packaged directory does not exist${NC}"
    fi
}

# Track build results
MAC_SUCCESS=false
LINUX_SUCCESS=false
WIN_SUCCESS=false

# Check macOS signing configuration
check_macos_signing() {
    echo ""
    echo -e "${BLUE}Checking macOS code signing configuration...${NC}"

    if [ -n "$APPLE_ID" ] && [ -n "$APPLE_APP_SPECIFIC_PASSWORD" ] && [ -n "$APPLE_TEAM_ID" ]; then
        echo -e "${GREEN}✓ Code signing environment variables are set${NC}"
        echo -e "  APPLE_ID: $APPLE_ID"
        echo -e "  APPLE_TEAM_ID: $APPLE_TEAM_ID"
        echo -e "  APPLE_APP_SPECIFIC_PASSWORD: ****"

        # Check for Developer ID certificate
        if security find-identity -v -p codesigning 2>/dev/null | grep -q "Developer ID Application"; then
            echo -e "${GREEN}✓ Developer ID Application certificate found${NC}"
            echo -e "${GREEN}  → macOS build will be signed and notarized${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ Developer ID Application certificate not found${NC}"
            echo -e "${YELLOW}  → macOS build will NOT be signed${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ Code signing environment variables not set:${NC}"
        [ -z "$APPLE_ID" ] && echo -e "  - APPLE_ID"
        [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] && echo -e "  - APPLE_APP_SPECIFIC_PASSWORD"
        [ -z "$APPLE_TEAM_ID" ] && echo -e "  - APPLE_TEAM_ID"
        echo -e "${YELLOW}  → macOS build will NOT be signed or notarized${NC}"
        return 1
    fi
}

# Build for macOS
echo ""
echo -e "${YELLOW}Starting macOS build...${NC}"
check_macos_signing

if build_platform "mac" "macOS"; then
    copy_builds "mac" "$MAC_OUTPUT"
    MAC_SUCCESS=true
fi

# Build for Linux
echo ""
echo -e "${YELLOW}Starting Linux build...${NC}"

if build_platform "linux" "Linux"; then
    copy_builds "linux" "$LINUX_OUTPUT"
    LINUX_SUCCESS=true
fi

# Build for Windows
echo ""
echo -e "${YELLOW}Starting Windows build...${NC}"

if build_platform "win" "Windows"; then
    copy_builds "win" "$WINDOWS_OUTPUT"
    WIN_SUCCESS=true
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}           Build Summary               ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if $MAC_SUCCESS; then
    echo -e "${GREEN}✓ macOS build successful${NC}"
else
    echo -e "${RED}✗ macOS build failed${NC}"
fi

if $LINUX_SUCCESS; then
    echo -e "${GREEN}✓ Linux build successful${NC}"
else
    echo -e "${RED}✗ Linux build failed${NC}"
fi

if $WIN_SUCCESS; then
    echo -e "${GREEN}✓ Windows build successful${NC}"
else
    echo -e "${RED}✗ Windows build failed${NC}"
fi

echo ""
echo -e "${BLUE}Build outputs are organized in:${NC}"
echo -e "${YELLOW}$BUILD_OUTPUT${NC}"
echo ""

# List the built files for each platform
echo -e "${BLUE}Built files by platform:${NC}"
echo ""

echo -e "${BLUE}macOS (${MAC_OUTPUT}):${NC}"
if [ -d "$MAC_OUTPUT" ] && [ "$(ls -A $MAC_OUTPUT 2>/dev/null)" ]; then
    ls -lh "$MAC_OUTPUT"
else
    echo "  (no files)"
fi
echo ""

echo -e "${BLUE}Windows (${WINDOWS_OUTPUT}):${NC}"
if [ -d "$WINDOWS_OUTPUT" ] && [ "$(ls -A $WINDOWS_OUTPUT 2>/dev/null)" ]; then
    ls -lh "$WINDOWS_OUTPUT"
else
    echo "  (no files)"
fi
echo ""

echo -e "${BLUE}Linux (${LINUX_OUTPUT}):${NC}"
if [ -d "$LINUX_OUTPUT" ] && [ "$(ls -A $LINUX_OUTPUT 2>/dev/null)" ]; then
    ls -lh "$LINUX_OUTPUT"
else
    echo "  (no files)"
fi

echo ""
echo -e "${GREEN}Build process completed!${NC}"
