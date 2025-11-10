#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const argv = process.argv.slice(2);
let type = 'patch'; // patch | minor | major
for (const a of argv) {
  if (['patch', 'minor', 'major'].includes(a)) type = a;
  if (a.startsWith('--type=')) type = a.split('=')[1];
}

const updateScript = path.join(__dirname, 'updateBuildNumber.js');
const androidDir = path.join(__dirname, '..', 'android');
const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
const apkPath = path.join(apkDir, 'app-release.apk');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (res.status !== 0) process.exit(res.status || 1);
}

function runGradle(args) {
  if (!fs.existsSync(androidDir)) {
    console.error('Android project not found at ./android. Generate it first.');
    process.exit(1);
  }
  if (process.platform === 'win32') {
    run('cmd.exe', ['/c', 'gradlew.bat', ...args], { cwd: androidDir });
  } else {
    run('./gradlew', args, { cwd: androidDir });
  }
}

function openApkLocation() {
  try {
    if (process.platform === 'win32') {
      if (fs.existsSync(apkPath)) {
        spawnSync('explorer.exe', [`/select,${apkPath}`], { stdio: 'ignore' });
      } else {
        spawnSync('explorer.exe', [apkDir], { stdio: 'ignore' });
      }
    } else if (process.platform === 'darwin') {
      if (fs.existsSync(apkPath)) {
        spawnSync('open', ['-R', apkPath], { stdio: 'ignore' });
      } else {
        spawnSync('open', [apkDir], { stdio: 'ignore' });
      }
    } else {
      spawnSync('xdg-open', [apkDir], { stdio: 'ignore' });
    }
  } catch {}
}

// 1) Bump app version and build numbers
console.log(`updating version (${type}) and increasing build numbers...`);
run('node', [updateScript, type]);

// 2) Build local Android release APK
console.log('Running local Gradle release build (assembleRelease)...');
runGradle(['assembleRelease']);

console.log('\nDone.');
console.log(`APK: ${apkPath}`);
console.log('Opening APK folder...');
openApkLocation();

