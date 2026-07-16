import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, type IpcMainInvokeEvent } from 'electron';
import { execFile } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import JSZip from 'jszip';
import { androidResourceIdentity } from '../src/io/androidArchiveResources';
import { buildAndroidColorsXml, buildAndroidManifest, buildAndroidStringsXml } from '../src/io/androidTheme';
import {
  assertAndroidImageOutputPossible,
  createAndroidImageExpectation,
  type AndroidImageExpectation,
} from '../src/io/androidImageVerification';
import { buildStandaloneAndroidApk, prepareStandaloneAndroidManifest } from '../src/io/androidStandaloneBuild';
import { buildIosCss } from '../src/io/iosTheme';
import { generateCleanIosThemeArchive } from '../src/io/archiveHygiene';
import { buildNinePatchPng, replaceNinePatchInterior, stripNinePatchBorder } from '../src/io/ninePatchPng';
import { getMappedResourceWrites } from '../src/io/resourceWrites';
import { flexibleBubbleTargetSize, sourceHasNinePatchBorder, uploadSourceScale } from '../src/io/resourceGeometry';
import {
  detectThemeImportKind,
  importAndroidSourceZip,
  importAndroidThemeArchive,
  importIosKtheme,
  inspectCompiledAndroidApk,
  type AndroidCompiledMetadata,
} from '../src/io/themeImport';
import { ANDROID_SAMPLE_COLORS } from '../src/manifest/kakaoColors';
import { getResourceSlot, type ResourceRenderMode } from '../src/manifest/kakaoResources';
import { resolveBubbleGuides } from '../src/manifest/bubbleGuideResolver';
import { createDefaultTheme, parseThemeProject, serializeThemeProject, type ThemeProject } from '../src/domain/theme';
import { historyCommandForInput } from './historyShortcut';
import { createApplicationMenuTemplate } from './applicationMenu';

const execFileAsync = promisify(execFile);
const devUrl = process.env.VITE_DEV_SERVER_URL;

// macOS builds the application menu from Electron's runtime name, not the
// BrowserWindow title or electron-builder productName.
app.setName('Bear KTBaker');

function templatePath(file: string) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'templates', file)
    : path.join(app.getAppPath(), 'resources', 'templates', file);
}

function assertTrusted(event: IpcMainInvokeEvent) {
  const url = event.senderFrame?.url;
  if (!url) throw new Error('허용되지 않은 화면 요청입니다.');
  if (url.startsWith('file://')) return;
  if (devUrl && url.startsWith(devUrl)) return;
  throw new Error('허용되지 않은 화면 요청입니다.');
}

async function createWindow() {
  const isMac = process.platform === 'darwin';
  const window = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1060,
    minHeight: 710,
    show: false,
    title: 'Bear KTBaker',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    vibrancy: isMac ? 'under-window' : undefined,
    visualEffectState: isMac ? 'active' : undefined,
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : 'none',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const command = historyCommandForInput(input, process.platform);
    if (!command) return;
    event.preventDefault();
    window.webContents.send('history:command', command);
  });
  window.once('ready-to-show', () => {
    window.show();
  });
  if (devUrl) await window.loadURL(devUrl);
  else await window.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
}

