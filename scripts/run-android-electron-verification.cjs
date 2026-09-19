const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { build } = require('tsup');

async function main() {
  await build({
    entry: ['scripts/verify-android-electron.ts'],
    format: ['cjs'],
    outDir: 'dist/verification',
    external: ['electron'],
    silent: true,
  });
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron'), [
    path.resolve('dist/verification/verify-android-electron.js'),
  ], { env: environment, stdio: 'inherit', timeout: 5 * 60_000 });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
