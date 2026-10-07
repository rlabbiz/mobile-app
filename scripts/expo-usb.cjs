const path = require('node:path');
const fs = require('node:fs');
const { spawnSync, spawn } = require('node:child_process');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
  path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' });
const connected = (devices.stdout || '').split(/\r?\n/).filter(line => /\tdevice$/.test(line));
if (devices.error || devices.status !== 0 || connected.length !== 1) {
  console.error('Connect one Android phone with USB debugging enabled, authorize this computer, and install Expo Go on the phone.');
  process.exit(1);
}
const serial = connected[0].split('\t')[0];
for (const port of [8081, 3000, 59000]) {
  const result = spawnSync(adb, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(1);
}
const packagePath = require.resolve('expo/package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const cli = path.resolve(path.dirname(packagePath), typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.expo);
const child = spawn(process.execPath, [cli, 'start', '--go', '--localhost'], {
  stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_API_URL: 'http://localhost:3000' },
});
child.on('exit', code => process.exit(code || 0));
child.on('error', error => { console.error(error.message); process.exit(1); });