function installApplicationMenu() {
  const template = createApplicationMenuTemplate(process.platform, (command) => {
    BrowserWindow.getFocusedWindow()?.webContents.send('file:command', command);
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function unzipTo(zipPath: string, target: string) {
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  await Promise.all(Object.values(zip.files).map(async (entry) => {
    const output = path.join(target, entry.name);
    if (entry.dir) return mkdir(output, { recursive: true });
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, await entry.async('nodebuffer'));
  }));
}

function dataUrlBuffer(dataUrl: string) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

function bubbleGuides(project: ThemeProject, platform: 'ios' | 'android', resourceId: string) {
  if (!/^chat\.bubble\./.test(resourceId)) return undefined;
  return resolveBubbleGuides(project, platform, resourceId).guides;
}

function resizeForTarget(source: Electron.NativeImage, width: number, height: number, mode: ResourceRenderMode) {
  if (mode === 'top-center-crop' || mode === 'top-center-cover' || mode === 'center-crop' || mode === 'cover') {
    const size = source.getSize();
    const scale = Math.max(width / size.width, height / size.height);
    const resized = source.resize({ width: Math.max(width, Math.round(size.width * scale)), height: Math.max(height, Math.round(size.height * scale)), quality: 'best' });
    const resizedSize = resized.getSize();
    return resized.crop({ x: Math.max(0, Math.floor((resizedSize.width - width) / 2)), y: mode === 'top-center-crop' || mode === 'top-center-cover' ? 0 : Math.max(0, Math.floor((resizedSize.height - height) / 2)), width, height });
  }
  return source.resize({ width, height, quality: 'best' });
}

function preparePng(dataUrl: string, target: Buffer, mode: ResourceRenderMode, targetIsNinePatch: boolean, sourceIsNinePatch = false) {
  const targetImage = nativeImage.createFromBuffer(target);
  const targetSize = targetImage.getSize();
  const width = targetSize.width - (targetIsNinePatch ? 2 : 0);
  const height = targetSize.height - (targetIsNinePatch ? 2 : 0);
  const rawSource = dataUrlBuffer(dataUrl);
  const sourceBuffer = targetIsNinePatch && sourceIsNinePatch ? Buffer.from(stripNinePatchBorder(rawSource)) : rawSource;
  const source = nativeImage.createFromBuffer(sourceBuffer);
  if (source.isEmpty()) throw new Error('이미지 파일을 읽을 수 없습니다. PNG, JPG 또는 WebP 파일을 사용해 주세요.');
  return resizeForTarget(source, width, height, mode).toPNG();
}

function preparePngAtSize(dataUrl: string, width: number, height: number, mode: ResourceRenderMode) {
  const source = nativeImage.createFromBuffer(dataUrlBuffer(dataUrl));
  if (source.isEmpty()) throw new Error('이미지 파일을 읽을 수 없습니다. PNG, JPG 또는 WebP 파일을 사용해 주세요.');
  return resizeForTarget(source, width, height, mode).toPNG();
}

function prepareFlexibleBubblePng(dataUrl: string, platform: 'ios' | 'android', targetPath: string, asset: ThemeProject['platformResources']['ios'][string]) {
  const rawSource = dataUrlBuffer(dataUrl);
  const sourceIsNinePatch = platform === 'android'
    && sourceHasNinePatchBorder(asset.rawNinePatch, asset.fileName);
  const rawImage = nativeImage.createFromBuffer(rawSource);
  if (rawImage.isEmpty()) throw new Error('말풍선 이미지를 읽을 수 없습니다. PNG, JPG 또는 WebP 파일을 사용해 주세요.');
  const sourceBuffer = sourceIsNinePatch ? Buffer.from(stripNinePatchBorder(rawSource)) : rawSource;
  const source = nativeImage.createFromBuffer(sourceBuffer);
  const sourceScale = asset.sourceScale ?? uploadSourceScale(platform, '', asset.fileName);
  const size = flexibleBubbleTargetSize(
    platform,
    targetPath,
    rawImage.getSize(),
    sourceScale,
    sourceIsNinePatch,
    asset.mirroredFromPlatform,
  );
  return resizeForTarget(source, size.width, size.height, 'stretch').toPNG();
}

async function replaceMappedIosImages(zip: JSZip, project: ThemeProject) {
  for (const write of getMappedResourceWrites(project, 'ios')) {
    const existing = zip.file(write.path);
    const slot = getResourceSlot(write.resourceId);
    const mode = slot.render.mode;
    if (mode === 'stretch') {
      zip.file(write.path, prepareFlexibleBubblePng(write.asset.dataUrl, 'ios', write.path, write.asset));
      continue;
    }
    if (existing) {
      zip.file(write.path, preparePng(write.asset.dataUrl, await existing.async('nodebuffer'), mode, false));
      continue;
    }
    const size = slot.ios?.outputSize;
    if (!size) continue;
    const scale = /@3x\.png$/i.test(write.path) ? 3 : /@2x\.png$/i.test(write.path) ? 2 : 1;
    zip.file(write.path, preparePngAtSize(write.asset.dataUrl, size[0] * scale, size[1] * scale, mode));
  }
}

async function replaceMappedAndroidImages(buildDir: string, project: ThemeProject) {
  const expectations: AndroidImageExpectation[] = [];
  for (const write of getMappedResourceWrites(project, 'android')) {
    const targetPath = path.join(buildDir, write.path);
    const slot = getResourceSlot(write.resourceId);
    const mode = slot.render.mode;
    let target: Buffer | undefined;
    try { target = await readFile(targetPath); } catch { /* guide-optional resource not present in the older sample */ }
    const outputSize = slot.android?.outputSize;
    const flexibleBubble = mode === 'stretch';
    const compiledIdentity = androidResourceIdentity(write.path);
    if (!compiledIdentity && !target && !outputSize && !flexibleBubble) continue;
    if (compiledIdentity) {
      assertAndroidImageOutputPossible({
        resourceId: write.resourceId,
        sourcePath: write.path,
        hasTemplate: Boolean(target),
        hasOutputSize: Boolean(outputSize),
        flexibleBubble,
      });
    }
    const png = flexibleBubble
      ? prepareFlexibleBubblePng(write.asset.dataUrl, 'android', write.path, write.asset)
      : target
      ? preparePng(
        write.asset.dataUrl,
        target,
        mode,
        write.ninePatch,
        sourceHasNinePatchBorder(write.asset.rawNinePatch, write.asset.fileName),
      )
      : preparePngAtSize(write.asset.dataUrl, outputSize![0], outputSize![1], mode);
    const guides = bubbleGuides(project, 'android', write.resourceId);
    const output = write.ninePatch ? (guides ? buildNinePatchPng(png, guides) : replaceNinePatchInterior(target!, png)) : png;
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, output);
    const expectation = createAndroidImageExpectation(write.resourceId, write.path, output, write.ninePatch);
    if (expectation) expectations.push(expectation);
  }
  return expectations;
}

async function exportIos(project: ThemeProject) {
  const result = await dialog.showSaveDialog({
    title: 'iPhone 테마 저장',
    defaultPath: `${project.meta.name}.ktheme`,
    filters: [{ name: '카카오톡 iPhone 테마', extensions: ['ktheme'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const zip = await JSZip.loadAsync(await readFile(templatePath('ios-base.ktheme')));
  const cssFile = zip.file('KakaoTalkTheme.css');
  if (!cssFile) throw new Error('iOS 테마 템플릿이 손상되었습니다.');
  zip.file('KakaoTalkTheme.css', buildIosCss(project, await cssFile.async('string')));
  await replaceMappedIosImages(zip, project);
  await writeFile(result.filePath, await generateCleanIosThemeArchive(zip));
  return result.filePath;
}

function packageId(project: ThemeProject) {
  const clean = project.meta.themeId.toLowerCase().replace(/[^a-z0-9.]/g, '').split('.').filter(Boolean).map((part) => /^[a-z]/.test(part) ? part : `t${part}`).join('.');
  return clean.includes('.') ? clean : `com.themestudio.${clean || 'theme'}`;
}

function androidVersionCode(version: string) {
  const [major = 1, minor = 0, patch = 0] = version.split('.').map((part) => Number(part.replace(/\D/g, '')) || 0);
  return Math.max(1, major * 10_000 + minor * 100 + patch);
}

async function exportAndroid(project: ThemeProject) {
  const result = await dialog.showSaveDialog({
    title: 'Android 테마 저장',
    defaultPath: `${project.meta.name}.apk`,
    filters: [{ name: '카카오톡 Android 테마', extensions: ['apk'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const buildDir = await mkdir(path.join(tmpdir(), 'kakao-theme-builds'), { recursive: true }).then(() => path.join(tmpdir(), 'kakao-theme-builds', `${Date.now()}`));
  await mkdir(buildDir, { recursive: true });
  try {
    await unzipTo(templatePath('android-source.zip'), buildDir);
    const colorsPath = path.join(buildDir, 'src/main/theme/values/colors.xml');
    await writeFile(colorsPath, buildAndroidColorsXml(project, await readFile(colorsPath, 'utf8')));
    const manifestPath = path.join(buildDir, 'src/main/AndroidManifest.xml');
    await writeFile(manifestPath, prepareStandaloneAndroidManifest(buildAndroidManifest(project, await readFile(manifestPath, 'utf8'))));
    const strings = buildAndroidStringsXml(project);
    for (const target of ['src/main/theme/values/strings.xml', 'src/main/theme/values-ko/strings.xml']) {
      await mkdir(path.dirname(path.join(buildDir, target)), { recursive: true });
      await writeFile(path.join(buildDir, target), strings);
    }
    const identifier = packageId(project);
    const versionName = project.meta.version.replace(/[^0-9A-Za-z._-]/g, '') || '1.0.0';
    const expectedImages = await replaceMappedAndroidImages(buildDir, project);
    const verifiedApk = path.join(buildDir, 'verified-theme.apk');
    await buildStandaloneAndroidApk({
      buildDir,
      outputPath: verifiedApk,
      runtimeDir: templatePath('android-runtime'),
      identityPath: path.join(app.getPath('userData'), 'android-signing-identity.json'),
      packageName: identifier,
      versionCode: androidVersionCode(project.meta.version),
      versionName,
      expectedMetadata: {
        name: project.meta.name,
        appearance: project.meta.appearance,
        colors: project.colorValues.android,
      },
      platform: process.platform as 'darwin' | 'win32',
      expectedImages,
    });
    await cp(verifiedApk, result.filePath);
    return { path: result.filePath };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  } finally {
    await rm(buildDir, { recursive: true, force: true });
  }
}

async function androidBuildTool(name: 'aapt' | 'aapt2') {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
    || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Android/sdk')
      : process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk')
        : path.join(process.env.HOME || '', 'Android/Sdk'));
  try {
    const versions = (await readdir(path.join(sdk, 'build-tools')))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
    for (const version of versions) {
      const candidate = path.join(sdk, 'build-tools', version, `${name}${process.platform === 'win32' ? '.exe' : ''}`);
      try { await access(candidate); return candidate; } catch { /* try the next installed build-tools version */ }
    }
  } catch { /* APK images can still be imported without build-tools metadata */ }
  return undefined;
}

function parseCompiledColors(output: string) {
  const colors: Record<string, string> = {};
  let current: string | undefined;
  for (const line of output.split(/\r?\n/)) {
    const resource = line.match(/\bcolor\/(theme_[a-z0-9_]+)/i)?.[1];
    if (resource) { current = resource; continue; }
    const value = current ? line.match(/^\s*\(\)\s+#([0-9a-f]{8})\s*$/i)?.[1] : undefined;
    if (!current || !value || !(current in ANDROID_SAMPLE_COLORS)) continue;
    colors[current] = value.slice(0, 2).toLowerCase() === 'ff'
      ? `#${value.slice(2).toUpperCase()}`
      : `#${value.toUpperCase()}`;
    current = undefined;
  }
  return colors;
}

async function inspectAndroidApk(file: string) {
  let metadata: AndroidCompiledMetadata = {};
  try {
    metadata = await inspectCompiledAndroidApk(await readFile(file));
  } catch {
    // Damaged or uncommon resource tables may still be readable by an Android
    // SDK installed on the machine. External tools are fallback-only.
  }

  const needsColors = Object.keys(metadata.colors ?? {}).length < Object.keys(ANDROID_SAMPLE_COLORS).length;
  const needsManifest = !metadata.themeId || !metadata.version || !metadata.name || !metadata.appearance;
  if (!needsColors && !needsManifest) return metadata;

  const [aapt, aapt2] = await Promise.all([
    needsManifest ? androidBuildTool('aapt') : Promise.resolve(undefined),
    needsColors ? androidBuildTool('aapt2') : Promise.resolve(undefined),
  ]);
  if (needsColors && aapt2) {
    try {
      const { stdout } = await execFileAsync(aapt2, ['dump', 'resources', file], { maxBuffer: 20_000_000 });
      metadata.colors = { ...parseCompiledColors(stdout), ...metadata.colors };
    } catch { /* keep importing the APK's image resources */ }
  }
  if (needsManifest && aapt) {
    try {
      const { stdout } = await execFileAsync(aapt, ['dump', 'badging', file], { maxBuffer: 5_000_000 });
      metadata.themeId ??= stdout.match(/^package:\s+name='([^']+)'/m)?.[1];
      metadata.version ??= stdout.match(/^package:.*\bversionName='([^']+)'/m)?.[1];
      metadata.name ??= stdout.match(/^application-label-ko:'([^']+)'/m)?.[1]
        ?? stdout.match(/^application-label:'([^']+)'/m)?.[1];
    } catch { /* metadata is optional; mapped images remain editable */ }
    if (!metadata.appearance) try {
      const { stdout } = await execFileAsync(aapt, ['dump', 'xmltree', file, 'AndroidManifest.xml'], { maxBuffer: 5_000_000 });
      metadata.appearance = /com\.kakao\.talk\.theme_style[\s\S]{0,500}android:value[^\n]*["']dark["']/i.test(stdout) ? 'dark' : 'light';
    } catch { /* older build-tools may not expose manifest meta-data */ }
  }
  return metadata;
}

async function importTheme() {
  const result = await dialog.showOpenDialog({ title: '기존 테마 또는 프로젝트 열기', properties: ['openFile'], filters: [
    { name: '지원하는 테마', extensions: ['ktstudio', 'ktheme', 'apk', 'zip'] },
  ] });
  if (result.canceled || !result.filePaths[0]) return null;
  const file = result.filePaths[0];
  const kind = detectThemeImportKind(file);
  if (kind === 'project') return { kind: 'project' as const, project: parseThemeProject(await readFile(file, 'utf8')) };
  if (kind === 'ios') {
    return { kind: 'ios' as const, project: await importIosKtheme(await readFile(file), path.basename(file)) };
  }
  if (kind === 'android-apk') {
    const metadata = await inspectAndroidApk(file);
    return {
      kind: 'android' as const,
      project: await importAndroidThemeArchive(await readFile(file), path.basename(file), metadata),
    };
  }
  return {
    kind: 'android' as const,
    project: await importAndroidSourceZip(await readFile(file), path.basename(file)),
  };
}

function registerIpc() {
  ipcMain.handle('project:open', async (event) => { assertTrusted(event); const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: '테마 스튜디오 프로젝트', extensions: ['ktstudio'] }] }); if (result.canceled || !result.filePaths[0]) return null; return { path: result.filePaths[0], content: await readFile(result.filePaths[0], 'utf8') }; });
  ipcMain.handle('project:save', async (event, { content, suggestedName }) => { assertTrusted(event); parseThemeProject(content); const result = await dialog.showSaveDialog({ defaultPath: `${suggestedName}.ktstudio`, filters: [{ name: '테마 스튜디오 프로젝트', extensions: ['ktstudio'] }] }); if (result.canceled || !result.filePath) return null; await writeFile(result.filePath, content); return result.filePath; });
  ipcMain.handle('theme:import', async (event) => { assertTrusted(event); return importTheme(); });
  ipcMain.handle('theme:export-ios', async (event, project: ThemeProject) => { assertTrusted(event); return exportIos(project); });
  ipcMain.handle('theme:export-android', async (event, project: ThemeProject) => { assertTrusted(event); return exportAndroid(project); });
  ipcMain.handle('screenshots:save', async (event, files: Array<{ name: string; dataUrl: string }>) => { assertTrusted(event); const result = await dialog.showOpenDialog({ title: '홍보 이미지 저장 폴더', properties: ['openDirectory', 'createDirectory'] }); if (result.canceled || !result.filePaths[0]) return null; await Promise.all(files.map((file) => writeFile(path.join(result.filePaths[0], file.name), dataUrlBuffer(file.dataUrl)))); return result.filePaths[0]; });
}

app.whenReady().then(async () => { registerIpc(); installApplicationMenu(); await createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
