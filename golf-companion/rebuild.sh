#!/bin/bash
# ---- GOLF COMPANION CLEAN & REBUILD SCRIPT ----
echo "🧹 Cleaning up old caches and builds..."

# stop any old Metro or Expo processes
pkill -f "expo|metro" 2>/dev/null || true

# fix npm permissions if needed
sudo chown -R $(whoami) ~/.npm 2>/dev/null || true

# remove caches & build folders
rm -rf node_modules android/app/build android/build .expo .expo-shared .gradle
rm -rf package-lock.json yarn.lock
rm -rf "$TMPDIR/metro-*" /tmp/metro-* 2>/dev/null || true

# clear npm cache safely
npm cache clean --force

echo "📦 Re-installing dependencies..."
npm install

echo "🧱 Cleaning Gradle..."
(cd android && ./gradlew clean)

echo "🚀 Starting fresh Metro bundler (clean cache)..."
# start Metro in background
npx expo start -c &

sleep 5

echo "📲 Building and running Android app..."
npx expo run:android

echo "✅ Done! Fresh build deployed."
echo "If you still see the old version, run: adb uninstall com.anonymous.golfcompanion"