import JSZip from 'jszip';
import { createDefaultTheme, migrateLegacyNowTabAssets, type ThemeProject } from '../domain/theme';
import type { NinePatchGuides } from '../domain/ninePatch';
import { ANDROID_SAMPLE_COLORS } from '../manifest/kakaoColors';
import {
  createAndroidArchiveIndex,
  type AndroidArchiveIndex,
} from './androidArchiveResources';
import type { AndroidCompiledMetadata } from './androidCompiledMetadata';
import { decodeAndroidCompiledTheme, decodeAndroidSourceDocuments, type DecodedAndroidThemeData } from './themeImport/androidXmlDecoder';
import { decodeIosCss, resolveIosBubbleGuides, type DecodedIosCss } from './themeImport/iosCssDecoder';
import {
  importMappedImages,
  type FailedAndroidResource,
  type MappedImageImportResult,
  type RecoveredMappedImage,
} from './themeImport/mappedImageImporter';
import { mirrorSemanticColors, mirrorSemanticResources } from './themeImport/semanticMirror';

export { inspectCompiledAndroidApk } from './androidCompiledMetadata';
export type { AndroidCompiledMetadata } from './androidCompiledMetadata';
export { detectThemeImportKind } from './themeImport/detectImportKind';
export type { ThemeImportKind } from './themeImport/detectImportKind';

function setBubbleGuides(project: ThemeProject, resourceId: string, guides: NinePatchGuides, platform: 'ios' | 'android') {
  const match = resourceId.match(/^chat\.bubble\.(me|you)\.(first|grouped)\.(normal|pressed)$/);
  if (!match) return;
  const [, side, sequence, state] = match as [string, 'me' | 'you', 'first' | 'grouped', 'normal' | 'pressed'];
  const key: keyof ThemeProject['chat']['bubbles']['me'] = sequence === 'grouped' ? (state === 'pressed' ? 'groupedPressed' : 'grouped') : state;
  const appearance = project.chat.bubbles[side][key];
  appearance.stretch = guides;
  appearance.stretchByPlatform = { ...appearance.stretchByPlatform, [platform]: guides };
}

function applyRecoveredMappedImages(
  project: ThemeProject,
  platform: 'ios' | 'android',
  images: readonly RecoveredMappedImage[],
) {
  for (const { resourceId, asset, guides } of images) {
    if (guides) setBubbleGuides(project, resourceId, guides, platform);
    project.resources[resourceId] = asset;
    project.platformResources[platform][resourceId] = asset;
  }
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
  const importedImages = await importMappedImages({
    platform: 'ios',
    archiveKind: 'ios',
    zip,
    referencedFiles: decoded.referencedFiles,
  });
  applyRecoveredMappedImages(project, 'ios', importedImages.images);
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
  const images = await importMappedImages({
    platform: 'android',
    archiveKind,
    zip,
    androidIndex: index,
    resourceFiles: compiledMetadata?.resourceFiles,
  });
  applyRecoveredMappedImages(project, 'android', images.images);
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
    const details = imported.images.failedResources.map(androidResourceFailureDetail);
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

function androidResourceFailureDetail({
  resourceKey,
  referencedPaths,
  errors,
}: FailedAndroidResource) {
  return `${resourceKey} [${referencedPaths.join(', ')}]${errors.length ? `: ${errors.join(' | ')}` : ''}`;
}
