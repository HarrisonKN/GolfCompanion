const fs = require('fs');
const path = require('path');
const semver = require('semver');

const appJsonPath = path.join(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

// Accept type: major, minor, patch
const type = process.argv[2] || 'patch';
const currentVersion = appJson.expo.version || '1.0.0';
appJson.expo.version = semver.inc(currentVersion, type);

// Increment build numbers
if (appJson.expo.ios && appJson.expo.ios.buildNumber) {
  appJson.expo.ios.buildNumber = (parseInt(appJson.expo.ios.buildNumber) + 1).toString();
}

if (appJson.expo.android && appJson.expo.android.versionCode) {
  appJson.expo.android.versionCode = parseInt(appJson.expo.android.versionCode) + 1;
}

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
console.log(`Version updated to ${appJson.expo.version}`);
console.log('Build numbers updated!');
console.log(`iOS: ${appJson.expo.ios?.buildNumber}`);
console.log(`Android: ${appJson.expo.android?.versionCode}`);

{/*
# Increment patch version (1.0.0 -> 1.0.1)
npm run version:patch

# Increment minor version (1.0.1 -> 1.1.0)
npm run version:minor

# Increment major version (1.1.0 -> 2.0.0)
npm run version:major

# Update build numbers only
npm run build:version

*/}