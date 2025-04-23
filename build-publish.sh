#!/bin/bash

# Script to automate build and publish of doris-cubejs-driver
# Usage: ./build-publish.sh [options]
# Options:
#   --build-only    Build the package without publishing
#   --publish-only  Publish the package without building
#   --version=TYPE  Update version before publishing (patch, minor, major)
#   --help          Show this help message

# Function to display usage information
display_help() {
  echo "Usage: ./build-publish.sh [options]"
  echo "Options:"
  echo "  --build-only    Build the package without publishing"
  echo "  --publish-only  Publish the package without building"
  echo "  --version=TYPE  Update version before publishing (patch, minor, major)"
  echo "  --help          Show this help message"
  exit 0
}

# Default behavior is to build and publish
BUILD=true
PUBLISH=true
VERSION_UPDATE=""

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --build-only)
      PUBLISH=false
      ;;
    --publish-only)
      BUILD=false
      ;;
    --version=*)
      VERSION_UPDATE="${arg#*=}"
      ;;
    --help)
      display_help
      ;;
    *)
      echo "Unknown option: $arg"
      display_help
      ;;
  esac
done

# Function to build the package
build_package() {
  echo "🔨 Building package..."
  yarn install
  yarn build
  if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
  else
    echo "❌ Build failed"
    exit 1
  fi
}

# Function to compare versions and use the latest
compare_and_update_version() {
  if [ -n "$VERSION_UPDATE" ]; then
    echo "🔍 Checking latest published version..."
    
    # Get package name from package.json
    PACKAGE_NAME=$(node -p "require('./package.json').name")
    
    # Get the latest published version from npm
    LATEST_PUBLISHED=$(npm view $PACKAGE_NAME version 2>/dev/null || echo "0.0.0")
    
    # Get current local version from package.json
    LOCAL_VERSION=$(node -p "require('./package.json').version")
    
    echo "📊 Version comparison:"
    echo "   - Local version:    $LOCAL_VERSION"
    echo "   - Published version: $LATEST_PUBLISHED"
    
    # Compare versions using semver logic
    IS_LOCAL_NEWER=$(node -e "console.log(require('semver').gt('$LOCAL_VERSION', '$LATEST_PUBLISHED') ? 'true' : 'false')")
    
    if [ "$IS_LOCAL_NEWER" = "true" ]; then
      echo "📝 Local version is newer than published version. Using local version as base."
      BASE_VERSION=$LOCAL_VERSION
    else
      echo "📝 Published version is newer than local version. Using published version as base."
      
      # Update local package.json to match the published version
      if [ "$LATEST_PUBLISHED" != "$LOCAL_VERSION" ]; then
        echo "🔄 Updating package.json to match published version..."
        npm version $LATEST_PUBLISHED --no-git-tag-version --allow-same-version
      fi
      
      BASE_VERSION=$LATEST_PUBLISHED
    fi
    
    echo "📝 Updating version ($VERSION_UPDATE) based on $BASE_VERSION..."
    npm version $VERSION_UPDATE --no-git-tag-version
    
    if [ $? -eq 0 ]; then
      NEW_VERSION=$(node -p "require('./package.json').version")
      echo "✅ Version updated successfully to $NEW_VERSION"
    else
      echo "❌ Version update failed"
      exit 1
    fi
  fi
}

# Function to publish the package
publish_package() {
  echo "🚀 Publishing package to npm..."
  npm publish
  if [ $? -eq 0 ]; then
    echo "✅ Package published successfully"
  else
    echo "❌ Publishing failed"
    exit 1
  fi
}

# Check if user is logged in to npm
check_npm_auth() {
  echo "🔑 Checking npm authentication..."
  npm whoami &> /dev/null
  if [ $? -ne 0 ]; then
    echo "❌ You are not logged in to npm. Please run 'npm login' first."
    exit 1
  else
    echo "✅ Authenticated as $(npm whoami)"
  fi
}

# Install semver dependency if not already installed
check_dependencies() {
  echo "🔍 Checking dependencies..."
  npm list semver --depth=0 --silent &> /dev/null
  if [ $? -ne 0 ]; then
    echo "📦 Installing semver dependency..."
    npm install --no-save semver &> /dev/null
    if [ $? -ne 0 ]; then
      echo "❌ Failed to install semver dependency"
      exit 1
    fi
  fi
  echo "✅ Dependencies verified"
}

# Main execution
check_dependencies

if [ "$BUILD" = true ]; then
  build_package
fi

if [ "$PUBLISH" = true ]; then
  check_npm_auth
  compare_and_update_version
  publish_package
fi

echo "✨ All done!" 