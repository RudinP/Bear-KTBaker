import path from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { createDefaultTheme, migrateLegacyNowTabAssets, type ImageAsset, type ThemeProject } from '../domain/theme';
import type { NinePatchGuides } from '../domain/ninePatch';
import {
  KAKAO_RESOURCE_SLOTS,
  type KakaoResourceSlot,
  type PlatformResourceBinding,
} from '../manifest/kakaoResources';
import { ANDROID_SAMPLE_COLORS, KAKAO_COLOR_SLOTS } from '../manifest/kakaoColors';
import {
  androidPngCandidates,
  androidResourceIdentity,
  createAndroidArchiveIndex,
  isAndroidPngPath,
  type AndroidArchiveIndex,
} from './androidArchiveResources';
import type { AndroidCompiledMetadata } from './androidCompiledMetadata';
import { decodeAndroidCompiledTheme, decodeAndroidSourceDocuments, type DecodedAndroidThemeData } from './themeImport/androidXmlDecoder';
import { decodeIosCss, resolveIosBubbleGuides, type DecodedIosCss } from './themeImport/iosCssDecoder';
import { parseCompiledNinePatchPng, parseNinePatchPng, stripNinePatchBorder } from './ninePatchPng';

export { inspectCompiledAndroidApk } from './androidCompiledMetadata';
export type { AndroidCompiledMetadata } from './androidCompiledMetadata';
export { detectThemeImportKind } from './themeImport/detectImportKind';
export type { ThemeImportKind } from './themeImport/detectImportKind';

