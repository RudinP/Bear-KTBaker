import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import {
  buildStandaloneAndroidApk,
  prepareStandaloneAndroidManifest,
  standaloneRuntimePaths,
  verifyStandaloneApkStructure,
} from '../src/io/androidStandaloneBuild';
import { buildAndroidColorsXml, buildAndroidManifest, buildAndroidStringsXml } from '../src/io/androidTheme';
import { createDefaultTheme } from '../src/domain/theme';
import { inspectCompiledAndroidApk } from '../src/io/androidCompiledMetadata';
import { ANDROID_SAMPLE_COLORS } from '../src/manifest/kakaoColors';

async function main() {
const root = process.cwd();
const runtimeDir = path.join(root, 'resources', 'templates', 'android-runtime');
const runtimeManifest = JSON.parse(await readFile(path.join(runtimeDir, 'runtime-manifest.json'), 'utf8')) as {
  files: Record<string, string>;
};

for (const [relative, expected] of Object.entries(runtimeManifest.files)) {
  const contents = await readFile(path.join(runtimeDir, relative));
  const actual = createHash('sha256').update(contents).digest('hex');
  if (actual !== expected) throw new Error(`Android runtime checksum mismatch: ${relative}`);
}

const darwinAapt2 = await readFile(standaloneRuntimePaths(runtimeDir, 'darwin').aapt2);
if (!darwinAapt2.subarray(0, 4).equals(Buffer.from([0xca, 0xfe, 0xba, 0xbe]))) {
  throw new Error('macOS AAPT2 is not a universal Mach-O binary.');
}
const windowsAapt2 = await readFile(standaloneRuntimePaths(runtimeDir, 'win32').aapt2);
if (windowsAapt2.toString('ascii', 0, 2) !== 'MZ') throw new Error('Windows AAPT2 is not a PE executable.');

if (process.platform !== 'darwin') {
  console.log(JSON.stringify({ runtimeVerified: true, buildSkippedOn: process.platform }));
  process.exit(0);
}

const temporary = await mkdtemp(path.join(tmpdir(), 'kakao-standalone-verification-'));
const buildDir = path.join(temporary, 'source');
const outputPath = path.join(temporary, 'standalone-verification.apk');
try {
  const template = await JSZip.loadAsync(await readFile(path.join(root, 'resources', 'templates', 'android-source.zip')));
  await Promise.all(Object.values(template.files).map(async (entry) => {
    const target = path.join(buildDir, entry.name);
    if (entry.dir) return mkdir(target, { recursive: true });
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await entry.async('nodebuffer'));
  }));

  const project = createDefaultTheme();
  project.meta.name = '독립 실행 검증 테마';
  project.meta.version = '2.3.4';
  project.meta.appearance = 'dark';
  const colorsPath = path.join(buildDir, 'src/main/theme/values/colors.xml');
  await writeFile(colorsPath, buildAndroidColorsXml(project, await readFile(colorsPath, 'utf8')));
  const manifestPath = path.join(buildDir, 'src/main/AndroidManifest.xml');
  await writeFile(manifestPath, prepareStandaloneAndroidManifest(buildAndroidManifest(project, await readFile(manifestPath, 'utf8'))));
  const strings = buildAndroidStringsXml(project);
  for (const target of ['src/main/theme/values/strings.xml', 'src/main/theme/values-ko/strings.xml']) {
    await mkdir(path.dirname(path.join(buildDir, target)), { recursive: true });
    await writeFile(path.join(buildDir, target), strings);
  }

  await chmod(standaloneRuntimePaths(runtimeDir, 'darwin').aapt2, 0o755);
  await buildStandaloneAndroidApk({
    buildDir,
    outputPath,
    runtimeDir,
    identityPath: path.join(temporary, 'signing-identity.json'),
    packageName: 'com.themestudio.standaloneverification',
    versionCode: 20304,
    versionName: '2.3.4',
    platform: 'darwin',
  });

  const output = await readFile(outputPath);
  const structure = await verifyStandaloneApkStructure(output);
  const metadata = await inspectCompiledAndroidApk(output);
  const dexText = (await JSZip.loadAsync(output)).file('classes.dex')
    ? await (await JSZip.loadAsync(output)).file('classes.dex')!.async('nodebuffer')
    : Buffer.alloc(0);
  for (const marker of ['com/kakao/talk/theme/apeach/MainActivity', 'kakaotalk://settings/theme/', 'market://details?id=']) {
    if (!dexText.includes(Buffer.from(marker))) throw new Error(`Runtime DEX marker missing: ${marker}`);
  }
  if (metadata.themeId !== 'com.themestudio.standaloneverification') throw new Error('Compiled package id mismatch.');
  if (metadata.version !== '2.3.4') throw new Error('Compiled version mismatch.');
  if (metadata.name !== project.meta.name) throw new Error(`Compiled Korean label mismatch: ${metadata.name ?? 'missing'}`);
  if (metadata.appearance !== 'dark') throw new Error(`Compiled dark-mode metadata mismatch: ${metadata.appearance ?? 'missing'}`);
  if (Object.keys(metadata.colors ?? {}).length !== Object.keys(ANDROID_SAMPLE_COLORS).length) {
    throw new Error(`Compiled color count mismatch: ${Object.keys(metadata.colors ?? {}).length}`);
  }

  const copiedOutput = process.argv[2];
  if (copiedOutput) await writeFile(path.resolve(copiedOutput), output);
  console.log(JSON.stringify({
    runtimeVerified: true,
    apkBytes: output.length,
    packageName: metadata.themeId,
    version: metadata.version,
    name: metadata.name,
    appearance: metadata.appearance,
    colors: Object.keys(metadata.colors ?? {}).length,
    structure,
    output: copiedOutput ? path.resolve(copiedOutput) : outputPath,
  }, null, 2));
} finally {
  if (!process.argv[2]) await rm(temporary, { recursive: true, force: true });
}
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
