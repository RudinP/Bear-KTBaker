import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import {
  buildStandaloneAndroidApk,
  standaloneRuntimePaths,
  verifyStandaloneAndroidMetadata,
  verifyStandaloneApkStructure,
} from '../electron/adapters/androidStandaloneBuild';
import {
  prepareStandaloneAndroidManifest,
} from '../src/io/androidStandaloneManifest';
import { buildAndroidColorsXml, buildAndroidManifest, buildAndroidStringsXml } from '../src/io/androidTheme';
import { createDefaultTheme } from '../src/domain/theme';
import { inspectCompiledAndroidApk } from '../src/io/androidCompiledMetadata';
import { fingerprintAndroidPng } from '../src/io/androidArchiveResources';
import { createAndroidImageExpectation } from '../src/io/androidImageVerification';
import {
  importAndroidThemeArchive,
} from '../src/io/themeImport/importAndroidTheme';

async function main() {
const root = process.cwd();
const packageName = 'com.themestudio.standaloneverification';
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

  const backgroundSourcePath = 'src/main/theme/drawable-xxhdpi/theme_background_image.png';
  const backgroundPath = path.join(buildDir, backgroundSourcePath);
  const backgroundPng = PNG.sync.read(await readFile(backgroundPath));
  let visiblePixelOffset = -1;
  for (let offset = 0; offset < backgroundPng.data.length; offset += 4) {
    if (backgroundPng.data[offset + 3] === 255) {
      visiblePixelOffset = offset;
      break;
    }
  }
  if (visiblePixelOffset === -1) throw new Error('Android background image has no visible pixel to mutate.');
  backgroundPng.data[visiblePixelOffset] = backgroundPng.data[visiblePixelOffset] === 255 ? 0 : 255;
  const backgroundBuffer = PNG.sync.write(backgroundPng);
  await writeFile(backgroundPath, backgroundBuffer);

  const bubbleSourcePath = 'src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png';
  const bubbleBuffer = await readFile(path.join(buildDir, bubbleSourcePath));
  const backgroundExpectation = createAndroidImageExpectation(
    'main.background',
    backgroundSourcePath,
    backgroundBuffer,
    false,
  );
  const bubbleExpectation = createAndroidImageExpectation(
    'chat.bubble.me.first.normal',
    bubbleSourcePath,
    bubbleBuffer,
    true,
  );
  const maintabExpectations = await Promise.all([
    'src/main/theme/drawable-xxhdpi/theme_maintab_cell_image.9.png',
    'src/main/theme/drawable-sw600dp/theme_maintab_cell_image.9.png',
  ].map(async (sourcePath) => {
    const expectation = createAndroidImageExpectation(
      'main.tab.background',
      sourcePath,
      await readFile(path.join(buildDir, sourcePath)),
      true,
    );
    if (!expectation) throw new Error(`Android image expectation could not be created: ${sourcePath}`);
    return expectation;
  }));
  if (!backgroundExpectation || !bubbleExpectation) {
    throw new Error('Android image expectations could not be created.');
  }
  const expectedImages = [backgroundExpectation, bubbleExpectation, ...maintabExpectations];

  await chmod(standaloneRuntimePaths(runtimeDir, 'darwin').aapt2, 0o755);
  await buildStandaloneAndroidApk({
    buildDir,
    outputPath,
    runtimeDir,
    identityPath: path.join(temporary, 'signing-identity.json'),
    packageName,
    versionCode: 20304,
    versionName: '2.3.4',
    expectedMetadata: {
      name: project.meta.name,
      appearance: project.meta.appearance,
      colors: project.colorValues.android,
    },
    expectedImages,
    platform: 'darwin',
  });

  const output = await readFile(outputPath);
  const structure = await verifyStandaloneApkStructure(output);
  const metadata = await inspectCompiledAndroidApk(output);
  if (!metadata.resourceFiles?.['drawable/theme_background_image']?.some((file) => file.endsWith('.png'))) {
    throw new Error('Compiled background image references are missing.');
  }
  const imported = await importAndroidThemeArchive(output, 'standalone-verification.apk', metadata);
  const imageCount = Object.keys(imported.platformResources.android).length;
  const colorCount = Object.keys(metadata.colors ?? {}).length;
  if (imageCount !== 37) throw new Error(`Expected 37 imported Android images, got ${imageCount}.`);
  if (colorCount !== 44) throw new Error(`Expected 44 compiled Android colors, got ${colorCount}.`);
  const importedBackground = imported.platformResources.android['main.background'];
  if (!importedBackground) throw new Error('Imported Android background image is missing.');
  const importedBackgroundFingerprint = fingerprintAndroidPng(
    Buffer.from(importedBackground.dataUrl.split(',')[1], 'base64'),
    false,
  );
  if (importedBackgroundFingerprint.sha256 !== backgroundExpectation.pixelFingerprint) {
    throw new Error('Imported Android background pixels differ from the exported expectation.');
  }
  for (const resourceId of [
    'chat.bubble.me.first.normal',
    'chat.bubble.you.first.normal',
  ] as const) {
    const asset = imported.platformResources.android[resourceId];
    if (!asset?.dataUrl.startsWith('data:image/png;base64,')) {
      throw new Error(`Expected compiled bubble recovery for ${resourceId}.`);
    }
  }
  const dexText = (await JSZip.loadAsync(output)).file('classes.dex')
    ? await (await JSZip.loadAsync(output)).file('classes.dex')!.async('nodebuffer')
    : Buffer.alloc(0);
  for (const marker of ['com/kakao/talk/theme/apeach/MainActivity', 'kakaotalk://settings/theme/', 'market://details?id=']) {
    if (!dexText.includes(Buffer.from(marker))) throw new Error(`Runtime DEX marker missing: ${marker}`);
  }
  verifyStandaloneAndroidMetadata(metadata, {
    packageName,
    versionName: '2.3.4',
    name: project.meta.name,
    appearance: project.meta.appearance,
    colors: project.colorValues.android,
  });

  const copiedOutput = process.argv[2];
  if (copiedOutput) await writeFile(path.resolve(copiedOutput), output);
  console.log(JSON.stringify({
    runtimeVerified: true,
    apkBytes: output.length,
    manifestPackage: metadata.themeId,
    resourcePackage: metadata.resourcePackage,
    version: metadata.version,
    name: metadata.name,
    appearance: metadata.appearance,
    images: imageCount,
    colors: colorCount,
    verifiedImages: expectedImages.length,
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