function dataUrl(buffer: Buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function preferredFile(binding: PlatformResourceBinding, platform: 'ios' | 'android') {
  if (platform === 'ios') return binding.files.find((file) => file.includes('@3x.')) ?? binding.files[0];
  return binding.files.find((file) => file.includes('/mipmap-xxhdpi/'))
    ?? binding.files.find((file) => file.includes('/drawable-xxhdpi/'))
    ?? binding.files[0];
}

function orderedFiles(binding: PlatformResourceBinding, platform: 'ios' | 'android') {
  const preferred = preferredFile(binding, platform);
  return preferred ? [preferred, ...binding.files.filter((file) => file !== preferred)] : binding.files;
}

function importedSourceScale(resourceId: string, platform: 'ios' | 'android', fileName: string) {
  const iosScale = fileName.match(/@(\d+)x(?=\.[^.]+$)/i)?.[1];
  if (platform === 'ios') return iosScale ? Number(iosScale) : 1;
  if (['main.background', 'chat.background', 'passcode.background', 'main.tab.background', 'splash.image'].includes(resourceId)) return 4;
  if (/drawable-xhdpi/i.test(fileName)) return 2;
  if (/drawable-xxxhdpi/i.test(fileName)) return 4;
  return 3;
}

function setBubbleGuides(project: ThemeProject, resourceId: string, guides: NinePatchGuides, platform: 'ios' | 'android') {
  const match = resourceId.match(/^chat\.bubble\.(me|you)\.(first|grouped)\.(normal|pressed)$/);
  if (!match) return;
  const [, side, sequence, state] = match as [string, 'me' | 'you', 'first' | 'grouped', 'normal' | 'pressed'];
  const key: keyof ThemeProject['chat']['bubbles']['me'] = sequence === 'grouped' ? (state === 'pressed' ? 'groupedPressed' : 'grouped') : state;
  const appearance = project.chat.bubbles[side][key];
  appearance.stretch = guides;
  appearance.stretchByPlatform = { ...appearance.stretchByPlatform, [platform]: guides };
}


interface MappedImageImportResult {
  mappedIds: Set<string>;
  failedResources: FailedAndroidResource[];
}

interface FailedAndroidResource {
  resourceKey: string;
  referencedPaths: string[];
  errors: string[];
}

interface MappedImageCandidate {
  path: string;
  entry: JSZip.JSZipObject;
  compiled: boolean;
}

interface DecodedMappedImage {
  asset: ImageAsset;
  guides?: NinePatchGuides;
}

function iosImageCandidates(
  zip: JSZip,
  resourceId: string,
  binding: PlatformResourceBinding,
  referencedFiles?: Record<string, readonly string[]>,
): MappedImageCandidate[] {
  return [...new Set([
    ...(referencedFiles?.[resourceId] ?? []),
    ...orderedFiles(binding, 'ios'),
  ])].flatMap((candidate) => {
    const entry = zip.file(candidate);
    return entry ? [{ path: candidate, entry, compiled: false }] : [];
  });
}

async function decodeMappedImage(
  platform: 'ios' | 'android',
  slot: KakaoResourceSlot,
  candidate: MappedImageCandidate,
): Promise<DecodedMappedImage> {
  const binding = slot[platform]!;
  const source = await candidate.entry.async('nodebuffer');
  if (platform === 'android' && binding.ninePatch) {
    const png = PNG.sync.read(source);
    const parsed = candidate.compiled && slot.id.startsWith('chat.bubble.')
      ? parseCompiledNinePatchPng(source)
      : candidate.compiled
        ? { width: png.width, height: png.height, guides: undefined }
        : parseNinePatchPng(source);
    const preview = candidate.compiled ? source : stripNinePatchBorder(source);
    return {
      asset: {
        fileName: path.basename(candidate.path).replace(/\.9\.png$/i, '.png'),
        dataUrl: dataUrl(preview),
        width: parsed.width,
        height: parsed.height,
        sourceScale: importedSourceScale(slot.id, platform, candidate.path),
        rawNinePatch: false,
      },
      guides: parsed.guides,
    };
  }
  const png = PNG.sync.read(source);
  return {
    asset: {
      fileName: path.basename(candidate.path),
      dataUrl: dataUrl(source),
      width: png.width,
      height: png.height,
      sourceScale: importedSourceScale(slot.id, platform, candidate.path),
      rawNinePatch: false,
    },
  };
}

function applyDecodedMappedImage(
  project: ThemeProject,
  platform: 'ios' | 'android',
  resourceId: string,
  decoded: DecodedMappedImage,
) {
  if (decoded.guides) setBubbleGuides(project, resourceId, decoded.guides, platform);
  project.resources[resourceId] = decoded.asset;
  project.platformResources[platform][resourceId] = decoded.asset;
}

async function importMappedImages(
  zip: JSZip,
  project: ThemeProject,
  platform: 'ios' | 'android',
  options: {
    archiveKind: 'ios' | 'source' | 'apk';
    androidIndex?: AndroidArchiveIndex;
    resourceFiles?: Record<string, string[]>;
    iosReferencedFiles?: Record<string, readonly string[]>;
  },
): Promise<MappedImageImportResult> {
  const mappedIds = new Set<string>();
  const failedResources: FailedAndroidResource[] = [];
  const androidIndex = options.androidIndex;

  for (const slot of KAKAO_RESOURCE_SLOTS) {
    const binding = slot[platform];
    if (!binding || binding.files.length === 0) continue;
    const candidates = platform === 'android'
      ? androidPngCandidates({
        index: androidIndex!,
        kind: options.archiveKind === 'apk' ? 'apk' : 'source',
        bindingFiles: orderedFiles(binding, platform),
        resourceFiles: options.resourceFiles,
      })
      : iosImageCandidates(zip, slot.id, binding, options.iosReferencedFiles);
    const decodeErrors: string[] = [];
    let restored = false;
    for (const candidate of candidates) {
      let decoded: DecodedMappedImage;
      try {
        decoded = await decodeMappedImage(platform, slot, candidate);
      } catch (error) {
        decodeErrors.push(`${candidate.path}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      applyDecodedMappedImage(project, platform, slot.id, decoded);
      mappedIds.add(slot.id);
      restored = true;
      break;
    }
    if (!restored && platform === 'android') {
      const referencesByKey = new Map<string, string[]>();
      for (const file of binding.files) {
        const key = androidResourceIdentity(file)?.key;
        if (!key) continue;
        const paths = (options.resourceFiles?.[key] ?? []).filter(isAndroidPngPath);
        if (paths.length) referencesByKey.set(key, paths);
      }
      for (const [resourceKey, referencedPaths] of referencesByKey) {
        failedResources.push({
          resourceKey,
          referencedPaths,
          errors: [
            ...referencedPaths
              .filter((candidatePath) => !androidIndex!.find(candidatePath))
              .map((candidatePath) => `${candidatePath}: ZIP 엔트리 없음`),
            ...decodeErrors,
          ],
        });
      }
    }
  }
  return { mappedIds, failedResources };
}

function applyIosCss(project: ThemeProject, decoded: DecodedIosCss) {
  project.meta.name = decoded.metadata.name ?? project.meta.name;
  project.meta.author = decoded.metadata.author ?? '';
  project.meta.version = decoded.metadata.version ?? project.meta.version;
  project.meta.themeId = decoded.metadata.themeId ?? project.meta.themeId;
  project.meta.appearance = decoded.metadata.appearance;
  Object.assign(project.colorValues.ios, decoded.colorValues);
  Object.assign(project.colors, Object.fromEntries(
    Object.entries(decoded.themeColors).filter(([, value]) => value !== undefined),
  ));
  for (const [screen, color] of Object.entries(decoded.screenColors)) {
    if (color) project.screens[screen as keyof ThemeProject['screens']].background = { kind: 'color', color };
  }
  if (decoded.bubbleTextColors.me) project.chat.bubbles.me.normal.textColor = decoded.bubbleTextColors.me;
  if (decoded.bubbleTextColors.you) project.chat.bubbles.you.normal.textColor = decoded.bubbleTextColors.you;
  if (decoded.unreadColor) project.chat.unreadColor = decoded.unreadColor;
}

function mirrorSemanticResources(project: ThemeProject, source: 'ios' | 'android') {
  const target = source === 'ios' ? 'android' : 'ios';
  for (const slot of KAKAO_RESOURCE_SLOTS) {
    const sourceBinding = slot[source];
    const targetBinding = slot[target];
    if (!sourceBinding?.files.length || !targetBinding?.files.length) continue;
    const asset = project.platformResources[source][slot.id];
    if (!asset || project.platformResources[target][slot.id]) continue;
    project.platformResources[target][slot.id] = { ...asset, mirroredFromPlatform: source };
  }
}

function rgb(value: string | undefined) {
  const match = value?.match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  return match ? match.slice(-6).toUpperCase() : undefined;
}

function withPreservedTargetAlpha(value: string | undefined, sourceRgb: string) {
  const match = value?.match(/^#([0-9a-f]{8})$/i)?.[1];
  return match ? `#${match.slice(0, 2).toUpperCase()}${sourceRgb}` : `#${sourceRgb}`;
}

function mirrorSemanticColors(project: ThemeProject, source: 'ios' | 'android', imported: Set<string>) {
  const target = source === 'ios' ? 'android' : 'ios';
  for (const slot of KAKAO_COLOR_SLOTS) {
    const sourceKeys = slot[source];
    const targetKeys = slot[target];
    if (!sourceKeys.length || !targetKeys.length) continue;
    const sourceKey = sourceKeys.find((key) => imported.has(key));
    const sourceRgb = sourceKey ? rgb(project.colorValues[source][sourceKey]) : undefined;
    if (!sourceRgb) continue;
    for (const key of targetKeys) {
      project.colorValues[target][key] = withPreservedTargetAlpha(project.colorValues[target][key], sourceRgb);
    }
  }
}

function applyIosBubbleGuides(project: ThemeProject, decoded: DecodedIosCss) {
  for (const declaration of decoded.bubbleGuides) {
    const asset = project.resources[declaration.resourceId];
    const guides = asset && resolveIosBubbleGuides(declaration, asset);
    if (guides) setBubbleGuides(project, declaration.resourceId, guides, 'ios');
  }
}

export async function importIosKtheme(source: Buffer, suggestedName: string) {
  const zip = await JSZip.loadAsync(source);
  const css = await zip.file('KakaoTalkTheme.css')?.async('string');
  if (!css) throw new Error('KakaoTalkTheme.css가 없는 iPhone 테마입니다.');
  const project = createDefaultTheme(suggestedName.replace(/\.ktheme$/i, ''), false);
  const decoded = decodeIosCss(css);
  applyIosCss(project, decoded);
  await importMappedImages(zip, project, 'ios', { archiveKind: 'ios', iosReferencedFiles: decoded.referencedFiles });
  migrateLegacyNowTabAssets(project);
  applyIosBubbleGuides(project, decoded);
  mirrorSemanticResources(project, 'ios');
  mirrorSemanticColors(project, 'ios', new Set(decoded.importedColorBindings));
  return project;
}

function applyAndroidThemeData(project: ThemeProject, decoded: DecodedAndroidThemeData) {
  Object.assign(project.meta, decoded.metadata);
  Object.assign(project.colorValues.android, decoded.colorValues);
  Object.assign(project.colors, Object.fromEntries(
    Object.entries(decoded.themeColors).filter(([, value]) => value !== undefined),
  ));
  for (const [screen, color] of Object.entries(decoded.screenColors)) {
    if (color) project.screens[screen as keyof ThemeProject['screens']].background = { kind: 'color', color };
  }
}

interface AndroidArchiveImport {
  index: AndroidArchiveIndex;
  project: ThemeProject;
  images: MappedImageImportResult;
  archiveKind: 'apk' | 'source';
  compiledMetadata?: AndroidCompiledMetadata;
}

async function importAndroidArchive(
  source: Buffer,
  suggestedName: string,
  archiveKind: 'apk' | 'source',
  compiledMetadata?: AndroidCompiledMetadata,
) {
  const zip = await JSZip.loadAsync(source);
  const index = createAndroidArchiveIndex(zip, archiveKind);
  const project = createDefaultTheme(suggestedName.replace(/\.(zip|apk)$/i, ''), false);
  const images = await importMappedImages(zip, project, 'android', {
    archiveKind,
    androidIndex: index,
    resourceFiles: compiledMetadata?.resourceFiles,
  });
  return { index, project, images, archiveKind, compiledMetadata } satisfies AndroidArchiveImport;
}

async function finishAndroidImport({
  index,
  project,
  archiveKind,
  compiledMetadata,
}: AndroidArchiveImport): Promise<ThemeProject> {
  migrateLegacyNowTabAssets(project);
  let importedColors = new Set<string>();

  if (archiveKind === 'apk') {
    if (compiledMetadata) {
      const decoded = decodeAndroidCompiledTheme(compiledMetadata);
      applyAndroidThemeData(project, decoded);
      importedColors = new Set(decoded.importedColorBindings);
    }
  } else {
    const manifest = await index.find('src/main/AndroidManifest.xml')?.async('string');
    const colors = await index.find('src/main/theme/values/colors.xml')?.async('string');
    const strings = await index.find('src/main/theme/values/strings.xml')?.async('string');
    const gradle = await (index.find('build.gradle.kts') ?? index.find('build.gradle'))?.async('string');
    const decoded = decodeAndroidSourceDocuments({ manifest, colors, strings, gradle });
    applyAndroidThemeData(project, decoded);
    importedColors = new Set(decoded.importedColorBindings);
  }

  mirrorSemanticResources(project, 'android');
  mirrorSemanticColors(project, 'android', importedColors);
  return project;
}

export async function importAndroidSourceZip(
  source: Buffer,
  suggestedName: string,
) {
  const imported = await importAndroidArchive(source, suggestedName, 'source');
  return finishAndroidImport(imported);
}

export async function importAndroidThemeArchive(
  source: Buffer,
  suggestedName: string,
  compiledMetadata?: AndroidCompiledMetadata,
) {
  const imported = await importAndroidArchive(source, suggestedName, 'apk', compiledMetadata);
  const project = await finishAndroidImport(imported);
  if (imported.images.failedResources.length) {
    const details = imported.images.failedResources.map(({ resourceKey, referencedPaths, errors }) =>
      `${resourceKey} [${referencedPaths.join(', ')}]${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    throw new Error(`Android APK 이미지 리소스를 읽지 못했습니다: ${details.join('; ')}`);
  }
  if (imported.images.mappedIds.size === 0) {
    const hasCompiledThemeColor = Object.keys(compiledMetadata?.colors ?? {})
      .some((name) => name in ANDROID_SAMPLE_COLORS);
    if (hasCompiledThemeColor) {
      throw new Error('Android APK에서 테마 색상은 읽었지만 이미지 리소스를 복원하지 못했습니다. 원본 APK를 확인해 주세요.');
    }
    throw new Error('카카오톡 Android 테마 리소스를 찾지 못했습니다. APK 또는 Android 테마 소스 ZIP을 확인해 주세요.');
  }
  return project;
}
