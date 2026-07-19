import JSZip from 'jszip';
import { createDefaultTheme } from '../../domain/theme/defaults';
import { migrateLegacyNowTabAssets } from '../../domain/theme/migrations/legacyNowTabAssets';
import type { ThemeProject } from '../../domain/theme/model';
import type { NinePatchGuides } from '../../domain/ninePatch';
import { ANDROID_SAMPLE_COLORS } from '../../manifest/kakaoColors';
import {
  createAndroidArchiveIndex,
  type AndroidArchiveIndex,
} from '../androidArchiveResources';
import type { AndroidCompiledMetadata } from '../androidCompiledMetadata';
import {
  decodeAndroidCompiledTheme,
  decodeAndroidSourceDocuments,
  type DecodedAndroidThemeData,
} from './androidXmlDecoder';
import { ThemeImportFailure } from './importFailure';
import {
  importMappedImages,
  type FailedAndroidResource,
  type MappedImageImportResult,
  type RecoveredMappedImage,
} from './mappedImageImporter';
import { mirrorSemanticColors, mirrorSemanticResources } from './semanticMirror';

type AndroidArchiveKind = 'apk' | 'source';

interface LoadedAndroidArchive {
  zip: JSZip;
  index: AndroidArchiveIndex;
}

function setBubbleGuides(
  project: ThemeProject,
  resourceId: string,
  guides: NinePatchGuides,
) {
  const match = resourceId.match(
    /^chat\.bubble\.(me|you)\.(first|grouped)\.(normal|pressed)$/,
  );
  if (!match) return;
  const [, side, sequence, state] = match as [
    string,
    'me' | 'you',
    'first' | 'grouped',
    'normal' | 'pressed',
  ];
  const key: keyof ThemeProject['chat']['bubbles']['me'] =
    sequence === 'grouped'
      ? state === 'pressed'
        ? 'groupedPressed'
        : 'grouped'
      : state;
  const appearance = project.chat.bubbles[side][key];
  appearance.stretch = guides;
  appearance.stretchByPlatform = {
    ...appearance.stretchByPlatform,
    android: guides,
  };
}

function applyRecoveredImages(
  project: ThemeProject,
  images: readonly RecoveredMappedImage[],
) {
  for (const { resourceId, asset, guides } of images) {
    if (guides) setBubbleGuides(project, resourceId, guides);
    project.resources[resourceId] = asset;
    project.platformResources.android[resourceId] = asset;
  }
}

function applyAndroidThemeData(
  project: ThemeProject,
  decoded: DecodedAndroidThemeData,
) {
  Object.assign(project.meta, decoded.metadata);
  Object.assign(project.colorValues.android, decoded.colorValues);
  Object.assign(
    project.colors,
    Object.fromEntries(
      Object.entries(decoded.themeColors).filter(
        ([, value]) => value !== undefined,
      ),
    ),
  );
  for (const [screen, color] of Object.entries(decoded.screenColors)) {
    if (color) {
      project.screens[screen as keyof ThemeProject['screens']].background = {
        kind: 'color',
        color,
      };
    }
  }
}

async function loadAndroidArchive(
  source: Uint8Array,
  archiveKind: AndroidArchiveKind,
): Promise<LoadedAndroidArchive> {
  try {
    const zip = await JSZip.loadAsync(source);
    return {
      zip,
      index: createAndroidArchiveIndex(zip, archiveKind),
    };
  } catch (error) {
    if (error instanceof ThemeImportFailure) throw error;
    throw new ThemeImportFailure({
      kind: 'android-archive',
      message: 'Android 테마 압축 파일을 읽지 못했습니다.',
      safeContext: { archiveKind },
      cause: error,
    });
  }
}

async function decodeSourceArchive(index: AndroidArchiveIndex) {
  const manifest = await index
    .find('src/main/AndroidManifest.xml')
    ?.async('string');
  const colors = await index
    .find('src/main/theme/values/colors.xml')
    ?.async('string');
  const strings = await index
    .find('src/main/theme/values/strings.xml')
    ?.async('string');
  const gradle = await (
    index.find('build.gradle.kts') ?? index.find('build.gradle')
  )?.async('string');
  return decodeAndroidSourceDocuments({ manifest, colors, strings, gradle });
}

function androidResourceFailureDetail({
  resourceKey,
  referencedPaths,
  errors,
}: FailedAndroidResource) {
  return `${resourceKey} [${referencedPaths.join(', ')}]${
    errors.length ? `: ${errors.join(' | ')}` : ''
  }`;
}

function validateApkMappedResources(
  images: MappedImageImportResult,
  compiledMetadata?: AndroidCompiledMetadata,
) {
  if (images.failedResources.length) {
    const details = images.failedResources.map(androidResourceFailureDetail);
    throw new ThemeImportFailure({
      kind: 'android-image-recovery',
      message: `Android APK 이미지 리소스를 읽지 못했습니다: ${details.join(
        '; ',
      )}`,
      safeContext: {
        archiveKind: 'apk',
        resourceKey: images.failedResources[0].resourceKey,
      },
    });
  }
  if (images.mappedIds.size > 0) return;
  const hasCompiledThemeColor = Object.keys(compiledMetadata?.colors ?? {}).some(
    (name) => name in ANDROID_SAMPLE_COLORS,
  );
  if (hasCompiledThemeColor) {
    throw new ThemeImportFailure({
      kind: 'android-image-recovery',
      message:
        'Android APK에서 테마 색상은 읽었지만 이미지 리소스를 복원하지 못했습니다. 원본 APK를 확인해 주세요.',
      safeContext: { archiveKind: 'apk' },
    });
  }
  throw new ThemeImportFailure({
    kind: 'android-image-recovery',
    message:
      '카카오톡 Android 테마 리소스를 찾지 못했습니다. APK 또는 Android 테마 소스 ZIP을 확인해 주세요.',
    safeContext: { archiveKind: 'apk' },
  });
}

async function importAndroidArchive(
  source: Uint8Array,
  suggestedName: string,
  archiveKind: AndroidArchiveKind,
  compiledMetadata?: AndroidCompiledMetadata,
): Promise<ThemeProject> {
  const { zip, index } = await loadAndroidArchive(source, archiveKind);
  const project = createDefaultTheme(
    suggestedName.replace(/\.(zip|apk)$/i, ''),
    false,
  );
  const images = await importMappedImages({
    platform: 'android',
    archiveKind,
    zip,
    androidIndex: index,
    resourceFiles: compiledMetadata?.resourceFiles,
  });
  applyRecoveredImages(project, images.images);
  migrateLegacyNowTabAssets(project);

  const decoded =
    archiveKind === 'apk'
      ? compiledMetadata
        ? decodeAndroidCompiledTheme(compiledMetadata)
        : undefined
      : await decodeSourceArchive(index);
  if (decoded) applyAndroidThemeData(project, decoded);
  const importedColors = new Set(decoded?.importedColorBindings ?? []);
  mirrorSemanticResources(project, 'android');
  mirrorSemanticColors(project, 'android', importedColors);
  if (archiveKind === 'apk') {
    validateApkMappedResources(images, compiledMetadata);
  }
  return project;
}

export async function importAndroidSourceZip(
  source: Uint8Array,
  suggestedName: string,
): Promise<ThemeProject> {
  return importAndroidArchive(source, suggestedName, 'source');
}

export async function importAndroidThemeArchive(
  source: Uint8Array,
  suggestedName: string,
  compiledMetadata?: AndroidCompiledMetadata,
): Promise<ThemeProject> {
  return importAndroidArchive(source, suggestedName, 'apk', compiledMetadata);
}
